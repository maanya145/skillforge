import { createTool } from "@mastra/core/tools"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { db, schema } from "@/db/client"
import { getLatestRun, getSkillMap } from "@/lib/analysis"
import { getRoadmap, getRecommendations } from "@/lib/plan-queries"
import { getExtractCache, compareRoles } from "@/lib/replan"
import {
  lookUpConcept,
  searchRepositories,
  searchDiscussions,
} from "@/lib/lookup"
import { nextRung } from "@/lib/scoring/level"
import type { LevelRubric } from "@/lib/scoring/types"

/**
 * The mentor's tools.
 *
 * Built per-request with the signed-in student's id closed over — never taken
 * from tool input. A model that hallucinates a studentId therefore cannot
 * reach another student's data, because the parameter does not exist.
 *
 * Two families:
 *   · internal — read the student's own measured state. Fast, exact, and the
 *     reason the mentor can be specific instead of generic.
 *   · external — keyless web lookup (GitHub, Hacker News, Wikipedia, MDN) so
 *     the mentor can answer "where do I actually learn this" with real links
 *     rather than remembered ones.
 *
 * Tools return facts. The product rule still holds: no tool computes a level,
 * a gap or a readiness score — they read numbers TypeScript already derived.
 */
export function createMentorTools(studentId: string) {
  const skillMap = createTool({
    id: "get_skill_map",
    description:
      "The student's current skill map: readiness score, and every track with its proven level, the level the target role requires, the gap, and weeks to close. Use this whenever the answer depends on where they actually stand.",
    inputSchema: z.object({
      onlyOpenGaps: z
        .boolean()
        .default(false)
        .describe("Return only tracks that are still short of the requirement"),
    }),
    outputSchema: z.object({
      readiness: z.number().nullable(),
      targetRole: z.string().nullable(),
      tracks: z.array(
        z.object({
          track: z.string(),
          proven: z.number(),
          required: z.number(),
          gap: z.number(),
          weeksToClose: z.number(),
          status: z.string(),
          note: z.string(),
        })
      ),
    }),
    execute: async ({ onlyOpenGaps }) => {
      const run = await getLatestRun(studentId)
      if (!run)
        return { readiness: null, targetRole: null, tracks: [] }
      const map = await getSkillMap(run.id)
      if (!map) return { readiness: null, targetRole: null, tracks: [] }
      return {
        readiness: map.readiness,
        targetRole: map.roleId,
        tracks: map.gauges
          .filter((g) => (onlyOpenGaps ? g.status === "open" : true))
          .map((g) => ({
            track: g.name,
            proven: g.provenLevel,
            required: g.requiredLevel,
            gap: g.gap,
            weeksToClose: g.weeksToClose,
            status: g.status,
            note: g.note,
          })),
      }
    },
  })

  const explainTrack = createTool({
    id: "explain_track",
    description:
      "Everything behind ONE track's number: the rubric ladder it is scored against, which rung the student's evidence reached, and what the next rung requires. Use when the student asks why a number is what it is, or what would move it.",
    inputSchema: z.object({
      track: z
        .string()
        .describe("Track name or id, e.g. 'system design' or 'system-design'"),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      track: z.string().nullable(),
      proven: z.number().nullable(),
      required: z.number().nullable(),
      rungReached: z.string().nullable(),
      nextRung: z.string().nullable(),
      nextRungEvidence: z.string().nullable(),
      ladder: z.array(z.string()),
      note: z.string().nullable(),
    }),
    execute: async ({ track }) => {
      const empty = {
        found: false,
        track: null,
        proven: null,
        required: null,
        rungReached: null,
        nextRung: null,
        nextRungEvidence: null,
        ladder: [],
        note: null,
      }
      const run = await getLatestRun(studentId)
      if (!run) return empty

      const needle = track.toLowerCase().replace(/[^a-z]/g, "")
      const rows = await db
        .select({
          trackId: schema.skillAssessments.trackId,
          name: schema.skillTracks.name,
          rubric: schema.skillTracks.levelRubric,
          proven: schema.skillAssessments.provenLevel,
          required: schema.skillAssessments.requiredLevel,
          note: schema.skillAssessments.note,
        })
        .from(schema.skillAssessments)
        .innerJoin(
          schema.skillTracks,
          eq(schema.skillTracks.id, schema.skillAssessments.trackId)
        )
        .where(eq(schema.skillAssessments.runId, run.id))

      const row =
        rows.find((r) => r.trackId.replace(/[^a-z]/g, "") === needle) ??
        rows.find((r) => r.name.toLowerCase().replace(/[^a-z]/g, "").includes(needle)) ??
        rows.find((r) => needle.includes(r.trackId.replace(/[^a-z]/g, "")))
      if (!row) return empty

      const ladder = row.rubric as LevelRubric
      const reached = [...ladder]
        .sort((a, b) => b.level - a.level)
        .find((r) => row.proven >= r.level)
      const next = nextRung(row.proven, ladder)

      return {
        found: true,
        track: row.name,
        proven: row.proven,
        required: row.required,
        rungReached: reached?.label ?? "below the first rung",
        nextRung: next?.label ?? null,
        nextRungEvidence: next?.evidence ?? null,
        ladder: ladder.map((r) => `${r.label} — ${r.evidence}`),
        note: row.note,
      }
    },
  })

  const roadmap = createTool({
    id: "get_roadmap",
    description:
      "The student's scheduled plan: every item with its lane, week range and whether it is done. Use for 'what should I do this week' and any scheduling question.",
    inputSchema: z.object({
      week: z
        .number()
        .int()
        .optional()
        .describe("Only items active during this week number"),
    }),
    outputSchema: z.object({
      totalWeeks: z.number().nullable(),
      weeklyHours: z.number().nullable(),
      items: z.array(
        z.object({
          label: z.string(),
          detail: z.string(),
          lane: z.string(),
          startWeek: z.number(),
          endWeek: z.number(),
          status: z.string(),
        })
      ),
    }),
    execute: async ({ week }) => {
      const plan = await getRoadmap(studentId)
      if (!plan) return { totalWeeks: null, weeklyHours: null, items: [] }
      return {
        totalWeeks: plan.totalWeeks,
        weeklyHours: plan.weeklyHours,
        items: plan.items
          .filter((i) => (week ? i.startWeek <= week && i.endWeek >= week : true))
          .map((i) => ({
            label: i.label,
            detail: i.detail,
            lane: i.lane,
            startWeek: i.startWeek,
            endWeek: i.endWeek,
            status: i.status,
          })),
      }
    },
  })

  const recommendations = createTool({
    id: "get_recommendations",
    description:
      "The ranked projects, certification verdicts and interview questions chosen for this student, each with the reason it was chosen. Use for 'what should I build', 'is X certification worth it', 'what will they ask me'.",
    inputSchema: z.object({
      kind: z
        .enum(["projects", "certifications", "questions", "all"])
        .default("all"),
    }),
    outputSchema: z.object({
      projects: z.array(
        z.object({ title: z.string(), weeks: z.number(), why: z.string() })
      ),
      certifications: z.array(
        z.object({ name: z.string(), verdict: z.string(), why: z.string() })
      ),
      questions: z.array(
        z.object({ prompt: z.string(), topic: z.string(), isGapTrack: z.boolean() })
      ),
    }),
    execute: async ({ kind }) => {
      const run = await getLatestRun(studentId)
      const blank = { projects: [], certifications: [], questions: [] }
      if (!run) return blank
      const recs = await getRecommendations(run.id)
      return {
        projects:
          kind === "all" || kind === "projects"
            ? recs.projects.map((p) => ({
                title: p.title,
                weeks: p.effortWeeks,
                why: p.rationale,
              }))
            : [],
        certifications:
          kind === "all" || kind === "certifications"
            ? recs.certs.map((c) => ({
                name: c.name,
                verdict: c.verdict,
                why: c.rationale,
              }))
            : [],
        questions:
          kind === "all" || kind === "questions"
            ? recs.questions.map((q) => ({
                prompt: q.prompt,
                topic: q.topic,
                isGapTrack: q.isGapTrack,
              }))
            : [],
      }
    },
  })

  const compare = createTool({
    id: "compare_target_roles",
    description:
      "Score the student's SAME evidence against every role's benchmark, to answer 'would I be better off targeting X'. Returns readiness, open gaps and total weeks of work per role.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      roles: z.array(
        z.object({
          role: z.string(),
          readiness: z.number(),
          openGaps: z.number(),
          totalWeeks: z.number(),
          isCurrent: z.boolean(),
        })
      ),
    }),
    execute: async () => {
      const run = await getLatestRun(studentId)
      if (!run) return { roles: [] }
      const cache = await getExtractCache(run.id)
      if (!cache) return { roles: [] }
      const [student] = await db
        .select({ weeklyHours: schema.students.weeklyHours })
        .from(schema.students)
        .where(eq(schema.students.id, studentId))
      const rows = await compareRoles(
        cache,
        run.roleId,
        student?.weeklyHours ?? 9
      )
      return {
        roles: rows.map((r) => ({
          role: r.name,
          readiness: r.readiness,
          openGaps: r.openGaps,
          totalWeeks: r.totalWeeks,
          isCurrent: r.isCurrent,
        })),
      }
    },
  })

  // ── External lookup ────────────────────────────────────────────────────────

  const findResources = createTool({
    id: "find_learning_resources",
    description:
      "Search the web for real, current learning material on a topic: open-source repositories worth reading and engineering discussions about it. Use when the student asks where to learn something, or for examples of a pattern. Always cite the links you get back.",
    inputSchema: z.object({
      topic: z
        .string()
        .describe("What to search for, e.g. 'redis rate limiter' or 'docker multi-stage build'"),
    }),
    outputSchema: z.object({
      repositories: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          url: z.string(),
          stars: z.number(),
          language: z.string().nullable(),
        })
      ),
      discussions: z.array(
        z.object({
          title: z.string(),
          url: z.string(),
          points: z.number(),
          year: z.number().nullable(),
        })
      ),
    }),
    execute: async ({ topic }) => {
      const [repositories, discussions] = await Promise.all([
        searchRepositories(topic),
        searchDiscussions(topic),
      ])
      return {
        repositories,
        discussions: discussions.map((d) => ({
          title: d.title,
          url: d.url,
          points: d.points,
          year: d.year,
        })),
      }
    },
  })

  const defineConcept = createTool({
    id: "look_up_concept",
    description:
      "Look up an authoritative definition of a technical term from Wikipedia or MDN. Use when the student asks what something is, so the answer is sourced rather than recalled.",
    inputSchema: z.object({
      term: z.string().describe("The term to define, e.g. 'cache invalidation'"),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      title: z.string().nullable(),
      summary: z.string().nullable(),
      url: z.string().nullable(),
      source: z.string().nullable(),
    }),
    execute: async ({ term }) => {
      const result = await lookUpConcept(term)
      if (!result)
        return { found: false, title: null, summary: null, url: null, source: null }
      return {
        found: true,
        title: result.title,
        summary: result.summary,
        url: result.url,
        source: result.source,
      }
    },
  })

  const logStudy = createTool({
    id: "log_study_session",
    description:
      "Record study time the student reports in conversation. Builds their activity trail. Does NOT move readiness — only completing a roadmap item does that, and only they can do that from the Roadmap screen.",
    inputSchema: z.object({
      minutes: z.number().int().min(5).max(600),
      topic: z.string().max(60).optional(),
    }),
    outputSchema: z.object({ logged: z.number(), totalToday: z.number() }),
    execute: async ({ minutes, topic }) => {
      const day = new Date().toISOString().slice(0, 10)
      const [existing] = await db
        .select()
        .from(schema.studyLog)
        .where(
          and(
            eq(schema.studyLog.studentId, studentId),
            eq(schema.studyLog.day, day)
          )
        )
      const total = (existing?.minutes ?? 0) + minutes
      const level =
        total >= 180 ? 4 : total >= 120 ? 3 : total >= 60 ? 2 : total > 0 ? 1 : 0

      await db
        .insert(schema.studyLog)
        .values({ studentId, day, minutes: total, level })
        .onConflictDoUpdate({
          target: [schema.studyLog.studentId, schema.studyLog.day],
          set: { minutes: total, level },
        })
      await db.insert(schema.progressEvents).values({
        studentId,
        type: "study_session",
        minutes,
        levelDelta: 0,
        headline: `Logged ${minutes} minutes${topic ? ` on ${topic}` : ""}.`,
        body: "Recorded from a mentor conversation.",
      })
      return { logged: minutes, totalToday: total }
    },
  })

  // Keys, not ids, are what Mastra reports as the tool name in stream chunks —
  // so they must match TOOL_LABELS exactly or the UI shows raw identifiers.
  return {
    get_skill_map: skillMap,
    explain_track: explainTrack,
    get_roadmap: roadmap,
    get_recommendations: recommendations,
    compare_target_roles: compare,
    find_learning_resources: findResources,
    look_up_concept: defineConcept,
    log_study_session: logStudy,
  }
}
