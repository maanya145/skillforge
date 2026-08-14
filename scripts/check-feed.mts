/**
 * Does the feed return real, recent, gap-relevant stories?
 *
 *   npm run check:feed
 *
 * Hacker News' Algolia API is the only dependency, so the failure to watch for
 * is silence: a schema change degrades to an empty feed rather than a wrong
 * one, and an empty feed looks the same as a quiet week.
 */
import { desc, eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { getFeed, relativeAge } from "@/lib/feed"

const [run] = await db
  .select({ id: schema.analysisRuns.id })
  .from(schema.analysisRuns)
  .where(eq(schema.analysisRuns.status, "succeeded"))
  .orderBy(desc(schema.analysisRuns.startedAt))
  .limit(1)

if (!run) {
  console.log("No successful analysis. Run `npm run db:demo` first.")
  process.exit(0)
}

const started = performance.now()
const items = await getFeed(run.id)
const elapsed = Math.round(performance.now() - started)

console.log(`${items.length} stories in ${elapsed}ms\n`)

for (const item of items.slice(0, 12)) {
  console.log(`  ${String(item.score).padStart(5)}  ${item.title.slice(0, 62)}`)
  console.log(
    `         ${item.source} · ${item.points}pts · ${relativeAge(item.ageHours)} · ${item.trackNames.join(", ")}`
  )
}

const problems: string[] = []
if (items.length === 0) problems.push("empty feed — HN unreachable or its schema changed")
if (items.some((i) => i.trackIds.length === 0)) {
  problems.push("a story matched no track, so relevance ranking is broken")
}
if (items.some((i) => !/^https?:\/\//.test(i.url))) {
  problems.push("a story has an unusable url")
}
// Descending score is the whole contract of a ranked feed.
const ordered = items.every((it, i) => i === 0 || items[i - 1].score >= it.score)
if (!ordered) problems.push("items are not in descending score order")

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):`)
  for (const p of problems) console.error(`  · ${p}`)
  process.exit(1)
}

console.log(
  `\n✓ Ranked by weight × gap × popularity × freshness — no model involved.`
)
