/**
 * Every seeded LeetCode slug, verified against LeetCode's own GraphQL API:
 * the problem exists, our difficulty label matches theirs, and it is not
 * paywalled. A drill list with a dead or premium link is worse than none.
 *
 *   npm run check:problems
 */
import { PROBLEM_CATALOG } from "../src/db/seed/catalogs"

const DIFF: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 }
let failed = 0

for (const p of PROBLEM_CATALOG) {
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" },
    body: JSON.stringify({
      query: `query{question(titleSlug:"${p.id}"){title difficulty isPaidOnly}}`,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = (await res.json()) as {
    data?: { question: { title: string; difficulty: string; isPaidOnly: boolean } | null }
  }
  const q = data.data?.question
  const problems: string[] = []
  if (!q) problems.push("slug does not exist")
  else {
    if (q.isPaidOnly) problems.push("PREMIUM — paywalled for students")
    if (DIFF[q.difficulty] !== p.difficulty)
      problems.push(`difficulty is ${q.difficulty}, seeded as ${p.difficulty}`)
  }
  if (problems.length) {
    failed++
    console.error(`✗ ${p.id}: ${problems.join("; ")}`)
  } else {
    console.log(`✓ ${p.id} (${q!.difficulty})`)
  }
  // Be polite to their API.
  await new Promise((r) => setTimeout(r, 250))
}

console.log(`\n${PROBLEM_CATALOG.length - failed}/${PROBLEM_CATALOG.length} verified`)
process.exit(failed ? 1 : 0)
