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

/** The most recent accepted submissions — slugs and when. */
export async function fetchRecentAccepted(
  username: string
): Promise<{ slug: string; solvedAt: Date }[]> {
  if (!validUsername(username)) return []
  const data = await gql<{
    data?: {
      recentAcSubmissionList: { titleSlug: string; timestamp: string }[] | null
    }
  }>(
    `query{recentAcSubmissionList(username:"${username}",limit:20){titleSlug timestamp}}`
  )
  return (data?.data?.recentAcSubmissionList ?? []).map((s) => ({
    slug: s.titleSlug,
    solvedAt: new Date(Number(s.timestamp) * 1000),
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

  const catalog = await db
    .select({ id: schema.problemCatalog.id, title: schema.problemCatalog.title })
    .from(schema.problemCatalog)
  const titles = new Map(catalog.map((c) => [c.id, c.title]))
  const matches = recent.filter((r) => titles.has(r.slug))
  if (matches.length === 0) return 0

  const existing = await db
    .select()
    .from(schema.problemAttempts)
    .where(eq(schema.problemAttempts.studentId, studentId))
  const byProblem = new Map(existing.map((a) => [a.problemId, a]))

  let newlyVerified = 0
  for (const m of matches) {
    const current = byProblem.get(m.slug)
    if (current?.via === "leetcode") continue

    if (current) {
      // Manual mark upgrades to verified; the timestamp becomes LC's.
      await db
        .update(schema.problemAttempts)
        .set({ via: "leetcode", solvedAt: m.solvedAt })
        .where(
          and(
            eq(schema.problemAttempts.studentId, studentId),
            eq(schema.problemAttempts.problemId, m.slug)
          )
        )
      continue
    }

    await db.insert(schema.problemAttempts).values({
      studentId,
      problemId: m.slug,
      solvedAt: m.solvedAt,
      via: "leetcode",
    })
    await db.insert(schema.progressEvents).values({
      studentId,
      type: "problem_solved",
      levelDelta: 0,
      headline: `Solved ${titles.get(m.slug)} on LeetCode — verified.`,
      body: "Pulled from your connected account. Drills build the habit trail; only closed gaps move readiness.",
      metadata: { problemId: m.slug, via: "leetcode" },
    })
    newlyVerified++
  }
  return newlyVerified
}
