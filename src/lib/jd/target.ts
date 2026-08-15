import "server-only"

import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"

import { db, schema } from "@/db"
import { pseudoPages, PSEUDO_PAGE_LINES, verifyQuote } from "@/lib/pdf/extract"
import { provenLevel } from "@/lib/scoring/level"
import { computeGap, type GapResult } from "@/lib/scoring/gap"
import { readinessScore } from "@/lib/scoring/readiness"
import type { EvidenceSignals, LevelRubric } from "@/lib/scoring/types"
import { getExtractCache } from "@/lib/replan"
import { getLatestRun } from "@/lib/analysis"
import { jdMapperAgent } from "@/mastra/agents/jd-mapper"
import {
  deriveBenchmark,
  type DerivedRow,
  type JdMapping,
  type SourceBenchmarkRow,
} from "@/lib/jd/derive"

/**
 * "Measure me against this job posting."
 *
 * The same pipeline shape as a resume analysis, pointed the other way:
 *
 *   posting → pseudo-paged text            [deterministic — reuses the
 *                                           resume paste machinery]
 *   → mapper CLASSIFIES tracks + cites     [the one model call]
 *   → citation guard drops bad quotes      [same verifyQuote as resume flags]
 *   → deriveBenchmark reweights seeds      [pure rules]
 *   → cached evidence scored against it    [zero further model calls]
 *
 * Where competitors report keyword overlap with the document, this reports
 * whether the *person* clears the posting's bar, and in how many weeks.
 */

const MIN_JD_CHARS = 120
const MAX_JD_CHARS = 12_000

const mapperSchema = z.object({
  title: z.string().min(2).max(120),
  company: z.string().max(80).nullable(),
  baseRoleId: z.string(),
  mappings: z
    .array(
      z.object({
        trackId: z.string(),
        emphasis: z.enum(["core", "mentioned"]),
        line: z.number().int().positive(),
        quote: z.string().min(3).max(200),
      })
    )
    .max(24),
})

export class JdError extends Error {}

export type TargetRequirement = DerivedRow & {
  name: string
  /** Null until a resume has been analysed. */
  proven: number | null
  gapResult: GapResult | null
}

export type TargetReport = {
  id: string
  title: string
  company: string | null
  baseRoleId: string
  baseRoleName: string
  createdAt: Date
  requirements: TargetRequirement[]
  /** Null when there is no analysed resume yet — the report still shows the bar. */
  readiness: number | null
  openGaps: number | null
  totalWeeks: number | null
}

/** All seeded benchmark rows with rubrics, once. */
async function loadBenchmarks() {
  return db
    .select({
      roleId: schema.roleBenchmarks.roleId,
      trackId: schema.roleBenchmarks.trackId,
      requiredLevel: schema.roleBenchmarks.requiredLevel,
      weight: schema.roleBenchmarks.weight,
      hoursPerLevel: schema.roleBenchmarks.hoursPerLevel,
      isBlocking: schema.roleBenchmarks.isBlocking,
      levelRubric: schema.skillTracks.levelRubric,
      name: schema.skillTracks.name,
    })
    .from(schema.roleBenchmarks)
    .innerJoin(
      schema.skillTracks,
      eq(schema.skillTracks.id, schema.roleBenchmarks.trackId)
    )
}

/**
 * Parse, map, verify and persist a posting. The model runs once, here;
 * everything a screen later shows is derived on read.
 */
export async function createJobTarget(
  studentId: string,
  rawText: string
): Promise<{ id: string }> {
  const text = rawText.replace(/\r\n?/g, "\n").trim()
  if (text.length < MIN_JD_CHARS) {
    throw new JdError(
      `That's only ${text.length} characters — paste the whole posting so there's something to map.`
    )
  }
  const clipped = text.slice(0, MAX_JD_CHARS)

  // Pseudo-pages keep line citations verifiable — same trick as pasted
  // resumes. But the model is shown GLOBAL line numbers, not per-page ones:
  // a posting is one document, and the guard converts global → (page, line)
  // itself. Mixing coordinate systems here silently dropped every valid
  // mapping past line 60.
  const pages = pseudoPages(clipped)
  const numbered = pages
    .flatMap((p) => p.split("\n"))
    .map((lineText, i) => ({ n: i + 1, lineText }))
    .filter(({ lineText }) => lineText.trim())
    .map(({ n, lineText }) => `[L${n}] ${lineText}`)
    .join("\n")

  const [roles, benchmarks] = await Promise.all([
    db.select({ id: schema.roles.id, name: schema.roles.name }).from(schema.roles),
    loadBenchmarks(),
  ])
  const trackVocab = [...new Map(benchmarks.map((b) => [b.trackId, b.name]))]

  const prompt = `BASE ROLE IDS
${roles.map((r) => `${r.id} — ${r.name}`).join("\n")}

SKILL TRACK IDS YOU MAY REFERENCE
${trackVocab.map(([id, name]) => `${id} — ${name}`).join("\n")}

JOB POSTING (line-numbered)
${numbered}`

  const result = await jdMapperAgent.generate(prompt, {
    structuredOutput: { schema: mapperSchema },
  })
  const parsed = result.object
  if (!parsed) throw new JdError("Couldn't read that posting. Try again.")

  // ── The guards — identical in spirit to the resume pipeline ──────────────
  const validRoles = new Set(roles.map((r) => r.id))
  const baseRoleId = validRoles.has(parsed.baseRoleId)
    ? parsed.baseRoleId
    : roles[0].id

  const validTracks = new Set(trackVocab.map(([id]) => id))
  const mappings: JdMapping[] = parsed.mappings.filter((m) => {
    if (!validTracks.has(m.trackId)) return false
    // The quote must occur at the cited (global) line, or it never persists.
    const page = Math.ceil(m.line / PSEUDO_PAGE_LINES)
    const lineInPage = ((m.line - 1) % PSEUDO_PAGE_LINES) + 1
    return verifyQuote(pages, page, lineInPage, m.quote)
  })

  if (mappings.length === 0) {
    throw new JdError(
      "Nothing in that posting maps to a measurable track — is it a software role?"
    )
  }

  const [row] = await db
    .insert(schema.jobTargets)
    .values({
      studentId,
      title: parsed.title,
      company: parsed.company,
      baseRoleId,
      sourceText: clipped,
      mappings,
    })
    .returning({ id: schema.jobTargets.id })

  return { id: row.id }
}

/** A stored target, scored against whatever evidence exists right now. */
export async function getTargetReport(
  studentId: string,
  targetId: string
): Promise<TargetReport | null> {
  const [target] = await db
    .select()
    .from(schema.jobTargets)
    .where(
      and(
        eq(schema.jobTargets.id, targetId),
        eq(schema.jobTargets.studentId, studentId)
      )
    )
  if (!target) return null
  return scoreTarget(studentId, target)
}

/** Every saved target, newest first, each scored against current evidence. */
export async function listTargetReports(
  studentId: string
): Promise<TargetReport[]> {
  const targets = await db
    .select()
    .from(schema.jobTargets)
    .where(eq(schema.jobTargets.studentId, studentId))
    .orderBy(desc(schema.jobTargets.createdAt))
  return Promise.all(targets.map((t) => scoreTarget(studentId, t)))
}

type TargetRow = typeof schema.jobTargets.$inferSelect

async function scoreTarget(
  studentId: string,
  target: TargetRow
): Promise<TargetReport> {
  const benchmarks = await loadBenchmarks()
  const names = new Map(benchmarks.map((b) => [b.trackId, b.name]))

  const toSource = (b: (typeof benchmarks)[number]): SourceBenchmarkRow => ({
    trackId: b.trackId,
    requiredLevel: b.requiredLevel,
    weight: b.weight,
    hoursPerLevel: b.hoursPerLevel,
    isBlocking: b.isBlocking,
    levelRubric: b.levelRubric as LevelRubric,
  })

  const derived = deriveBenchmark(
    benchmarks.filter((b) => b.roleId === target.baseRoleId).map(toSource),
    benchmarks.filter((b) => b.roleId !== target.baseRoleId).map(toSource),
    target.mappings
  )

  // Evidence, if any. The report degrades to requirements-only without it.
  const run = await getLatestRun(studentId)
  const cache = run ? await getExtractCache(run.id) : null
  const [student] = await db
    .select({ weeklyHours: schema.students.weeklyHours })
    .from(schema.students)
    .where(eq(schema.students.id, studentId))
  const weeklyHours = student?.weeklyHours ?? 9

  const requirements: TargetRequirement[] = derived.map((row) => {
    if (!cache) {
      return { ...row, name: names.get(row.trackId) ?? row.trackId, proven: null, gapResult: null }
    }
    const signals = cache.signals[row.trackId] as EvidenceSignals | undefined
    const { level } = signals
      ? provenLevel(signals, row.levelRubric)
      : { level: 0 }
    return {
      ...row,
      name: names.get(row.trackId) ?? row.trackId,
      proven: level,
      gapResult: computeGap(level, row, weeklyHours),
    }
  })

  const gaps = requirements
    .map((r) => r.gapResult)
    .filter((g): g is GapResult => g !== null)
  const open = gaps.filter((g) => g.status === "open")

  const [role] = await db
    .select({ name: schema.roles.name })
    .from(schema.roles)
    .where(eq(schema.roles.id, target.baseRoleId))

  return {
    id: target.id,
    title: target.title,
    company: target.company,
    baseRoleId: target.baseRoleId,
    baseRoleName: role?.name ?? target.baseRoleId,
    createdAt: target.createdAt,
    requirements,
    readiness: cache ? readinessScore(gaps) : null,
    openGaps: cache ? open.length : null,
    totalWeeks: cache ? open.reduce((n, g) => n + g.weeksToClose, 0) : null,
  }
}

export async function deleteJobTarget(studentId: string, targetId: string) {
  await db
    .delete(schema.jobTargets)
    .where(
      and(
        eq(schema.jobTargets.id, targetId),
        eq(schema.jobTargets.studentId, studentId)
      )
    )
}
