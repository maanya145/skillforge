/**
 * Runs the full analyze-resume workflow against the real database and the real
 * model, without going through the browser or Clerk.
 *
 *   npm run check:workflow [path/to/resume.pdf]
 *
 * This is the S1 proof: PDF bytes in, gap gauges out. It uses a dedicated
 * fixture student so it can be re-run without touching real accounts.
 */
import { readFile } from "node:fs/promises"
import { eq } from "drizzle-orm"

import { db, schema } from "../src/db/client"
import { extractResume } from "../src/lib/pdf/extract"
import { mastra } from "../src/mastra"

const FIXTURE_CLERK_ID = "fixture__check-workflow"
const path = process.argv[2] ?? "fixtures/aarav-menon-resume-v4.pdf"
const roleId = process.env.CHECK_ROLE ?? "backend-engineer"

const started = Date.now()

// ── Fixture student ──────────────────────────────────────────────────────────
let [student] = await db
  .select()
  .from(schema.students)
  .where(eq(schema.students.clerkUserId, FIXTURE_CLERK_ID))

if (!student) {
  ;[student] = await db
    .insert(schema.students)
    .values({
      clerkUserId: FIXTURE_CLERK_ID,
      fullName: "Fixture Student",
      college: "VIT Vellore",
      gradYear: 2026,
      targetRoleId: roleId,
      weeklyHours: 9,
    })
    .returning()
}

// ── Parse ────────────────────────────────────────────────────────────────────
const bytes = new Uint8Array(await readFile(path))
const parsed = await extractResume(bytes)
console.log(
  `parsed   ${path} — ${parsed.pageCount} page(s), ${parsed.rawText.length} chars, ${parsed.parseMs}ms`
)

const [resume] = await db
  .insert(schema.resumes)
  .values({
    studentId: student.id,
    fileName: path.split("/").pop() ?? "resume.pdf",
    fileSize: bytes.byteLength,
    pageCount: parsed.pageCount,
    rawText: parsed.rawText,
    pagesText: parsed.pagesText,
    parseMs: parsed.parseMs,
    sectionsFound: parsed.pagesText.length,
  })
  .returning()

const [run] = await db
  .insert(schema.analysisRuns)
  .values({
    studentId: student.id,
    resumeId: resume.id,
    roleId,
    status: "queued",
  })
  .returning()

// ── Run ──────────────────────────────────────────────────────────────────────
console.log(`workflow analyze-resume · role ${roleId} · run ${run.id.slice(0, 8)}\n`)

const workflowRun = await mastra.getWorkflow("analyzeResumeWorkflow").createRun()
const result = await workflowRun.start({
  inputData: {
    runId: run.id,
    studentId: student.id,
    resumeId: resume.id,
    roleId,
    weeklyHours: student.weeklyHours,
  },
})

if (result.status !== "success") {
  // `error` only exists on the failed variant; tripwire carries `tripwire`.
  const reason =
    result.status === "failed" ? String(result.error) : `ended as ${result.status}`
  console.error(`\nFAILED (${result.status})`)
  console.error(reason)
  await db
    .update(schema.analysisRuns)
    .set({ status: "failed", error: reason.slice(0, 500) })
    .where(eq(schema.analysisRuns.id, run.id))
  process.exit(1)
}

// ── Report ───────────────────────────────────────────────────────────────────
const gauges = await db
  .select({
    trackId: schema.skillAssessments.trackId,
    name: schema.skillTracks.name,
    proven: schema.skillAssessments.provenLevel,
    required: schema.skillAssessments.requiredLevel,
    gap: schema.skillAssessments.gap,
    weeks: schema.skillAssessments.weeksToClose,
    status: schema.skillAssessments.status,
    rung: schema.skillAssessments.rubricLevelHit,
    note: schema.skillAssessments.note,
  })
  .from(schema.skillAssessments)
  .innerJoin(
    schema.skillTracks,
    eq(schema.skillTracks.id, schema.skillAssessments.trackId)
  )
  .where(eq(schema.skillAssessments.runId, run.id))

console.log("track                  proven  req   gap  wks  status  rung  note")
for (const g of gauges.sort((a, b) => b.gap - a.gap)) {
  console.log(
    "  " +
      g.name.padEnd(22) +
      String(g.proven).padStart(5) +
      String(g.required).padStart(6) +
      String(g.gap).padStart(6) +
      String(g.weeks).padStart(5) +
      "  " +
      g.status.padEnd(7) +
      String(g.rung).padStart(4) +
      "  " +
      g.note.slice(0, 46)
  )
}

const flags = await db
  .select()
  .from(schema.resumeFlags)
  .where(eq(schema.resumeFlags.runId, run.id))

console.log(`\nflags that survived quote verification: ${flags.length}`)
for (const f of flags) {
  console.log(`  p.${f.page} L${f.line}  "${f.quote.slice(0, 60)}"`)
  console.log(`            ${f.critique.slice(0, 90)}`)
}

const [snapshot] = await db
  .select()
  .from(schema.readinessSnapshots)
  .where(eq(schema.readinessSnapshots.studentId, student.id))

const skills = await db
  .select()
  .from(schema.extractedSkills)
  .where(eq(schema.extractedSkills.runId, run.id))

console.log(
  `\nreadiness ${snapshot?.readiness ?? "?"} / 100 · ` +
    `${gauges.filter((g) => g.status === "open").length} open gaps · ` +
    `${skills.length} skill chips · ` +
    `${Math.round((Date.now() - started) / 1000)}s total`
)

process.exit(0)
