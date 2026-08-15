/**
 * Are the job boards still reachable, and do they still carry engineering
 * roles in India?
 *
 *   npm run check:jobs [roleId]
 *
 * The failure to watch for is silence: a company that leaves Greenhouse or
 * renames its board slug returns an empty list, which looks identical to a
 * quiet hiring week. `companiesReporting` is the tripwire.
 */
import { getJobBoard, postedAge } from "@/lib/jobs"

const roleId = process.argv[2] ?? "backend-engineer"
const started = performance.now()
const board = await getJobBoard(roleId)
const elapsed = Math.round(performance.now() - started)

console.log(
  `${board.companiesReporting}/${board.companiesAttempted} boards reporting · ` +
    `${board.totalEngineering} India engineering postings · ` +
    `${board.postings.length} match ${roleId} · ${elapsed}ms\n`
)

for (const j of board.postings.slice(0, 12)) {
  console.log(`  [${j.seniority.padEnd(6)}] ${j.title.slice(0, 56)}`)
  console.log(`            ${j.company} · ${j.location.slice(0, 34)} · ${postedAge(j.postedAt)}`)
}

console.log(`\n  entry-level matching this role: ${board.entryLevelCount}`)

if (board.companiesReporting === 0) {
  console.error("\n✗ No board returned anything — slugs or providers changed.")
  process.exit(1)
}
if (board.totalEngineering === 0) {
  console.error("\n✗ Boards reachable but no India engineering postings found.")
  process.exit(1)
}
console.log("\n✓ Real postings, classified deterministically from titles.")
