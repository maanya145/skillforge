import "server-only"

import { asc, eq } from "drizzle-orm"

import { db, schema } from "@/db"
import type { LevelRubric } from "@/lib/scoring/types"

/**
 * Reads for the public benchmark page.
 *
 * These rows are the product's only ruler, so they are published rather than
 * described. A student who disagrees with a number can point at the rung it was
 * scored against; a judge can check the arithmetic without an account.
 */

export type RoleSummary = {
  id: string
  name: string
  blurb: string
  trackCount: number
}

export async function listRoles(): Promise<RoleSummary[]> {
  const roles = await db
    .select()
    .from(schema.roles)
    .orderBy(asc(schema.roles.sortOrder), asc(schema.roles.name))

  const benchmarks = await db
    .select({
      roleId: schema.roleBenchmarks.roleId,
      trackId: schema.roleBenchmarks.trackId,
    })
    .from(schema.roleBenchmarks)

  const counts = new Map<string, number>()
  for (const b of benchmarks) {
    counts.set(b.roleId, (counts.get(b.roleId) ?? 0) + 1)
  }

  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    blurb: r.blurb,
    trackCount: counts.get(r.id) ?? 0,
  }))
}

export type BenchmarkRow = {
  trackId: string
  name: string
  category: string
  description: string
  requiredLevel: number
  weight: number
  hoursPerLevel: number
  isBlocking: boolean
  rationale: string
  rubric: LevelRubric
  /** Track names this one must follow, per the scheduler's ordering rules. */
  requires: string[]
}

export type RoleBenchmark = {
  role: RoleSummary
  version: string
  sourceNote: string
  rows: BenchmarkRow[]
}

/** The full published ruler for one role, or null if the id is unknown. */
export async function getRoleBenchmark(
  roleId: string
): Promise<RoleBenchmark | null> {
  const [role] = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.id, roleId))
  if (!role) return null

  const rows = await db
    .select({
      trackId: schema.roleBenchmarks.trackId,
      requiredLevel: schema.roleBenchmarks.requiredLevel,
      weight: schema.roleBenchmarks.weight,
      hoursPerLevel: schema.roleBenchmarks.hoursPerLevel,
      isBlocking: schema.roleBenchmarks.isBlocking,
      rationale: schema.roleBenchmarks.rationale,
      sourceNote: schema.roleBenchmarks.sourceNote,
      benchmarkVersion: schema.roleBenchmarks.benchmarkVersion,
      name: schema.skillTracks.name,
      category: schema.skillTracks.category,
      description: schema.skillTracks.description,
      levelRubric: schema.skillTracks.levelRubric,
    })
    .from(schema.roleBenchmarks)
    .innerJoin(
      schema.skillTracks,
      eq(schema.skillTracks.id, schema.roleBenchmarks.trackId)
    )
    .where(eq(schema.roleBenchmarks.roleId, roleId))

  const prereqs = await db
    .select({
      trackId: schema.trackPrerequisites.trackId,
      requiresTrackId: schema.trackPrerequisites.requiresTrackId,
    })
    .from(schema.trackPrerequisites)
    .where(eq(schema.trackPrerequisites.roleId, roleId))

  const trackName = new Map(rows.map((r) => [r.trackId, r.name]))
  const requiredBy = new Map<string, string[]>()
  for (const p of prereqs) {
    const label = trackName.get(p.requiresTrackId) ?? p.requiresTrackId
    requiredBy.set(p.trackId, [...(requiredBy.get(p.trackId) ?? []), label])
  }

  return {
    role: {
      id: role.id,
      name: role.name,
      blurb: role.blurb,
      trackCount: rows.length,
    },
    version: rows[0]?.benchmarkVersion ?? "2026.1",
    sourceNote: rows[0]?.sourceNote ?? "Seeded benchmark",
    // Blocking first, then by how much of readiness the track carries — the
    // same priority the scheduler uses, so the page reads in plan order.
    rows: rows
      .map((r) => ({
        trackId: r.trackId,
        name: r.name,
        category: r.category,
        description: r.description,
        requiredLevel: r.requiredLevel,
        weight: r.weight,
        hoursPerLevel: r.hoursPerLevel,
        isBlocking: r.isBlocking,
        rationale: r.rationale,
        rubric: r.levelRubric,
        requires: requiredBy.get(r.trackId) ?? [],
      }))
      .sort((a, b) => {
        if (a.isBlocking !== b.isBlocking) return a.isBlocking ? -1 : 1
        const w = b.weight * b.requiredLevel - a.weight * a.requiredLevel
        if (w !== 0) return w
        return a.name.localeCompare(b.name)
      }),
  }
}
