/**
 * LeetCode's public GraphQL, exercised the way the account link uses it:
 * totals for a real account, recent accepted list shape, and a clean null
 * for a nonexistent user.
 *
 *   npm run check:leetcode
 */
import {
  fetchLeetcodeTotals,
  fetchRecentAccepted,
  validUsername,
} from "@/lib/leetcode"

let failed = 0
const assert = (ok: boolean, label: string) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`)
  if (!ok) failed++
}

const totals = await fetchLeetcodeTotals("lee215")
assert(!!totals && totals.all > 500, `lee215 totals (${totals?.all ?? "null"} solved)`)
assert(
  !!totals && totals.easy + totals.medium + totals.hard === totals.all,
  "difficulty split sums to the total"
)

const recent = await fetchRecentAccepted("lee215")
assert(recent.length > 0, `recent accepted list (${recent.length} entries)`)
assert(
  recent.every((r) => r.slug.length > 0 && r.solvedAt.getTime() > 1_500_000_000_000),
  "every entry has a slug and a sane timestamp"
)

assert((await fetchLeetcodeTotals("no-such-user-zzz-999")) === null, "unknown user → null")
assert(!validUsername("x); drop table"), "injection-shaped username rejected")
assert(validUsername("lee215"), "normal username accepted")

process.exit(failed ? 1 : 0)
