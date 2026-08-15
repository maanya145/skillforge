import type { LevelRubric } from "@/lib/scoring/types"

/**
 * Turns a job posting's track mappings into a benchmark — deterministically.
 *
 * The division of labour mirrors the resume pipeline exactly. The model reads
 * the posting and CLASSIFIES: which of our tracks does this JD treat as core,
 * which does it merely mention — each claim citing the JD line it came from.
 * This module then derives the numbers, and the rule is deliberately blunt:
 *
 *   **The posting chooses what matters. The benchmark still sets the bar.**
 *
 * Required levels are never invented for a posting — they come from the seeded
 * role benchmarks, unchanged. What the JD moves is *weight*: a core skill
 * counts 1.5× toward readiness for this job, a merely-mentioned one 1×, and a
 * baseline skill the posting never brings up 0.5× — still present, because a
 * backend job that forgets to mention testing still expects testing.
 */

export type JdEmphasis = "core" | "mentioned"

export interface JdMapping {
  trackId: string
  emphasis: JdEmphasis
  /** 1-based line in the posting, with the quote that justified the mapping. */
  line: number
  quote: string
}

/** Weight multipliers per emphasis. Exported so the UI can show the rule. */
export const EMPHASIS_WEIGHT: Record<JdEmphasis | "absent", number> = {
  core: 1.5,
  mentioned: 1.0,
  absent: 0.5,
}

export interface SourceBenchmarkRow {
  trackId: string
  requiredLevel: number
  weight: number
  hoursPerLevel: number
  isBlocking: boolean
  levelRubric: LevelRubric
}

export interface DerivedRow extends SourceBenchmarkRow {
  emphasis: JdEmphasis | "absent"
  /** The citation, when the posting itself asked for this track. */
  line: number | null
  quote: string | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Derive the posting's benchmark.
 *
 * - Base-role rows are kept, reweighted by emphasis. `absent` also drops
 *   `isBlocking`: the seeded role screens for it, this posting does not.
 * - A mapped track missing from the base role is imported from the other
 *   roles' benchmarks — the row with the highest weight (tie: highest
 *   required level), so the import is deterministic and never invented.
 */
export function deriveBenchmark(
  baseRows: SourceBenchmarkRow[],
  otherRoleRows: SourceBenchmarkRow[],
  mappings: JdMapping[]
): DerivedRow[] {
  const byTrack = new Map<string, JdMapping>()
  for (const m of mappings) {
    const existing = byTrack.get(m.trackId)
    // Two mentions of one track: core wins; otherwise first citation stands.
    if (!existing || (existing.emphasis === "mentioned" && m.emphasis === "core")) {
      byTrack.set(m.trackId, m)
    }
  }

  const rows: DerivedRow[] = baseRows.map((row) => {
    const mapping = byTrack.get(row.trackId)
    const emphasis = mapping?.emphasis ?? "absent"
    return {
      ...row,
      weight: round1(row.weight * EMPHASIS_WEIGHT[emphasis]),
      isBlocking: emphasis === "absent" ? false : row.isBlocking,
      emphasis,
      line: mapping?.line ?? null,
      quote: mapping?.quote ?? null,
    }
  })

  const covered = new Set(baseRows.map((r) => r.trackId))
  for (const mapping of byTrack.values()) {
    if (covered.has(mapping.trackId)) continue
    const candidates = otherRoleRows
      .filter((r) => r.trackId === mapping.trackId)
      .sort(
        (a, b) => b.weight - a.weight || b.requiredLevel - a.requiredLevel
      )
    const source = candidates[0]
    if (!source) continue // mapping to a track no benchmark knows — dropped
    rows.push({
      ...source,
      weight: round1(source.weight * EMPHASIS_WEIGHT[mapping.emphasis]),
      // Imported on the posting's authority, not the base role's screening.
      isBlocking: false,
      emphasis: mapping.emphasis,
      line: mapping.line,
      quote: mapping.quote,
    })
  }

  // Core first, then mentioned, then baseline — the order the JD reads in.
  const rank = { core: 0, mentioned: 1, absent: 2 } as const
  return rows.sort(
    (a, b) => rank[a.emphasis] - rank[b.emphasis] || b.weight - a.weight
  )
}
