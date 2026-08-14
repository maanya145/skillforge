import "server-only"

import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { db, schema } from "@/db"
import { exaSearch, type ExaResult } from "@/lib/discovery/exa"
import { scoutAgent } from "@/mastra/agents/scout"

/**
 * Find courses and project ideas on the open web for a student's open gaps.
 *
 * The shape here is the same contract the rest of the product runs on:
 *
 *   TypeScript picks the gaps  →  TypeScript writes the queries
 *   →  Exa searches            →  the model CLASSIFIES what came back
 *   →  TypeScript validates, scores and ranks
 *
 * The model never sees a weight, never sees a readiness number, and never
 * decides an ordering. It converts prose into a typed candidate; every number
 * attached to that candidate afterwards is arithmetic over the same seeded
 * benchmark the skill map uses.
 */

/** How many open gaps to search for. Beyond this the tail is not worth the latency. */
const MAX_GAPS = 3
/** Results per query. Exa's ranking is good; depth adds noise, not signal. */
const RESULTS_PER_QUERY = 6
/** Rows kept per run. A student will not read more than this. */
const MAX_KEPT = 12

const round1 = (n: number) => Math.round(n * 10) / 10

const candidateSchema = z.object({
  results: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      accepted: z.boolean(),
      kind: z.enum(["course", "project"]).nullable(),
      closesTrackIds: z.array(z.string()),
      effortWeeks: z.number().int().nullable(),
      summary: z.string(),
      costNote: z.string(),
    })
  ),
})

type Gap = {
  trackId: string
  name: string
  provenLevel: number
  requiredLevel: number
  gap: number
  weight: number
}

/**
 * Queries are generated, not model-written.
 *
 * Exa rewards a description of the ideal page over keywords, so each gap gets
 * two: one for structured learning, one for something to build. Naming the
 * student's actual level keeps beginner material away from a near-competent
 * track, which is the single biggest cause of useless recommendations.
 */
function queriesFor(gap: Gap): { query: string; kind: "course" | "project" }[] {
  const stage =
    gap.provenLevel < 2
      ? "for a complete beginner"
      : gap.provenLevel < 5
        ? "for someone with basic hands-on experience"
        : "for someone already competent, going deeper"

  return [
    {
      query: `a free, practical online course or tutorial series teaching ${gap.name} ${stage}, aimed at a software engineering student`,
      kind: "course",
    },
    {
      query: `a specific buildable software project that would prove real ${gap.name} skill on a portfolio, ${stage}, with a write-up of how it was built`,
      kind: "project",
    },
  ]
}

export type DiscoveryOutcome = {
  found: number
  searched: number
  rejected: number
  message: string
}

export async function discoverForRun({
  studentId,
  runId,
}: {
  studentId: string
  runId: string
}): Promise<DiscoveryOutcome> {
  // ── The gaps, straight from the measured assessment ───────────────────────
  const rows = await db
    .select({
      trackId: schema.skillAssessments.trackId,
      name: schema.skillTracks.name,
      provenLevel: schema.skillAssessments.provenLevel,
      requiredLevel: schema.skillAssessments.requiredLevel,
      gap: schema.skillAssessments.gap,
      weight: schema.skillAssessments.weight,
      status: schema.skillAssessments.status,
    })
    .from(schema.skillAssessments)
    .innerJoin(
      schema.skillTracks,
      eq(schema.skillTracks.id, schema.skillAssessments.trackId)
    )
    .where(eq(schema.skillAssessments.runId, runId))

  const openGaps: Gap[] = rows
    .filter((r) => r.status === "open")
    .sort((a, b) => b.weight * b.gap - a.weight * a.gap)
    .slice(0, MAX_GAPS)

  if (openGaps.length === 0) {
    return {
      found: 0,
      searched: 0,
      rejected: 0,
      message: "No open gaps to search for — every track is at or above the bar.",
    }
  }

  // The closed vocabulary the model may map onto. Only the tracks actually
  // measured on this run, so it cannot attach a course to a track we never
  // scored.
  const trackNames = new Map(rows.map((r) => [r.trackId, r.name]))
  const validTrackIds = new Set(rows.map((r) => r.trackId))
  const gapByTrack = new Map(rows.map((r) => [r.trackId, r]))

  // ── Search ────────────────────────────────────────────────────────────────
  const searches = openGaps.flatMap(queriesFor)
  const batches = await Promise.all(
    searches.map(async (s) => ({
      ...s,
      results: await exaSearch(s.query, RESULTS_PER_QUERY),
    }))
  )

  const seen = new Set<string>()
  const pool: (ExaResult & { query: string })[] = []
  for (const batch of batches) {
    for (const result of batch.results) {
      const key = result.url.replace(/[#?].*$/, "").replace(/\/$/, "")
      if (seen.has(key)) continue
      seen.add(key)
      pool.push({ ...result, query: batch.query })
    }
  }

  if (pool.length === 0) {
    return {
      found: 0,
      searched: searches.length,
      rejected: 0,
      message: "Search returned nothing usable. Try again in a moment.",
    }
  }

  // ── Classify ──────────────────────────────────────────────────────────────
  const trackList = [...validTrackIds]
    .map((id) => `${id} — ${trackNames.get(id)}`)
    .join("\n")

  const prompt = `SKILL TRACK IDS YOU MAY USE
${trackList}

SEARCH RESULTS
${pool
  .map(
    (r, i) =>
      `[${i}] ${r.title}\nURL: ${r.url}\n${r.snippet.slice(0, 600) || "(no extract available)"}`
  )
  .join("\n\n")}`

  let classified: z.infer<typeof candidateSchema>
  try {
    const result = await scoutAgent.generate(prompt, {
      structuredOutput: { schema: candidateSchema },
    })
    classified = result.object ?? { results: [] }
  } catch (err) {
    console.error("[discovery] classification failed:", err)
    return {
      found: 0,
      searched: searches.length,
      rejected: 0,
      message: "Could not read the search results. Try again.",
    }
  }

  // ── Validate and score — no model involvement past this line ──────────────
  let rejected = 0
  const scored = classified.results
    .map((c) => {
      const source = pool[c.index]
      if (!source || !c.accepted || !c.kind) {
        rejected++
        return null
      }

      // Post-validate against the seeded vocabulary. An id the model invented
      // would otherwise attach a course to a track that does not exist.
      const tracks = c.closesTrackIds.filter((id) => validTrackIds.has(id))
      const open = tracks.filter((id) => gapByTrack.get(id)?.status === "open")
      if (open.length === 0) {
        rejected++
        return null
      }

      // The same arithmetic that ranks the seeded catalog: how many weighted
      // readiness points this touches, per week of effort.
      const points = open.reduce((n, id) => {
        const g = gapByTrack.get(id)!
        return n + g.weight * g.gap
      }, 0)
      const effortWeeks = c.effortWeeks
        ? Math.max(1, Math.min(12, c.effortWeeks))
        : null
      const score = round1(points / Math.max(1, effortWeeks ?? 2))

      const names = open.map((id) => trackNames.get(id) ?? id)
      let host: string
      try {
        host = new URL(source.url).hostname.replace(/^www\./, "")
      } catch {
        rejected++
        return null
      }

      return {
        studentId,
        runId,
        kind: c.kind,
        title: source.title.slice(0, 200),
        url: source.url,
        source: host,
        summary: c.summary.slice(0, 400),
        closesTrackIds: open,
        effortWeeks,
        costNote: c.costNote.slice(0, 60),
        score,
        rank: 0,
        rationale: `Touches ${names.join(" and ")} — worth ${round1(points)} weighted gap points${
          effortWeeks ? ` for about ${effortWeeks} week${effortWeeks === 1 ? "" : "s"}` : ""
        }. Found on the open web, so judge the source yourself.`,
        sourceQuery: source.query,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_KEPT)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  if (scored.length === 0) {
    return {
      found: 0,
      searched: searches.length,
      rejected,
      message: `Searched ${searches.length} queries and rejected everything that came back — nothing was a genuine match for your open gaps.`,
    }
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  // Clear this run's previous discoveries so a refresh replaces rather than
  // accumulates; the unique index handles the same URL arriving from a
  // different run.
  await db
    .delete(schema.discoveredResources)
    .where(
      and(
        eq(schema.discoveredResources.studentId, studentId),
        eq(schema.discoveredResources.runId, runId)
      )
    )

  for (const row of scored) {
    await db
      .insert(schema.discoveredResources)
      .values(row)
      .onConflictDoUpdate({
        target: [
          schema.discoveredResources.studentId,
          schema.discoveredResources.url,
        ],
        set: {
          runId: row.runId,
          kind: row.kind,
          title: row.title,
          summary: row.summary,
          closesTrackIds: row.closesTrackIds,
          effortWeeks: row.effortWeeks,
          costNote: row.costNote,
          score: row.score,
          rank: row.rank,
          rationale: row.rationale,
          sourceQuery: row.sourceQuery,
          fetchedAt: new Date(),
        },
      })
  }

  return {
    found: scored.length,
    searched: searches.length,
    rejected,
    message: `Found ${scored.length} resource${scored.length === 1 ? "" : "s"} for your top ${openGaps.length} gap${openGaps.length === 1 ? "" : "s"}.`,
  }
}

/** What the Practice screen renders. */
export async function getDiscoveries(studentId: string, runId: string) {
  return db
    .select()
    .from(schema.discoveredResources)
    .where(
      and(
        eq(schema.discoveredResources.studentId, studentId),
        eq(schema.discoveredResources.runId, runId)
      )
    )
    .orderBy(schema.discoveredResources.rank)
}
