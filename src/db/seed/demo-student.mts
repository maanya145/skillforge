/**
 * Seeds a fully-populated demo student — every screen lit, no model call.
 *
 *   npm run db:demo                          # attach to the first real account
 *   npm run db:demo -- --clerk-id=user_xxx   # attach to a specific account
 *   npm run db:demo -- --reset               # wipe that student's data first
 *
 * Every number goes through the SAME pipeline code the live analysis uses —
 * provenLevel → computeGap → readinessScore → rankers → scheduler — fed by the
 * golden fixture signals. The demo is precomputed, not faked: re-running the
 * arithmetic reproduces it exactly, which is the product's whole claim.
 */
import { setDefaultResultOrder } from "node:dns"
import { readFile } from "node:fs/promises"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { and, eq, isNotNull, notLike } from "drizzle-orm"

import * as schema from "../schema"
import { provenLevel } from "../../lib/scoring/level"
import { computeGap, type BenchmarkRow } from "../../lib/scoring/gap"
import { readinessScore, perTrackReadiness } from "../../lib/scoring/readiness"
import type { LevelRubric } from "../../lib/scoring/types"
import {
  AARAV_SIGNALS,
  AARAV_WEEKLY_HOURS,
} from "../../lib/scoring/fixtures"
import { rankProjects, rankCerts, rankQuestions } from "../../lib/ranking/rank"
import { buildSchedule } from "../../lib/scheduling/schedule"

setDefaultResultOrder("ipv4first")

const ROLE_ID = "backend-engineer"
const DEMO_CLERK_ID = "demo__aarav-menon"

const argClerkId = process.argv
  .find((a) => a.startsWith("--clerk-id="))
  ?.split("=")[1]
const reset = process.argv.includes("--reset")

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

// ── Resolve the student ──────────────────────────────────────────────────────
let clerkId = argClerkId
if (!clerkId) {
  // Prefer a real signed-in account so the demo shows up after login.
  const [real] = await db
    .select()
    .from(schema.students)
    .where(
      and(
        isNotNull(schema.students.clerkUserId),
        notLike(schema.students.clerkUserId, "fixture__%"),
        notLike(schema.students.clerkUserId, "demo__%")
      )
    )
    .limit(1)
  clerkId = real?.clerkUserId ?? DEMO_CLERK_ID
}

let [student] = await db
  .select()
  .from(schema.students)
  .where(eq(schema.students.clerkUserId, clerkId))

if (!student) {
  ;[student] = await db
    .insert(schema.students)
    .values({
      clerkUserId: clerkId,
      fullName: "Aarav Menon",
      college: "VIT Vellore",
      gradYear: 2026,
      targetRoleId: ROLE_ID,
      weeklyHours: AARAV_WEEKLY_HOURS,
    })
    .returning()
} else {
  await db
    .update(schema.students)
    .set({
      fullName: student.fullName ?? "Aarav Menon",
      college: "VIT Vellore",
      gradYear: 2026,
      targetRoleId: ROLE_ID,
      weeklyHours: AARAV_WEEKLY_HOURS,
    })
    .where(eq(schema.students.id, student.id))
}

if (reset) {
  // Cascades take out runs, assessments, roadmaps, recommendations.
  await db
    .delete(schema.resumes)
    .where(eq(schema.resumes.studentId, student.id))
  await db
    .delete(schema.progressEvents)
    .where(eq(schema.progressEvents.studentId, student.id))
  await db
    .delete(schema.readinessSnapshots)
    .where(eq(schema.readinessSnapshots.studentId, student.id))
  await db
    .delete(schema.roadmaps)
    .where(eq(schema.roadmaps.studentId, student.id))
  console.log("reset    previous demo data cleared")
}

// ── Resume ───────────────────────────────────────────────────────────────────
const resumeText = await readFile("fixtures/aarav-menon-resume-v4.txt", "utf8")
const pagesText = [resumeText.trimEnd()]
const lines = pagesText[0].split("\n")
/** 1-based line of the first line containing `needle` — keeps citations real. */
const lineOf = (needle: string) => {
  const i = lines.findIndex((l) => l.includes(needle))
  if (i === -1) throw new Error(`fixture drift: "${needle}" not found`)
  return i + 1
}

const [resume] = await db
  .insert(schema.resumes)
  .values({
    studentId: student.id,
    fileName: "Aarav_Menon_Resume_v4.pdf",
    fileSize: 22614,
    pageCount: 1,
    rawText: pagesText[0],
    pagesText,
    parseMs: 62,
    sectionsFound: 6,
  })
  .returning()

const [run] = await db
  .insert(schema.analysisRuns)
  .values({
    studentId: student.id,
    resumeId: resume.id,
    roleId: ROLE_ID,
    status: "succeeded",
    currentStep: "persist",
    progress: [
      { key: "sections", label: "Sections identified", value: "6" },
      { key: "skills", label: "Skills extracted", value: "14" },
      { key: "flags", label: "Claims lacking evidence", value: "3" },
      { key: "readiness", label: "Readiness computed", value: "seeded" },
    ],
    finishedAt: new Date(),
    extractCache: null, // filled below once signals are assembled
  })
  .returning()

// ── Gauges via the real pipeline ─────────────────────────────────────────────
const benchRows = await db
  .select({
    trackId: schema.roleBenchmarks.trackId,
    requiredLevel: schema.roleBenchmarks.requiredLevel,
    weight: schema.roleBenchmarks.weight,
    hoursPerLevel: schema.roleBenchmarks.hoursPerLevel,
    isBlocking: schema.roleBenchmarks.isBlocking,
    name: schema.skillTracks.name,
    levelRubric: schema.skillTracks.levelRubric,
  })
  .from(schema.roleBenchmarks)
  .innerJoin(
    schema.skillTracks,
    eq(schema.skillTracks.id, schema.roleBenchmarks.trackId)
  )
  .where(eq(schema.roleBenchmarks.roleId, ROLE_ID))

const NOTES: Record<string, string> = {
  "system-design": "SIH build shows vocabulary, nothing under load",
  "docker-cicd": "Claimed on the resume, no project behind it",
  testing: "No test file in any repository",
  concurrency: "OS coursework at B, no applied work",
  dsa: "Solid on trees, slow on shortest paths",
  "sql-modelling": "2.1s → 240ms rewrite carries this",
  "api-design": "Met the bar with the mess portal",
  "linux-shell": "Daily driver through the internship",
  observability: "Internship scripts only, nothing measured",
  caching: "Weather CLI caches, no invalidation story",
  "security-basics": "Auth exists in the portal, unexamined",
  "version-control": "Public repos, no branch discipline shown",
}

// Fixture signals cover 8 tracks; the remaining role tracks get light,
// hand-authored signal sets so all 12 gauges exist.
const EXTRA = {
  observability: { ...AARAV_SIGNALS["linux-shell"], projectCount: 1, shippedProjectCount: 0, courseworkGrade: "none" as const, yearsClaimed: null },
  caching: { ...AARAV_SIGNALS["testing"], projectCount: 1, mentionedOnResume: false },
  "security-basics": { ...AARAV_SIGNALS["testing"], projectCount: 1, shippedProjectCount: 1 },
  "version-control": { ...AARAV_SIGNALS["dsa"], competitionUse: false, courseworkGrade: "none" as const },
}
const signalsFor = (trackId: string) =>
  AARAV_SIGNALS[trackId] ?? EXTRA[trackId as keyof typeof EXTRA]

const gauges = benchRows.map((b) => {
  const { level, rungHit } = provenLevel(
    signalsFor(b.trackId),
    b.levelRubric as LevelRubric
  )
  const benchmark: BenchmarkRow = {
    trackId: b.trackId,
    requiredLevel: b.requiredLevel,
    weight: b.weight,
    hoursPerLevel: b.hoursPerLevel,
    isBlocking: b.isBlocking,
  }
  return {
    ...computeGap(level, benchmark, AARAV_WEEKLY_HOURS),
    rubricLevelHit: rungHit,
    note: NOTES[b.trackId] ?? "Seeded demo signal",
  }
})
const readiness = readinessScore(gauges)

await db
  .update(schema.analysisRuns)
  .set({
    extractCache: {
      signals: Object.fromEntries(
        benchRows.map((b) => [b.trackId, signalsFor(b.trackId)])
      ),
      notes: NOTES,
    },
  })
  .where(eq(schema.analysisRuns.id, run.id))

await db.insert(schema.skillAssessments).values(
  gauges.map((g) => ({
    runId: run.id,
    studentId: student.id,
    roleId: ROLE_ID,
    trackId: g.trackId,
    provenLevel: g.provenLevel,
    requiredLevel: g.requiredLevel,
    gap: g.gap,
    weight: g.weight,
    weeksToClose: g.weeksToClose,
    status: g.status,
    note: g.note,
    rubricLevelHit: g.rubricLevelHit,
  }))
)

// ── Intake detail ────────────────────────────────────────────────────────────
const CHIPS: [string, string | null][] = [
  ["Python", null], ["JavaScript", null], ["SQL", "sql-modelling"], ["C", null],
  ["Django", null], ["Flask", null], ["React", null], ["Git", "version-control"],
  ["Linux", "linux-shell"], ["PostgreSQL", "sql-modelling"], ["Nginx", null],
  ["Docker", "docker-cicd"], ["REST APIs", "api-design"], ["pytest", "testing"],
]
await db.insert(schema.extractedSkills).values(
  CHIPS.map(([rawLabel, trackId]) => ({
    runId: run.id,
    rawLabel,
    trackId,
    confidence: trackId ? 0.9 : 1,
    isNewSinceLast: false,
    signals: signalsFor(trackId ?? "testing") ?? {},
  }))
)

await db.insert(schema.resumeEvidence).values([
  { runId: run.id, kind: "project" as const, title: "Campus Mess Portal", detail: "Django, Postgres, deployed", metric: "400 users", sourcePage: 1, sourceLine: lineOf("Campus Mess Portal"), trackIds: ["sql-modelling", "api-design"] },
  { runId: run.id, kind: "project" as const, title: "Weather CLI", detail: "Python, caches forecasts", metric: null, sourcePage: 1, sourceLine: lineOf("Weather CLI"), trackIds: ["caching"] },
  { runId: run.id, kind: "award" as const, title: "SIH 2025 finalist", detail: "Backend lead, team of 6", metric: "finalist", sourcePage: 1, sourceLine: lineOf("Smart India Hackathon 2025 - Finalist"), trackIds: ["api-design", "system-design"] },
  { runId: run.id, kind: "internship" as const, title: "Zeta internship", detail: "Reconciliation tooling", metric: "8 weeks", sourcePage: 1, sourceLine: lineOf("Zeta - Backend"), trackIds: ["api-design", "linux-shell"] },
  { runId: run.id, kind: "coursework" as const, title: "DBMS", detail: "Corroborates the SQL claim", metric: "A", sourcePage: 1, sourceLine: lineOf("DBMS (A)"), trackIds: ["sql-modelling"] },
])

await db.insert(schema.resumeFlags).values([
  { runId: run.id, page: 1, line: lineOf("Improved performance significantly."), quote: "Improved performance significantly.", critique: "Recruiters read this as nothing. The reporting script went 40 minutes to 4 — say that instead.", suggestedFix: "State the measured before/after.", severity: 2 },
  { runId: run.id, page: 1, line: lineOf("Familiar with Docker"), quote: "Familiar with Docker", critique: "No project behind the claim. Finish the CI retrofit and claim it properly, or drop it.", suggestedFix: "Add a Dockerfile to a repo you own.", severity: 2 },
  { runId: run.id, page: 1, line: lineOf("Weather CLI"), quote: "Weather CLI - Python", critique: "No README, no tests. Two hours turns a filler line into a defensible one.", suggestedFix: "Write the README; add three tests.", severity: 1 },
])

// ── Plan via the real rankers and scheduler ──────────────────────────────────
const [projectRows, certRows, questionRows, prereqRows] = await Promise.all([
  db.select().from(schema.projectCatalog),
  db.select().from(schema.certCatalog),
  db.select().from(schema.questionBank),
  db
    .select()
    .from(schema.trackPrerequisites)
    .where(eq(schema.trackPrerequisites.roleId, ROLE_ID)),
])
const trackNames = Object.fromEntries(benchRows.map((b) => [b.trackId, b.name]))

const projects = rankProjects(projectRows, gauges, trackNames)
const schedule = buildSchedule({
  totalWeeks: 14,
  weeklyHours: AARAV_WEEKLY_HOURS,
  gaps: gauges,
  trackNames,
  prerequisites: prereqRows.map((p) => ({
    trackId: p.trackId,
    requiresTrackId: p.requiresTrackId,
  })),
  projects: projects.slice(0, 3).map((p) => ({
    projectId: p.id,
    title: p.title,
    effortWeeks: p.effortWeeks,
    requiresTrackIds: p.requiresTrackIds,
    closesTrackIds: p.closesTrackIds,
  })),
  hasDsaTrack: true,
})
const covered = new Set(projects.slice(0, 3).flatMap((p) => p.closesTrackIds))
const certs = rankCerts(certRows, gauges, covered, trackNames)
const questions = rankQuestions(questionRows, gauges, trackNames)

const scheduledByProject = new Map(
  schedule.items.filter((i) => i.projectId).map((i) => [i.projectId!, i])
)
await db.insert(schema.recommendedProjects).values(
  projects.slice(0, 4).map((p) => ({
    runId: run.id,
    projectId: p.id,
    score: p.score,
    rank: p.rank,
    rationale: p.rationale,
    closesTrackIds: p.closesOpenTrackIds,
    startWeek: scheduledByProject.get(p.id)?.startWeek ?? null,
    endWeek: scheduledByProject.get(p.id)?.endWeek ?? null,
  }))
)
await db.insert(schema.recommendedCerts).values(
  certs.map((c) => ({
    runId: run.id,
    certId: c.id,
    verdict: c.verdict,
    score: c.score,
    rank: c.rank,
    rationale: c.rationale,
  }))
)
await db.insert(schema.recommendedQuestions).values(
  questions.map((q) => ({
    runId: run.id,
    questionId: q.id,
    isGapTrack: q.isGapTrack,
    rank: q.rank,
    score: q.score,
    coachNote: q.coachNote,
  }))
)

await db
  .update(schema.roadmaps)
  .set({ isActive: false })
  .where(eq(schema.roadmaps.studentId, student.id))
const [roadmap] = await db
  .insert(schema.roadmaps)
  .values({
    studentId: student.id,
    runId: run.id,
    roleId: ROLE_ID,
    totalWeeks: 14,
    weeklyHours: AARAV_WEEKLY_HOURS,
    startDate: new Date().toISOString().slice(0, 10),
    isActive: true,
  })
  .returning()
await db.insert(schema.roadmapItems).values(
  schedule.items.map((i) => ({
    roadmapId: roadmap.id,
    lane: i.lane,
    kind: i.kind,
    trackId: i.trackId,
    projectId: i.projectId,
    label: i.label,
    detail: i.detail,
    startWeek: i.startWeek,
    endWeek: i.endWeek,
    sortOrder: i.sortOrder,
  }))
)
await db.insert(schema.roadmapNotes).values(
  schedule.notes.map((n) => ({
    roadmapId: roadmap.id,
    week: n.week,
    headline: n.headline,
    body: n.body,
    sortOrder: n.sortOrder,
  }))
)

// ── History: 12 weekly snapshots climbing to today's readiness ───────────────
const today = new Date()
const startReadiness = Math.max(20, readiness - 22)
const snapshotRows = Array.from({ length: 12 }, (_, i) => {
  const date = new Date(today)
  date.setDate(today.getDate() - (11 - i) * 7)
  // Monotonic climb with a deterministic wobble — no Math.random in seeds.
  const t = i / 11
  const wobble = ((i * 7919) % 5) - 2
  const value =
    i === 11
      ? readiness
      : Math.round(startReadiness + (readiness - startReadiness) * t + wobble)
  return {
    studentId: student.id,
    roleId: ROLE_ID,
    capturedOn: date.toISOString().slice(0, 10),
    readiness: Math.max(startReadiness, Math.min(readiness, value)),
    perTrack: perTrackReadiness(gauges),
    source: "seed" as const,
  }
})
for (const row of snapshotRows) {
  await db
    .insert(schema.readinessSnapshots)
    .values(row)
    .onConflictDoUpdate({
      target: [
        schema.readinessSnapshots.studentId,
        schema.readinessSnapshots.roleId,
        schema.readinessSnapshots.capturedOn,
      ],
      set: { readiness: row.readiness, perTrack: row.perTrack, source: row.source },
    })
}

console.log(
  `demo     ${student.fullName} (${clerkId})\n` +
    `         readiness ${readiness} · ${gauges.filter((g) => g.status === "open").length} open gaps · ` +
    `${schedule.items.length} roadmap items · ${snapshotRows.length} snapshots`
)
