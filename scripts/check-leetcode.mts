/**
 * The drill pool's one external dependency: LeetCode's public problem list
 * by topic tag. Free problems, sane shapes, no auth.
 *
 *   npm run check:leetcode
 */
import { fetchProblemsByTag } from "@/lib/leetcode"

let failed = 0
const assert = (ok: boolean, label: string) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`)
  if (!ok) failed++
}

const pool = await fetchProblemsByTag("dynamic-programming", 20)
assert(pool.length >= 15, `tag pool (${pool.length} free DP problems)`)
assert(
  pool.every((p) => /^[a-z0-9-]+$/.test(p.slug) && p.acRate > 0 && p.acRate <= 100),
  "pool entries have sane slugs and acceptance rates"
)
assert((await fetchProblemsByTag("no such tag!!")).length === 0, "bad tag → empty")

process.exit(failed ? 1 : 0)
