import "server-only"

import { and, eq } from "drizzle-orm"

import { db, schema } from "@/db"

/**
 * The LeetCode account link.
 *
 * LeetCode's public GraphQL exposes two things about any username with no
 * auth: solved totals by difficulty, and the ~20 most recent ACCEPTED
 * submissions. The second is the valuable one — an accepted submission is
 * *verified* evidence a problem was solved, which beats a checkbox someone
 * ticked. Sync cross-references those slugs against our seeded catalog and
 * marks matches as solved with `via: 'leetcode'`.
 *
 * Honesty constraints, in both directions:
 *  - Verified solves still never move readiness — a drill is a drill.
 *  - The recent list is a window, not history. Older solves stay manual;
 *    the UI never claims "everything you've ever solved".
 */

const ENDPOINT = "https://leetcode.com/graphql"
/** LC data changes slowly; a shared 15-minute cache is plenty. */
const REVALIDATE_SECONDS = 900

export type LeetcodeTotals = {
  all: number
  easy: number
  medium: number
  hard: number
}

async function gql<T>(query: string): Promise<T | null> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (SkillForge drill sync)",
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch (err) {
    console.error("[leetcode] gql failed:", err)
    return null
  }
}

/** Usernames are attacker-supplied and end up inside a GraphQL string. */
export function validUsername(name: string): boolean {
  return /^[A-Za-z0-9_-]{1,30}$/.test(name)
}

/** Solved totals, or null when the user doesn't exist or LC is unreachable. */
export async function fetchLeetcodeTotals(
  username: string
): Promise<LeetcodeTotals | null> {
  if (!validUsername(username)) return null
  const data = await gql<{
    data?: {
      matchedUser: {
        submitStatsGlobal: {
          acSubmissionNum: { difficulty: string; count: number }[]
        }
      } | null
    }
  }>(
    `query{matchedUser(username:"${username}"){submitStatsGlobal{acSubmissionNum{difficulty count}}}}`
  )
  const nums = data?.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum
  if (!nums) return null
  const by = Object.fromEntries(nums.map((n) => [n.difficulty, n.count]))
  return {
    all: by.All ?? 0,
    easy: by.Easy ?? 0,
    medium: by.Medium ?? 0,
    hard: by.Hard ?? 0,
  }
}

/** The most recent accepted submissions — slugs, titles and when. */
export async function fetchRecentAccepted(
  username: string
): Promise<{ slug: string; title: string; solvedAt: Date }[]> {
  if (!validUsername(username)) return []
  const data = await gql<{
    data?: {
      recentAcSubmissionList:
        | { titleSlug: string; title: string; timestamp: string }[]
        | null
    }
  }>(
    `query{recentAcSubmissionList(username:"${username}",limit:20){titleSlug title timestamp}}`
  )
  return (data?.data?.recentAcSubmissionList ?? []).map((s) => ({
    slug: s.titleSlug,
    title: s.title,
    solvedAt: new Date(Number(s.timestamp) * 1000),
  }))
}

export type TagProblem = {
  slug: string
  title: string
  difficulty: 1 | 2 | 3
  /** LeetCode's global acceptance rate, 0–100. */
  acRate: number
}

const DIFF_NUM: Record<string, 1 | 2 | 3> = { Easy: 1, Medium: 2, Hard: 3 }

/**
 * Free problems for a LeetCode topic tag — how the drill pool grows past the
 * curated rows. LC's default ordering is by problem number, which correlates
 * with how canonical a problem is; we take the front of that list rather than
 * inventing our own popularity metric.
 */
export async function fetchProblemsByTag(
  tag: string,
  limit = 30
): Promise<TagProblem[]> {
  if (!/^[a-z0-9-]{2,40}$/.test(tag)) return []
  const data = await gql<{
    data?: {
      list: {
        data: {
          title: string
          titleSlug: string
          difficulty: string
          acRate: number
          isPaidOnly: boolean
        }[]
      } | null
    }
  }>(
    `query{list:questionList(categorySlug:"",limit:${Math.min(limit * 2, 100)},skip:0,filters:{tags:["${tag}"]}){data{title titleSlug difficulty acRate isPaidOnly}}}`
  )
  return (data?.data?.list?.data ?? [])
    .filter((q) => !q.isPaidOnly && DIFF_NUM[q.difficulty])
    .slice(0, limit)
    .map((q) => ({
      slug: q.titleSlug,
      title: q.title,
      difficulty: DIFF_NUM[q.difficulty],
      acRate: Math.round(q.acRate),
    }))
}

/**
 * Pull the recent accepted list and mark catalog matches as verified solves.
 * Idempotent — an already-marked problem upgrades to 'leetcode' at most once,
 * and only newly verified solves emit a progress event. Returns how many.
 */
export async function syncLeetcodeSolves(
  studentId: string,
  username: string
): Promise<number> {
  const recent = await fetchRecentAccepted(username)
  if (recent.length === 0) return 0

  // EVERY accepted submission is recorded — the visible history the totals
  // number only hints at. Progress-feed events stay reserved for catalog
  // drills, so connecting an active account doesn't flood the feed.
  const catalog = await db
    .select({ id: schema.problemCatalog.id })
    .from(schema.problemCatalog)
  const curated = new Set(catalog.map((c) => c.id))

  const existing = await db
    .select()
    .from(schema.problemAttempts)
    .where(eq(schema.problemAttempts.studentId, studentId))
  const byProblem = new Map(existing.map((a) => [a.problemId, a]))

  let newlyVerified = 0
  for (const m of recent) {
    const current = byProblem.get(m.slug)
    if (current?.via === "leetcode") continue

    if (current) {
      // Manual mark upgrades to verified; the timestamp becomes LC's.
      await db
        .update(schema.problemAttempts)
        .set({ via: "leetcode", solvedAt: m.solvedAt, title: m.title })
        .where(
          and(
            eq(schema.problemAttempts.studentId, studentId),
            eq(schema.problemAttempts.problemId, m.slug)
          )
        )
      newlyVerified++
      continue
    }

    await db.insert(schema.problemAttempts).values({
      studentId,
      problemId: m.slug,
      title: m.title,
      solvedAt: m.solvedAt,
      via: "leetcode",
    })
    newlyVerified++
    if (curated.has(m.slug)) {
      await db.insert(schema.progressEvents).values({
        studentId,
        type: "problem_solved",
        levelDelta: 0,
        headline: `Solved ${m.title} on LeetCode — verified.`,
        body: "Pulled from your connected account. Drills build the habit trail; only closed gaps move readiness.",
        metadata: { problemId: m.slug, via: "leetcode" },
      })
    }
  }
  return newlyVerified
}
