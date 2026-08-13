import { createWorkflow, createStep } from "@mastra/core/workflows"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { db, schema } from "@/db/client"
import { numberLines } from "@/lib/pdf/extract"
import { provenLevel } from "@/lib/scoring/level"
import { computeGap, type BenchmarkRow } from "@/lib/scoring/gap"
import { readinessScore, perTrackReadiness } from "@/lib/scoring/readiness"
import { buildSchedule, type ScheduledItem, type ScheduleNote } from "@/lib/scheduling/schedule"
import {
  rankProjects,
  rankCerts,
  rankQuestions,
  type RankedProject,
  type RankedCert,
  type RankedQuestion,
} from "@/lib/ranking/rank"
import type { LevelRubric } from "@/lib/scoring/types"
import { resumeExtractorAgent } from "../agents/resume-extractor"
import {
  resumeExtractionSchema,
  evidenceSignalsSchema,
  sanitiseExtraction,
  noteForTrack,
  normaliseEvidenceKind,
} from "../schemas/extraction"
import { JSON_PROMPT_INJECTION } from "../models"

/**
 * Upload → gauges.
 *
 * Exactly one step in this workflow calls a language model. Everything that
 * produces a number a student will see is ordinary TypeScript over seeded
 * benchmarks, which is what makes a run reproducible and every gauge
 * explicable. See the contract in README.md.
 */

const workflowInput = z.object({
  runId: z.string(),
  studentId: z.string(),
  resumeId: z.string(),
  roleId: z.string(),
  weeklyHours: z.number(),
})

/**
 * Step schemas are declared standalone rather than derived from
 * `previousStep.outputSchema` — createStep wraps the schema in a
 * StandardSchema, which has no `.extend()`, and deriving from it also erases
 * the element types that keep the `.map()` callbacks below typed.
 */
const contextSchema = workflowInput.extend({
  pagesText: z.array(z.string()),
  numberedText: z.string(),
  trackBrief: z.string(),
  trackIds: z.array(z.string()),
})

const extractedSchema = contextSchema.extend({
  extraction: resumeExtractionSchema,
  signalsByTrack: z.record(z.string(), evidenceSignalsSchema),
})

/** One gauge row — the shape the skill map renders. */
const gaugeSchema = z.object({
  trackId: z.string(),
  provenLevel: z.number(),
  requiredLevel: z.number(),
  gap: z.number(),
  weight: z.number(),
  weeksToClose: z.number(),
  status: z.enum(["open", "met", "above"]),
  isBlocking: z.boolean(),
  rubricLevelHit: z.number(),
  note: z.string(),
})

const scoredSchema = extractedSchema.extend({
  gauges: z.array(gaugeSchema),
  readiness: z.number(),
})

const plannedSchema = scoredSchema.extend({
  plan: z.object({
    projects: z.array(z.custom<RankedProject>()),
    certs: z.array(z.custom<RankedCert>()),
    questions: z.array(z.custom<RankedQuestion>()),
    items: z.array(z.custom<ScheduledItem>()),
    notes: z.array(z.custom<ScheduleNote>()),
  }),
})

const resultSchema = z.object({
  readiness: z.number(),
  openGaps: z.number(),
  trackCount: z.number(),
})

/** Appends a line to the run's progress log, which drives the intake checklist. */
async function logProgress(
  runId: string,
  step: string,
  entry: { key: string; label: string; value: string }
) {
  const [run] = await db
    .select({ progress: schema.analysisRuns.progress })
    .from(schema.analysisRuns)
    .where(eq(schema.analysisRuns.id, runId))

  await db
    .update(schema.analysisRuns)
    .set({
      status: "running",
      currentStep: step,
      progress: [...(run?.progress ?? []), entry],
    })
    .where(eq(schema.analysisRuns.id, runId))
}

// ─── 1. Load context (deterministic) ─────────────────────────────────────────

const loadContextStep = createStep({
  id: "load-context",
  description: "Read the resume text and the role's benchmark from the database",
  inputSchema: workflowInput,
  outputSchema: contextSchema,
  execute: async ({ inputData }) => {
    const { runId, resumeId, roleId } = inputData

    const [resume] = await db
      .select()
      .from(schema.resumes)
      .where(eq(schema.resumes.id, resumeId))
    if (!resume) throw new Error(`Resume ${resumeId} not found`)

    const benchmarks = await db
      .select({
        trackId: schema.roleBenchmarks.trackId,
        name: schema.skillTracks.name,
        description: schema.skillTracks.description,
        levelRubric: schema.skillTracks.levelRubric,
      })
      .from(schema.roleBenchmarks)
      .innerJoin(
        schema.skillTracks,
        eq(schema.skillTracks.id, schema.roleBenchmarks.trackId)
      )
      .where(eq(schema.roleBenchmarks.roleId, roleId))

    if (benchmarks.length === 0) {
      throw new Error(
        `No benchmark rows for role "${roleId}". Run \`npm run db:seed\`.`
      )
    }

    // The rubric is what the model is asked to reason against — it picks a
    // rung, it does not invent a number.
    const trackBrief = benchmarks
      .map((b) => {
        const ladder = (b.levelRubric as LevelRubric)
          .map((r) => `${r.label} (${r.evidence})`)
          .join(" → ")
        return `${b.trackId} | ${b.name} | ${b.description}\n    ladder: ${ladder}`
      })
      .join("\n")

    await logProgress(runId, "load-context", {
      key: "sections",
      label: "Sections identified",
      value: String(resume.sectionsFound || resume.pagesText.length),
    })

    return {
      ...inputData,
      pagesText: resume.pagesText,
      numberedText: numberLines(resume.pagesText),
      trackBrief,
      trackIds: benchmarks.map((b) => b.trackId),
    }
  },
})

// ─── 2. Extract (the one model call) ─────────────────────────────────────────

const extractStep = createStep({
  id: "extract",
  description: "Model reads the resume and reports evidence signals",
  inputSchema: contextSchema,
  outputSchema: extractedSchema,
  execute: async ({ inputData }) => {
    const { runId, numberedText, trackBrief, trackIds, pagesText } = inputData

    const result = await resumeExtractorAgent.generate(
      `=== RESUME (page and line numbered) ===\n${numberedText}\n\n` +
        `=== SKILL TRACKS YOU MAY REFERENCE ===\n${trackBrief}\n\n` +
        `Report signals for every track id listed above. Use no other track ids.`,
      {
        structuredOutput: {
          schema: resumeExtractionSchema,
          jsonPromptInjection: JSON_PROMPT_INJECTION,
        },
      }
    )

    if (!result.object) {
      throw new Error("The model returned no structured output.")
    }

    // Ground truth wins: unknown track ids and unverifiable quotes are dropped
    // here, before anything reaches the database.
    const { extraction, dropped, signalsByTrack } = sanitiseExtraction(
      result.object,
      trackIds,
      pagesText
    )

    await logProgress(runId, "extract", {
      key: "skills",
      label: "Skills extracted",
      value: String(extraction.skills.length),
    })
    await logProgress(runId, "extract", {
      key: "flags",
      label: "Claims lacking evidence",
      value: String(extraction.flags.length),
    })
    if (dropped.unverifiableFlags.length || dropped.unknownTracks.length) {
      await logProgress(runId, "extract", {
        key: "dropped",
        label: "Unverifiable claims discarded",
        value: String(
          dropped.unverifiableFlags.length + dropped.unknownTracks.length
        ),
      })
    }

    return { ...inputData, extraction, signalsByTrack }
  },
})

// ─── 3. Score (deterministic) ────────────────────────────────────────────────

const scoreStep = createStep({
  id: "score",
  description: "Evidence signals → levels, gaps and readiness",
  inputSchema: extractedSchema,
  outputSchema: scoredSchema,
  execute: async ({ inputData }) => {
    const { runId, roleId, weeklyHours, signalsByTrack, extraction } = inputData

    const rows = await db
      .select({
        trackId: schema.roleBenchmarks.trackId,
        requiredLevel: schema.roleBenchmarks.requiredLevel,
        weight: schema.roleBenchmarks.weight,
        hoursPerLevel: schema.roleBenchmarks.hoursPerLevel,
        isBlocking: schema.roleBenchmarks.isBlocking,
        levelRubric: schema.skillTracks.levelRubric,
      })
      .from(schema.roleBenchmarks)
      .innerJoin(
        schema.skillTracks,
        eq(schema.skillTracks.id, schema.roleBenchmarks.trackId)
      )
      .where(eq(schema.roleBenchmarks.roleId, roleId))

    const gauges = rows.map((row) => {
      const { level, rungHit } = provenLevel(
        signalsByTrack[row.trackId],
        row.levelRubric as LevelRubric
      )
      const benchmark: BenchmarkRow = {
        trackId: row.trackId,
        requiredLevel: row.requiredLevel,
        weight: row.weight,
        hoursPerLevel: row.hoursPerLevel,
        isBlocking: row.isBlocking,
      }
      return {
        ...computeGap(level, benchmark, weeklyHours),
        rubricLevelHit: rungHit,
        note: noteForTrack(extraction, row.trackId),
      }
    })

    const readiness = readinessScore(gauges)
    const open = gauges.filter((g) => g.status === "open").length

    await logProgress(runId, "score", {
      key: "readiness",
      label: "Readiness computed",
      value: `${readiness} / 100 · ${open} gaps open`,
    })

    return { ...inputData, gauges, readiness }
  },
})

// ─── 4. Plan (deterministic) ─────────────────────────────────────────────────
// Rank the catalogs against the open gaps, then schedule the roadmap. Pure
// TypeScript over closed, seeded sets: the plan can only recommend things a
// human authored, ordered by arithmetic a judge can re-run.

const planStep = createStep({
  id: "plan",
  description: "Rank recommendations and schedule the roadmap",
  inputSchema: scoredSchema,
  outputSchema: plannedSchema,
  execute: async ({ inputData }) => {
    const { runId, roleId, weeklyHours, gauges } = inputData

    const [tracks, projectRows, certRows, questionRows, prereqRows, student] =
      await Promise.all([
        db.select().from(schema.skillTracks),
        db.select().from(schema.projectCatalog),
        db.select().from(schema.certCatalog),
        db.select().from(schema.questionBank),
        db
          .select()
          .from(schema.trackPrerequisites)
          .where(eq(schema.trackPrerequisites.roleId, roleId)),
        db
          .select({ horizonWeeks: schema.students.horizonWeeks })
          .from(schema.students)
          .where(eq(schema.students.id, inputData.studentId)),
      ])

    const trackNames = Object.fromEntries(tracks.map((t) => [t.id, t.name]))
    const roleTrackIds = new Set(gauges.map((g) => g.trackId))

    const projects = rankProjects(
      projectRows.filter((p) =>
        p.closesTrackIds.some((id) => roleTrackIds.has(id))
      ),
      gauges,
      trackNames
    )

    const totalWeeks = student[0]?.horizonWeeks ?? 14
    const schedule = buildSchedule({
      totalWeeks,
      weeklyHours,
      gaps: gauges,
      trackNames,
      prerequisites: prereqRows.map((p) => ({
        trackId: p.trackId,
        requiresTrackId: p.requiresTrackId,
      })),
      projects: projects.slice(0, 3).map((p) => ({
        projectId: p.id,
        title: p.title,
        effortWeeks: p.effortWeeks,
        requiresTrackIds: p.requiresTrackIds,
        closesTrackIds: p.closesTrackIds,
      })),
      hasDsaTrack: roleTrackIds.has("dsa"),
    })

    const coveredByProjects = new Set(
      projects.slice(0, 3).flatMap((p) => p.closesTrackIds)
    )
    const certs = rankCerts(certRows, gauges, coveredByProjects, trackNames)
    const questions = rankQuestions(
      questionRows.filter((q) => roleTrackIds.has(q.trackId)),
      gauges,
      trackNames
    )

    await logProgress(runId, "plan", {
      key: "plan",
      label: "Roadmap scheduled",
      value: `${totalWeeks} weeks · ${projects.slice(0, 3).length} projects · ${questions.length} questions`,
    })

    return {
      ...inputData,
      plan: {
        projects,
        certs,
        questions,
        items: schedule.items,
        notes: schedule.notes,
      },
    }
  },
})

// ─── 5. Persist (deterministic) ──────────────────────────────────────────────

const persistStep = createStep({
  id: "persist",
  description: "Write the analysis in one transaction",
  inputSchema: plannedSchema,
  outputSchema: resultSchema,
  execute: async ({ inputData }) => {
    const { runId, studentId, roleId, gauges, readiness, extraction, plan } =
      inputData

    // Skills present on the previous successful run — anything new is rendered
    // in violet on the intake screen.
    const previous = await db
      .select({ rawLabel: schema.extractedSkills.rawLabel })
      .from(schema.extractedSkills)
      .innerJoin(
        schema.analysisRuns,
        eq(schema.analysisRuns.id, schema.extractedSkills.runId)
      )
      .where(
        and(
          eq(schema.analysisRuns.studentId, studentId),
          eq(schema.analysisRuns.status, "succeeded")
        )
      )
    const seen = new Set(previous.map((p) => p.rawLabel.toLowerCase()))

    // Sequential rather than transactional: the HTTP driver has no interactive
    // transactions (see src/db/client.ts). Assessments are written first
    // because they are the screen; the run is only marked succeeded once
    // everything else has landed, so a partial write leaves the run visibly
    // unfinished rather than silently half-right.
    {
      await db.insert(schema.skillAssessments).values(
        gauges.map((g) => ({
          runId,
          studentId,
          roleId,
          trackId: g.trackId,
          provenLevel: g.provenLevel,
          requiredLevel: g.requiredLevel,
          gap: g.gap,
          weight: g.weight,
          weeksToClose: g.weeksToClose,
          status: g.status,
          note: g.note,
          rubricLevelHit: g.rubricLevelHit,
        }))
      )

      if (extraction.skills.length) {
        await db.insert(schema.extractedSkills).values(
          extraction.skills.map((s) => ({
            runId,
            rawLabel: s.rawLabel,
            trackId: s.trackId,
            confidence: s.confidence,
            isNewSinceLast:
              seen.size > 0 && !seen.has(s.rawLabel.toLowerCase()),
            signals: inputData.signalsByTrack[s.trackId ?? ""] ?? {},
          }))
        )
      }

      if (extraction.evidence.length) {
        await db.insert(schema.resumeEvidence).values(
          extraction.evidence.map((e) => ({
            runId,
            // Already normalised in sanitiseExtraction; re-applied here so the
            // value is typed as the column's enum rather than a bare string.
            kind: normaliseEvidenceKind(e.kind),
            title: e.title,
            detail: e.detail,
            metric: e.metric,
            sourcePage: e.sourcePage,
            sourceLine: e.sourceLine,
            trackIds: e.trackIds,
          }))
        )
      }

      if (extraction.flags.length) {
        await db.insert(schema.resumeFlags).values(
          extraction.flags.map((f) => ({
            runId,
            page: f.page,
            line: f.line,
            quote: f.quote,
            critique: f.critique,
            suggestedFix: f.suggestedFix,
            severity: f.severity,
          }))
        )
      }

      await db
        .insert(schema.readinessSnapshots)
        .values({
          studentId,
          roleId,
          capturedOn: new Date().toISOString().slice(0, 10),
          readiness,
          perTrack: perTrackReadiness(gauges),
          source: "run",
        })
        .onConflictDoUpdate({
          target: [
            schema.readinessSnapshots.studentId,
            schema.readinessSnapshots.roleId,
            schema.readinessSnapshots.capturedOn,
          ],
          set: { readiness, perTrack: perTrackReadiness(gauges) },
        })

      // Recommendations. startWeek/endWeek link a project card to its bar.
      const scheduledByProject = new Map(
        plan.items
          .filter((i) => i.projectId)
          .map((i) => [i.projectId as string, i])
      )
      if (plan.projects.length) {
        await db.insert(schema.recommendedProjects).values(
          plan.projects.slice(0, 4).map((p) => ({
            runId,
            projectId: p.id,
            score: p.score,
            rank: p.rank,
            rationale: p.rationale,
            closesTrackIds: p.closesOpenTrackIds,
            startWeek: scheduledByProject.get(p.id)?.startWeek ?? null,
            endWeek: scheduledByProject.get(p.id)?.endWeek ?? null,
          }))
        )
      }
      if (plan.certs.length) {
        await db.insert(schema.recommendedCerts).values(
          plan.certs.map((c) => ({
            runId,
            certId: c.id,
            verdict: c.verdict,
            score: c.score,
            rank: c.rank,
            rationale: c.rationale,
          }))
        )
      }
      if (plan.questions.length) {
        await db.insert(schema.recommendedQuestions).values(
          plan.questions.map((q) => ({
            runId,
            questionId: q.id,
            isGapTrack: q.isGapTrack,
            rank: q.rank,
            score: q.score,
            coachNote: q.coachNote,
          }))
        )
      }

      // The roadmap. A new analysis supersedes any previous plan.
      await db
        .update(schema.roadmaps)
        .set({ isActive: false })
        .where(eq(schema.roadmaps.studentId, studentId))

      const [roadmap] = await db
        .insert(schema.roadmaps)
        .values({
          studentId,
          runId,
          roleId,
          totalWeeks: Math.max(...plan.items.map((i) => i.endWeek), 14),
          weeklyHours: inputData.weeklyHours,
          startDate: new Date().toISOString().slice(0, 10),
          isActive: true,
        })
        .returning()

      if (plan.items.length) {
        await db.insert(schema.roadmapItems).values(
          plan.items.map((i) => ({
            roadmapId: roadmap.id,
            lane: i.lane,
            kind: i.kind,
            trackId: i.trackId,
            projectId: i.projectId,
            label: i.label,
            detail: i.detail,
            startWeek: i.startWeek,
            endWeek: i.endWeek,
            sortOrder: i.sortOrder,
          }))
        )
      }
      if (plan.notes.length) {
        await db.insert(schema.roadmapNotes).values(
          plan.notes.map((n) => ({
            roadmapId: roadmap.id,
            week: n.week,
            headline: n.headline,
            body: n.body,
            sortOrder: n.sortOrder,
          }))
        )
      }

      await db
        .update(schema.analysisRuns)
        .set({
          status: "succeeded",
          currentStep: "persist",
          finishedAt: new Date(),
          // Role-independent extraction output. Re-scoring this run against a
          // different role's benchmark needs only this — no second model call.
          extractCache: {
            signals: inputData.signalsByTrack,
            notes: Object.fromEntries(
              extraction.trackSignals.map((t) => [t.trackId, t.note])
            ),
          },
        })
        .where(eq(schema.analysisRuns.id, runId))
    }

    return {
      readiness,
      openGaps: gauges.filter((g) => g.status === "open").length,
      trackCount: gauges.length,
    }
  },
})

export const analyzeResumeWorkflow = createWorkflow({
  id: "analyze-resume",
  description:
    "Resume text → evidence signals → gap gauges. One model call; every number is arithmetic.",
  inputSchema: workflowInput,
  outputSchema: resultSchema,
})
  .then(loadContextStep)
  .then(extractStep)
  .then(scoreStep)
  .then(planStep)
  .then(persistStep)
  .commit()
