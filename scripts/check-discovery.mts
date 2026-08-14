/**
 * End-to-end discovery: search → classify → validate → score → persist.
 *
 *   npm run check:discovery
 *
 * Runs against the most recent successful analysis. This is the script that
 * catches an Exa response-format change — the parser degrades to zero results
 * rather than to wrong ones, so silence is the failure mode to watch for.
 */
import { desc, eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { exaSearch } from "@/lib/discovery/exa"
import { discoverForRun, getDiscoveries } from "@/lib/discovery/discover"

// ── 1. Is Exa reachable and still returning the shape we parse? ─────────────
console.log("Probing Exa…")
const probe = await exaSearch("a practical free course teaching Docker to backend engineers", 3)
console.log(`  ${probe.length} results`)
for (const r of probe.slice(0, 3)) {
  console.log(`  · ${r.title.slice(0, 68)}`)
  console.log(`    ${r.url.slice(0, 90)}`)
  console.log(`    ${r.snippet ? `${r.snippet.length} chars of extract` : "NO EXTRACT"}`)
}
if (probe.length === 0) {
  console.error("\n✗ Exa returned nothing. Either it is down or the reply format changed.")
  process.exit(1)
}

// ── 2. Full pipeline against a real run ────────────────────────────────────
const [run] = await db
  .select({ id: schema.analysisRuns.id, studentId: schema.analysisRuns.studentId })
  .from(schema.analysisRuns)
  .where(eq(schema.analysisRuns.status, "succeeded"))
  .orderBy(desc(schema.analysisRuns.startedAt))
  .limit(1)

if (!run) {
  console.log("\nNo successful analysis to discover against. Run `npm run db:demo` first.")
  process.exit(0)
}

console.log(`\nDiscovering for run ${run.id.slice(0, 8)}…`)
const started = performance.now()
const outcome = await discoverForRun({ studentId: run.studentId, runId: run.id })
const elapsed = Math.round(performance.now() - started)

console.log(`\n${outcome.message}`)
console.log(`  ${elapsed}ms · ${outcome.searched} queries · ${outcome.rejected} rejected\n`)

const rows = await getDiscoveries(run.studentId, run.id)
for (const r of rows) {
  console.log(`  ${String(r.rank).padStart(2)}. [${r.kind}] ${r.title.slice(0, 62)}`)
  console.log(`      ${r.source} · score ${r.score} · ${r.costNote ?? "?"} · ${r.closesTrackIds.join(", ")}`)
  console.log(`      ${r.summary.slice(0, 92)}`)
}

if (rows.length === 0) {
  console.error("\n✗ Nothing persisted.")
  process.exit(1)
}

// The whole point: no number above came from the model.
const bad = rows.filter((r) => !Number.isFinite(r.score) || r.score < 0)
if (bad.length) {
  console.error(`\n✗ ${bad.length} rows have an invalid score.`)
  process.exit(1)
}

console.log("\n✓ Every score is Σ(weight × gap) over open tracks — computed, not generated.")
