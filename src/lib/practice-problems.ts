import "server-only"

import { eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { getLatestRun } from "@/lib/analysis"
import {
  fetchLeetcodeTotals,
  syncLeetcodeSolves,
  type LeetcodeTotals,
} from "@/lib/leetcode"

/**
 * The LeetCode drill board: seeded problems ranked against the student's own
 * open gaps by the same weighted-gap arithmetic that ranks everything else.
 * Zero model calls — the catalog is hand-mapped and API-verified, the ranking
 * is arithmetic, and solving is a habit-trail mark that never moves readiness.
 */

export type DrillProblem = {
  id: string
  title: string
  url: string
  trackId: string
  trackName: string
  difficulty: 1 | 2 | 3
  pattern: string
  isGapTrack: boolean
  score: number
  solvedAt: Date | null
  /** 'leetcode' = a verified accepted submission from the connected account. */
  via: "manual" | "leetcode" | null
}

export type ProblemBoard = {
  problems: DrillProblem[]
  solvedCount: number
  gapTrackCount: number
  /** Present once the student has connected their LeetCode account. */
  leetcode: { username: string; totals: LeetcodeTotals | null } | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

export async function getProblemBoard(studentId: string): Promise<ProblemBoard> {
  // A connected account syncs on read: recent accepted submissions become
  // verified solves. Idempotent, and the underlying fetch is cached 15 min,
  // so most renders never touch LeetCode.
  const [student] = await db
    .select({ leetcodeUsername: schema.students.leetcodeUsername })
    .from(schema.students)
    .where(eq(schema.students.id, studentId))
  const username = student?.leetcodeUsername ?? null
  if (username) {
    await syncLeetcodeSolves(studentId, username).catch((err) =>
      console.error("[leetcode] sync failed:", err)
    )
  }

  const [catalog, attempts, run] = await Promise.all([
    db
      .select({
        id: schema.problemCatalog.id,
        title: schema.problemCatalog.title,
        trackId: schema.problemCatalog.trackId,
        difficulty: schema.problemCatalog.difficulty,
        pattern: schema.problemCatalog.pattern,
        trackName: schema.skillTracks.name,
      })
      .from(schema.problemCatalog)
      .innerJoin(
        schema.skillTracks,
        eq(schema.skillTracks.id, schema.problemCatalog.trackId)
      ),
    db
      .select()
      .from(schema.problemAttempts)
      .where(eq(schema.problemAttempts.studentId, studentId)),
    getLatestRun(studentId),
  ])

  const gauges = run
    ? await db
        .select({
          trackId: schema.skillAssessments.trackId,
          gap: schema.skillAssessments.gap,
          weight: schema.skillAssessments.weight,
          status: schema.skillAssessments.status,
        })
        .from(schema.skillAssessments)
        .where(eq(schema.skillAssessments.runId, run.id))
    : []
  const byTrack = new Map(gauges.map((g) => [g.trackId, g]))
  const solved = new Map(attempts.map((a) => [a.problemId, a]))

  const problems: DrillProblem[] = catalog
    .map((p) => {
      const gauge = byTrack.get(p.trackId)
      const isGapTrack = gauge?.status === "open"
      // The question-bank formula: gap tracks count double, and even a met
      // track keeps a floor so the list never empties for a strong student.
      const score = gauge
        ? round1((isGapTrack ? 2 : 1) * gauge.weight * Math.max(gauge.gap, 0.5))
        : 1
      return {
        id: p.id,
        title: p.title,
        url: `https://leetcode.com/problems/${p.id}/`,
        trackId: p.trackId,
        trackName: p.trackName,
        difficulty: p.difficulty as 1 | 2 | 3,
        pattern: p.pattern,
        isGapTrack,
        score,
        solvedAt: solved.get(p.id)?.solvedAt ?? null,
        via: (solved.get(p.id)?.via as "manual" | "leetcode" | undefined) ?? null,
      }
    })
    // Unsolved first, highest gap value first, easier first within a tie —
    // the next problem to open is always the top row.
    .sort((a, b) => {
      if (!!a.solvedAt !== !!b.solvedAt) return a.solvedAt ? 1 : -1
      return b.score - a.score || a.difficulty - b.difficulty
    })

  return {
    problems,
    solvedCount: solved.size,
    gapTrackCount: problems.filter((p) => p.isGapTrack && !p.solvedAt).length,
    leetcode: username
      ? { username, totals: await fetchLeetcodeTotals(username) }
      : null,
  }
}
