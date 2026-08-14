import "server-only"

import { eq } from "drizzle-orm"

import { db, schema } from "@/db"

/**
 * A news feed built from the student's own measured gaps.
 *
 * The point of difference from every other feed a student reads: this one is
 * not ranked by what is popular, it is ranked by what is popular *and*
 * relevant to a track they are actually short on. A Kubernetes thread matters
 * to someone with an open Docker gap and is noise to someone at the bar.
 *
 * No model call anywhere. Freshness and popularity are numbers Hacker News
 * already gives us, relevance is a track match, and the weighting is the same
 * weight × gap the skill map uses. That keeps the feed instant and free, which
 * matters for something a student refreshes.
 */

/**
 * Search terms per track, hand-authored and versioned like the benchmark.
 *
 * Querying Hacker News with the track's display name does not work, and the
 * failure is loud once you look: "Testing" full-text matches any story with
 * the word in it, which surfaced a Navy aircraft-carrier story and three
 * datacentre outages under a student's testing gap. Multi-word technical
 * phrases are specific enough to mean something.
 *
 * Keyed by track id so a rename cannot silently detach the queries.
 */
const TRACK_QUERIES: Record<string, string[]> = {
  "system-design": ["system design", "distributed systems", "scaling architecture"],
  "docker-cicd": ["docker container", "kubernetes", "continuous integration"],
  testing: ["unit testing", "test driven development", "integration tests"],
  concurrency: ["concurrency", "async runtime", "race condition"],
  dsa: ["algorithms", "dynamic programming", "graph algorithm"],
  "sql-modelling": ["postgres", "sql query", "data modelling"],
  "api-design": ["rest api design", "api versioning", "graphql"],
  "linux-shell": ["linux kernel", "shell scripting", "command line tool"],
  observability: ["observability", "distributed tracing", "opentelemetry"],
  caching: ["caching", "redis", "cache invalidation"],
  "security-basics": ["application security", "authentication", "vulnerability"],
  "version-control": ["git", "monorepo", "code review"],
}

const HN_ENDPOINT = "https://hn.algolia.com/api/v1/search_by_date"
/** Shared cache. A feed that refetched per view would rate-limit and add nothing. */
const REVALIDATE_SECONDS = 900
const PER_QUERY = 6
const MAX_ITEMS = 24
/** Below this, a story is noise even if it matches a track. */
const MIN_POINTS = 5

export type FeedItem = {
  id: string
  title: string
  url: string
  source: string
  points: number
  comments: number
  publishedAt: string
  ageHours: number
  /** Open tracks this story touches — why it is in the feed at all. */
  trackIds: string[]
  trackNames: string[]
  score: number
  discussionUrl: string
}

type Hit = {
  objectID: string
  title: string | null
  story_title: string | null
  url: string | null
  story_url: string | null
  points: number | null
  num_comments: number | null
  created_at: string | null
}

/**
 * Hacker News, filtered to a track's vocabulary.
 *
 * `search_by_date` rather than relevance ranking: this is a feed, so recency is
 * the primary axis and our own scoring re-sorts what comes back.
 */
async function fetchTrackStories(query: string): Promise<Hit[]> {
  try {
    const response = await fetch(
      `${HN_ENDPOINT}?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${PER_QUERY}&numericFilters=points>${MIN_POINTS}`,
      {
        signal: AbortSignal.timeout(8_000),
        next: { revalidate: REVALIDATE_SECONDS },
      }
    )
    if (!response.ok) return []
    const data = (await response.json()) as { hits?: Hit[] }
    return data.hits ?? []
  } catch (err) {
    console.error(`[feed] "${query}" failed:`, err)
    return []
  }
}

/**
 * Recency decay, halving roughly every three days.
 *
 * Gentler than Hacker News' own gravity because this feed is read weekly, not
 * hourly — a strong piece from Tuesday should still be visible on Friday.
 */
function freshness(ageHours: number) {
  return 1 / (1 + ageHours / 72)
}

export async function getFeed(runId: string): Promise<FeedItem[]> {
  const rows = await db
    .select({
      trackId: schema.skillAssessments.trackId,
      name: schema.skillTracks.name,
      gap: schema.skillAssessments.gap,
      weight: schema.skillAssessments.weight,
      status: schema.skillAssessments.status,
      description: schema.skillTracks.description,
    })
    .from(schema.skillAssessments)
    .innerJoin(
      schema.skillTracks,
      eq(schema.skillTracks.id, schema.skillAssessments.trackId)
    )
    .where(eq(schema.skillAssessments.runId, runId))

  // Open gaps first, biggest first. A closed track still earns a small weight
  // so the feed does not go silent once someone is doing well.
  const tracks = rows
    .map((r) => ({
      ...r,
      relevance: r.status === "open" ? r.weight * r.gap : r.weight * 0.4,
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5)

  if (tracks.length === 0) return []

  // A track with no authored queries is skipped rather than falling back to
  // its display name — that fallback is exactly what produced the junk.
  const searches = tracks.flatMap((t) =>
    (TRACK_QUERIES[t.trackId] ?? []).map((query) => ({ track: t, query }))
  )

  const batches = await Promise.all(
    searches.map(async ({ track, query }) => ({
      track,
      hits: await fetchTrackStories(query),
    }))
  )

  const now = Date.now()
  const byUrl = new Map<string, FeedItem>()

  for (const { track, hits } of batches) {
    for (const hit of hits) {
      const title = hit.title ?? hit.story_title
      const link =
        hit.url ?? hit.story_url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`
      if (!title || !hit.created_at) continue

      const ageHours = Math.max(
        0,
        (now - new Date(hit.created_at).getTime()) / 3_600_000
      )
      const points = hit.points ?? 0
      const contribution =
        track.relevance * Math.log10(points + 10) * freshness(ageHours)

      const existing = byUrl.get(link)
      if (existing) {
        // A story matching two open tracks is more relevant, not duplicated.
        if (!existing.trackIds.includes(track.trackId)) {
          existing.trackIds.push(track.trackId)
          existing.trackNames.push(track.name)
          existing.score = Math.round((existing.score + contribution) * 10) / 10
        }
        continue
      }

      let source: string
      try {
        source = new URL(link).hostname.replace(/^www\./, "")
      } catch {
        continue
      }

      byUrl.set(link, {
        id: hit.objectID,
        title,
        url: link,
        source,
        points,
        comments: hit.num_comments ?? 0,
        publishedAt: hit.created_at,
        ageHours: Math.round(ageHours),
        trackIds: [track.trackId],
        trackNames: [track.name],
        score: Math.round(contribution * 10) / 10,
        discussionUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      })
    }
  }

  return [...byUrl.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ITEMS)
}

/** "3h ago" / "2d ago" — a feed needs age at a glance. */
export function relativeAge(hours: number): string {
  if (hours < 1) return "just now"
  if (hours < 24) return `${Math.round(hours)}h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? "yesterday" : `${days}d ago`
}
