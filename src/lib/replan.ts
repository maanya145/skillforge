import "server-only"

import { eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { provenLevel } from "@/lib/scoring/level"
import { computeGap, type BenchmarkRow, type GapResult } from "@/lib/scoring/gap"
import { readinessScore, perTrackReadiness } from "@/lib/scoring/readiness"
import type { EvidenceSignals, LevelRubric } from "@/lib/scoring/types"
import { rankProjects, rankCerts, rankQuestions } from "@/lib/ranking/rank"
import { buildSchedule } from "@/lib/scheduling/schedule"

/**
 * Re-scores an existing analysis against any role's benchmark — instantly.
 *
 * The one model call in the pipeline extracts role-independent evidence
 * signals, and the run caches them. Everything downstream of that is
 * arithmetic, so "what if I targeted Data Engineer instead?" costs a few
 * database reads and zero inference. This module is that downstream, shared by
 * the role switcher and the weekly-hours control.
 */

export type Scored = GapResult & { rubricLevelHit: number; note: string }

type Cache = { signals: Record<string, EvidenceSignals>; notes: Record<string, string> }

/** The cached extraction for a run, or null for pre-cache runs. */
export async function getExtractCache(runId: string): Promise<Cache | null> {
  const [run] = await db
    .select({ extractCache: schema.analysisRuns.extractCache })
    .from(schema.analysisRuns)
    .where(eq(schema.analysisRuns.id, runId))
  return run?.extractCache ?? null
}

/** Scores cached signals against one role's benchmark. Pure reads. */
export async function scoreRole(
  cache: Cache,
  roleId: string,
  weeklyHours: number
): Promise<Scored[]> {
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

  return rows.map((row) => {
    const signals = cache.signals[row.trackId]
    const { level, rungHit } = signals
      ? provenLevel(signals, row.levelRubric as LevelRubric)
      : { level: 0, rungHit: 0 }
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
      note:
        cache.notes[row.trackId] ??
        "No supporting evidence found on the resume.",
    }
  })
}

export interface RoleComparison {
  roleId: string
  name: string
  readiness: number
  openGaps: number
  /** Total serial weeks of gap work — the honest "how far away is this role" */
  totalWeeks: number
  isCurrent: boolean
}

/** Every role scored against the same cached evidence. The mockup's side panel, live. */
export async function compareRoles(
  cache: Cache,
  currentRoleId: string,
  weeklyHours: number
): Promise<RoleComparison[]> {
  const roles = await db
    .select()
    .from(schema.roles)
    .orderBy(schema.roles.sortOrder)

  return Promise.all(
    roles.map(async (role) => {
      const gauges = await scoreRole(cache, role.id, weeklyHours)
      const open = gauges.filter((g) => g.status === "open")
      return {
        roleId: role.id,
        name: role.name,
        readiness: readinessScore(gauges),
        openGaps: open.length,
        totalWeeks: open.reduce((n, g) => n + g.weeksToClose, 0),
        isCurrent: role.id === currentRoleId,
      }
    })
  )
}

/**
 * Re-targets a run at a different role (or new weekly hours): rewrites the
 * assessments, recommendations and roadmap through the same rankers and
 * scheduler the analysis used, and snapshots the new readiness.
 *
 * Mutates the run in place — a run means "this resume measured against this
 * role", and the student changed the second half of that sentence.
 */
export async function replanRole(opts: {
  studentId: string
  runId: string
  roleId: string
  weeklyHours: number
}): Promise<{ readiness: number; openGaps: number }> {
  const { studentId, runId, roleId, weeklyHours } = opts

  const cache = await getExtractCache(runId)
  if (!cache) {
    throw new Error(
      "This analysis predates instant re-scoring. Re-upload the resume once and switching becomes free."
    )
  }

  const gauges = await scoreRole(cache, roleId, weeklyHours)
  const readiness = readinessScore(gauges)

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
        .where(eq(schema.students.id, studentId)),
    ])

  const trackNames = Object.fromEntries(tracks.map((t) => [t.id, t.name]))
  const roleTrackIds = new Set(gauges.map((g) => g.trackId))

  const projects = rankProjects(
    projectRows.filter((p) => p.closesTrackIds.some((id) => roleTrackIds.has(id))),
    gauges,
    trackNames
  )
  const schedule = buildSchedule({
    totalWeeks: student[0]?.horizonWeeks ?? 14,
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
  const covered = new Set(projects.slice(0, 3).flatMap((p) => p.closesTrackIds))
  const certs = rankCerts(certRows, gauges, covered, trackNames)
  const questions = rankQuestions(
    questionRows.filter((q) => roleTrackIds.has(q.trackId)),
    gauges,
    trackNames
  )

  // ── Rewrite, oldest dependency first ───────────────────────────────────────
  await db
    .delete(schema.skillAssessments)
    .where(eq(schema.skillAssessments.runId, runId))
  await db
    .delete(schema.recommendedProjects)
    .where(eq(schema.recommendedProjects.runId, runId))
  await db
    .delete(schema.recommendedCerts)
    .where(eq(schema.recommendedCerts.runId, runId))
  await db
    .delete(schema.recommendedQuestions)
    .where(eq(schema.recommendedQuestions.runId, runId))

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

  const scheduledByProject = new Map(
    schedule.items.filter((i) => i.projectId).map((i) => [i.projectId!, i])
  )
  if (projects.length) {
    await db.insert(schema.recommendedProjects).values(
      projects.slice(0, 4).map((p) => ({
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
  if (certs.length) {
    await db.insert(schema.recommendedCerts).values(
      certs.map((c) => ({
        runId,
        certId: c.id,
        verdict: c.verdict,
        score: c.score,
        rank: c.rank,
        rationale: c.rationale,
      }))
    )
  }
  if (questions.length) {
    await db.insert(schema.recommendedQuestions).values(
      questions.map((q) => ({
        runId,
        questionId: q.id,
        isGapTrack: q.isGapTrack,
        rank: q.rank,
        score: q.score,
        coachNote: q.coachNote,
      }))
    )
  }

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
      totalWeeks: student[0]?.horizonWeeks ?? 14,
      weeklyHours,
      startDate: new Date().toISOString().slice(0, 10),
      isActive: true,
    })
    .returning()
  await db.insert(schema.roadmapItems).values(
    schedule.items.map((i) => ({
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
  if (schedule.notes.length) {
    await db.insert(schema.roadmapNotes).values(
      schedule.notes.map((n) => ({
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
    .set({ roleId })
    .where(eq(schema.analysisRuns.id, runId))

  await db
    .insert(schema.readinessSnapshots)
    .values({
      studentId,
      roleId,
      capturedOn: new Date().toISOString().slice(0, 10),
      readiness,
      perTrack: perTrackReadiness(gauges),
      source: "event",
    })
    .onConflictDoUpdate({
      target: [
        schema.readinessSnapshots.studentId,
        schema.readinessSnapshots.roleId,
        schema.readinessSnapshots.capturedOn,
      ],
      set: { readiness, perTrack: perTrackReadiness(gauges) },
    })

  return {
    readiness,
    openGaps: gauges.filter((g) => g.status === "open").length,
  }
}
