import "server-only"

/**
 * LeetCode's public problem lists, by topic tag — what lets the drill pool
 * grow past the curated catalog. Free problems only; no account, no auth.
 */

const ENDPOINT = "https://leetcode.com/graphql"
/** LC data changes slowly; a shared 15-minute cache is plenty. */
const REVALIDATE_SECONDS = 900

async function gql<T>(query: string): Promise<T | null> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (SkillForge drill pool)",
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

export type TagProblem = {
  slug: string
  title: string
  difficulty: 1 | 2 | 3
  /** LeetCode's global acceptance rate, 0–100. */
  acRate: number
}

const DIFF_NUM: Record<string, 1 | 2 | 3> = { Easy: 1, Medium: 2, Hard: 3 }

/**
 * Free problems for a topic tag. LC's default ordering is by problem number,
 * which correlates with how canonical a problem is; we take the front of that
 * list rather than inventing our own popularity metric.
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
