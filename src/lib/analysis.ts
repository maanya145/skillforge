import "server-only"

import { and, desc, eq } from "drizzle-orm"

import { db, schema } from "@/db"
import type { Gauge } from "@/components/viz/gap-gauge"

/** The most recent successful analysis for a student, if there is one. */
export async function getLatestRun(studentId: string) {
  const [run] = await db
    .select()
    .from(schema.analysisRuns)
    .where(
      and(
        eq(schema.analysisRuns.studentId, studentId),
        eq(schema.analysisRuns.status, "succeeded")
      )
    )
    .orderBy(desc(schema.analysisRuns.startedAt))
    .limit(1)
  return run ?? null
}

/** The run currently in flight, if any — drives the intake screen's polling. */
export async function getActiveRun(studentId: string) {
  const [run] = await db
    .select()
    .from(schema.analysisRuns)
    .where(eq(schema.analysisRuns.studentId, studentId))
    .orderBy(desc(schema.analysisRuns.startedAt))
    .limit(1)
  return run ?? null
}

export type SkillMap = {
  runId: string
  roleId: string
  readiness: number
  gauges: Gauge[]
  openGaps: number
  blocking: Gauge[]
  computedAt: Date
}

/**
 * The skill map for a run, ordered the way it is read: biggest gaps first,
 * then met tracks, then the ones already above the bar. A student scanning
 * this should hit what needs attention before what doesn't.
 */
export async function getSkillMap(runId: string): Promise<SkillMap | null> {
  const rows = await db
    .select({
      trackId: schema.skillAssessments.trackId,
      name: schema.skillTracks.name,
      provenLevel: schema.skillAssessments.provenLevel,
      requiredLevel: schema.skillAssessments.requiredLevel,
      gap: schema.skillAssessments.gap,
      weight: schema.skillAssessments.weight,
      weeksToClose: schema.skillAssessments.weeksToClose,
      status: schema.skillAssessments.status,
      note: schema.skillAssessments.note,
      roleId: schema.skillAssessments.roleId,
      computedAt: schema.skillAssessments.computedAt,
    })
    .from(schema.skillAssessments)
    .innerJoin(
      schema.skillTracks,
      eq(schema.skillTracks.id, schema.skillAssessments.trackId)
    )
    .where(eq(schema.skillAssessments.runId, runId))

  if (rows.length === 0) return null

  const statusOrder = { open: 0, met: 1, above: 2 } as const
  const gauges: Gauge[] = rows
    .map((r) => ({
      trackId: r.trackId,
      name: r.name,
      provenLevel: r.provenLevel,
      requiredLevel: r.requiredLevel,
      gap: r.gap,
      weeksToClose: r.weeksToClose,
      status: r.status,
      note: r.note,
    }))
    .sort((a, b) => {
      const s = statusOrder[a.status] - statusOrder[b.status]
      if (s !== 0) return s
      return b.gap - a.gap
    })

  // Readiness is recomputed from the stored rows rather than read from a
  // column, so the map can never disagree with its own gauges.
  const shortfall = rows.reduce((n, r) => n + r.weight * r.gap, 0)
  const total = rows.reduce((n, r) => n + r.weight * r.requiredLevel, 0)
  const readiness = total === 0 ? 100 : Math.round(100 * (1 - shortfall / total))

  return {
    runId,
    roleId: rows[0].roleId,
    readiness,
    gauges,
    openGaps: gauges.filter((g) => g.status === "open").length,
    blocking: gauges.filter((g) => g.status === "open").slice(0, 2),
    computedAt: rows[0].computedAt,
  }
}
