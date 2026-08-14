import "server-only"

import { randomBytes } from "node:crypto"
import { and, desc, eq, isNull, sql } from "drizzle-orm"

import { db, schema } from "@/db"
import { getSkillMap, type SkillMap } from "@/lib/analysis"

/**
 * Read-only report links.
 *
 * The token *is* the access control, so it is generated the way a session id
 * would be: 16 bytes of CSPRNG entropy, base64url. At 2^128 the guessing
 * attack is not worth defending against further; at anything shorter it is.
 */
export function newShareToken() {
  return randomBytes(16).toString("base64url")
}

export type ShareRow = {
  id: string
  token: string
  runId: string
  showName: boolean
  viewCount: number
  lastViewedAt: Date | null
  createdAt: Date
}

/** The student's live share for a run, if they have one. */
export async function getShareForRun(
  studentId: string,
  runId: string
): Promise<ShareRow | null> {
  const [row] = await db
    .select({
      id: schema.reportShares.id,
      token: schema.reportShares.token,
      runId: schema.reportShares.runId,
      showName: schema.reportShares.showName,
      viewCount: schema.reportShares.viewCount,
      lastViewedAt: schema.reportShares.lastViewedAt,
      createdAt: schema.reportShares.createdAt,
    })
    .from(schema.reportShares)
    .where(
      and(
        eq(schema.reportShares.studentId, studentId),
        eq(schema.reportShares.runId, runId),
        isNull(schema.reportShares.revokedAt)
      )
    )
    .orderBy(desc(schema.reportShares.createdAt))
    .limit(1)
  return row ?? null
}

export type SharedReport = {
  map: SkillMap
  roleName: string
  roleBlurb: string
  sourceNote: string
  benchmarkVersion: string
  studentName: string | null
  weeklyHours: number
  sharedOn: Date
}

/**
 * Everything a public report renders, or null if the token is unknown, revoked
 * or points at a run whose assessments have since been deleted.
 *
 * Deliberately narrow: no resume text, no evidence quotes, no flagged lines, no
 * chat. A share is the *scoreboard*, not the file — a student sending this to a
 * recruiter should not have to re-read their own resume to know what leaked.
 */
export async function getSharedReport(
  token: string
): Promise<SharedReport | null> {
  const [share] = await db
    .select({
      runId: schema.reportShares.runId,
      showName: schema.reportShares.showName,
      createdAt: schema.reportShares.createdAt,
      studentName: schema.students.fullName,
      weeklyHours: schema.students.weeklyHours,
    })
    .from(schema.reportShares)
    .innerJoin(
      schema.students,
      eq(schema.students.id, schema.reportShares.studentId)
    )
    .where(
      and(
        eq(schema.reportShares.token, token),
        isNull(schema.reportShares.revokedAt)
      )
    )

  if (!share) return null

  const map = await getSkillMap(share.runId)
  if (!map) return null

  const [role] = await db
    .select({ name: schema.roles.name, blurb: schema.roles.blurb })
    .from(schema.roles)
    .where(eq(schema.roles.id, map.roleId))

  const [benchmark] = await db
    .select({
      sourceNote: schema.roleBenchmarks.sourceNote,
      benchmarkVersion: schema.roleBenchmarks.benchmarkVersion,
    })
    .from(schema.roleBenchmarks)
    .where(eq(schema.roleBenchmarks.roleId, map.roleId))
    .limit(1)

  return {
    map,
    roleName: role?.name ?? map.roleId,
    roleBlurb: role?.blurb ?? "",
    sourceNote: benchmark?.sourceNote ?? "Seeded benchmark",
    benchmarkVersion: benchmark?.benchmarkVersion ?? "2026.1",
    studentName: share.showName ? share.studentName : null,
    weeklyHours: share.weeklyHours,
    sharedOn: share.createdAt,
  }
}

/**
 * Counts a view. Called from `after()` so a slow write never delays the page,
 * and swallows its own errors — a broken counter must not 500 a report someone
 * is being interviewed against.
 */
export async function recordShareView(token: string) {
  try {
    await db
      .update(schema.reportShares)
      .set({
        viewCount: sql`${schema.reportShares.viewCount} + 1`,
        lastViewedAt: new Date(),
      })
      .where(
        and(
          eq(schema.reportShares.token, token),
          isNull(schema.reportShares.revokedAt)
        )
      )
  } catch (err) {
    console.error("[shares] view counter failed:", err)
  }
}
