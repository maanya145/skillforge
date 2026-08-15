/**
 * The JD-targeting chain, end to end against the live model:
 * posting → mapper → citation guard → derived benchmark → scored report.
 *
 *   npm run check:jd
 *
 * Cleans up after itself — the target it creates is deleted at the end.
 */
import { readFile } from "node:fs/promises"
import { desc } from "drizzle-orm"

import { db, schema } from "@/db"
import { createJobTarget, getTargetReport, deleteJobTarget } from "@/lib/jd/target"

const [student] = await db
  .select({ id: schema.students.id, fullName: schema.students.fullName })
  .from(schema.students)
  .orderBy(desc(schema.students.createdAt))
  .limit(1)
if (!student) {
  console.log("No student. Run `npm run db:demo` first.")
  process.exit(0)
}

const posting = await readFile("fixtures/jd-backend.txt", "utf8")
console.log(`student  ${student.fullName ?? student.id.slice(0, 8)}`)
console.log("posting  fixtures/jd-backend.txt (Zylker Payments)\n")

const started = performance.now()
const { id } = await createJobTarget(student.id, posting)
const report = await getTargetReport(student.id, id)
const elapsed = Math.round(performance.now() - started)

try {
  if (!report) throw new Error("report vanished")

  console.log(`${report.title}${report.company ? " · " + report.company : ""}`)
  console.log(`baseline ${report.baseRoleName} · ${elapsed}ms\n`)

  const cited = report.requirements.filter((r) => r.emphasis !== "absent")
  for (const r of report.requirements) {
    const you = r.proven !== null ? `you ${r.proven.toFixed(1)} · ` : ""
    const wks =
      r.gapResult && r.gapResult.status === "open"
        ? ` · ${r.gapResult.weeksToClose} wks`
        : ""
    console.log(
      `  [${r.emphasis.padEnd(9)}] ${r.name.padEnd(22)} ${you}needs ${r.requiredLevel.toFixed(1)} · w${r.weight}${wks}`
    )
    if (r.quote) console.log(`              L${r.line}: “${r.quote}”`)
  }

  console.log(
    `\nreadiness ${report.readiness} · ${report.openGaps} gaps · ${report.totalWeeks} wks to clear`
  )

  const problems: string[] = []
  if (cited.length < 4)
    problems.push(`only ${cited.length} cited mappings — the mapper missed obvious tracks`)
  if (report.readiness === null)
    problems.push("no readiness despite the demo student's cache")
  if (!report.requirements.some((r) => r.emphasis === "core"))
    problems.push("no core requirement found in a requirements-heavy posting")
  if (problems.length) {
    console.error(`\n✗ ${problems.length} problem(s):`)
    for (const p of problems) console.error(`  · ${p}`)
    process.exit(1)
  }
  console.log("\n✓ Mapped, cited, derived and scored — levels all from the seeded benchmark.")
} finally {
  await deleteJobTarget(student.id, id)
  console.log("(test target deleted)")
}
