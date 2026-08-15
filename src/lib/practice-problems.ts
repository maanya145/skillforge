import "server-only"

import { eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { getLatestRun } from "@/lib/analysis"
import { fetchProblemsByTag } from "@/lib/leetcode"

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
  /** Curated rows carry a hand-written pattern; live-pool rows carry acRate. */
  pattern: string | null
  acRate: number | null
  isGapTrack: boolean
  score: number
  solvedAt: Date | null
}

/**
 * Which LeetCode topic tags honestly map to a track. Only tags whose problem
 * lists genuinely drill the track are here — no tag for testing or Linux
 * exists, so those tracks stay curated-only rather than pretending.
 */
const TRACK_TAGS: Record<string, string[]> = {
  dsa: ["dynamic-programming", "graph", "breadth-first-search"],
  concurrency: ["concurrency"],
  "sql-modelling": ["database"],
}
/** Live problems pulled per gap track. */
const POOL_PER_TRACK = 25

export type ProblemBoard = {
  problems: DrillProblem[]
  solvedCount: number
  gapTrackCount: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

export async function getProblemBoard(studentId: string): Promise<ProblemBoard> {
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

  // The question-bank formula: gap tracks count double, and even a met
  // track keeps a floor so the list never empties for a strong student.
  const scoreFor = (trackId: string) => {
    const gauge = byTrack.get(trackId)
    if (!gauge) return { score: 1, isGapTrack: false }
    const isGapTrack = gauge.status === "open"
    return {
      score: round1((isGapTrack ? 2 : 1) * gauge.weight * Math.max(gauge.gap, 0.5)),
      isGapTrack,
    }
  }

  const curatedRows: DrillProblem[] = catalog.map((p) => {
    const { score, isGapTrack } = scoreFor(p.trackId)
    return {
      id: p.id,
      title: p.title,
      url: `https://leetcode.com/problems/${p.id}/`,
      trackId: p.trackId,
      trackName: p.trackName,
      difficulty: p.difficulty as 1 | 2 | 3,
      pattern: p.pattern,
      acRate: null,
      isGapTrack,
      score,
      solvedAt: solved.get(p.id)?.solvedAt ?? null,
    }
  })

  // ── The live pool: LC's own problem lists for the open-gap tracks ─────────
  // Cached 15 min per tag; a fetch failure just means a shorter list.
  const trackNames = new Map(catalog.map((c) => [c.trackId, c.trackName]))
  const gapTracks = [...byTrack.values()]
    .filter((g) => g.status === "open" && TRACK_TAGS[g.trackId])
    .sort((a, b) => b.weight * b.gap - a.weight * a.gap)

  const seen = new Set(curatedRows.map((r) => r.id))
  const dynamicRows: DrillProblem[] = []
  for (const g of gapTracks) {
    const perTag = Math.ceil(POOL_PER_TRACK / TRACK_TAGS[g.trackId].length)
    const batches = await Promise.all(
      TRACK_TAGS[g.trackId].map((tag) => fetchProblemsByTag(tag, perTag))
    )
    const { score, isGapTrack } = scoreFor(g.trackId)
    for (const q of batches.flat()) {
      if (seen.has(q.slug)) continue
      seen.add(q.slug)
      dynamicRows.push({
        id: q.slug,
        title: q.title,
        url: `https://leetcode.com/problems/${q.slug}/`,
        trackId: g.trackId,
        trackName: trackNames.get(g.trackId) ?? g.trackId,
        difficulty: q.difficulty,
        pattern: null,
        acRate: q.acRate,
        isGapTrack,
        score,
        solvedAt: solved.get(q.slug)?.solvedAt ?? null,
      })
    }
  }

  const problems = [...curatedRows, ...dynamicRows]
    // Unsolved first, highest gap value first; curated rows outrank pool rows
    // at equal score (the pattern notes earn it); easier first within a tie.
    .sort((a, b) => {
      if (!!a.solvedAt !== !!b.solvedAt) return a.solvedAt ? 1 : -1
      if (b.score !== a.score) return b.score - a.score
      if ((a.pattern === null) !== (b.pattern === null)) return a.pattern ? -1 : 1
      return a.difficulty - b.difficulty
    })

  return {
    problems,
    solvedCount: solved.size,
    gapTrackCount: problems.filter((p) => p.isGapTrack && !p.solvedAt).length,
  }
}
