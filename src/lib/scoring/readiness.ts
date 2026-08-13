import type { GapResult } from "./gap"

/**
 * Readiness is the weighted share of the role's requirements already met.
 *
 *   readiness = 100 · (1 − Σ(wᵢ·gapᵢ) / Σ(wᵢ·requiredᵢ))
 *
 * Two properties that make it worth putting on a dashboard:
 *
 * · It only moves when a gap closes. Hours logged do not enter the formula, so
 *   the number cannot be inflated by activity — which is the specific way most
 *   learning platforms mislead people.
 * · Being above the bar earns nothing. Overshooting one track can't paper over
 *   a gap in another, because the numerator only counts shortfalls.
 */
export function readinessScore(gaps: GapResult[]): number {
  if (gaps.length === 0) return 0

  let shortfall = 0
  let total = 0

  for (const g of gaps) {
    shortfall += g.weight * g.gap
    total += g.weight * g.requiredLevel
  }

  if (total === 0) return 100
  return Math.round(100 * (1 - shortfall / total))
}

/** Readiness restricted to one track, for the per-track closure bars. */
export function trackReadiness(gap: GapResult): number {
  if (gap.requiredLevel === 0) return 100
  return Math.round(
    100 * Math.min(1, gap.provenLevel / gap.requiredLevel)
  )
}

/** Per-track map stored alongside each readiness snapshot. */
export function perTrackReadiness(gaps: GapResult[]): Record<string, number> {
  return Object.fromEntries(gaps.map((g) => [g.trackId, trackReadiness(g)]))
}

/**
 * What readiness would become if one track were brought to its requirement.
 * Drives "closing this is worth +6 points", which is how a student decides
 * where the next nine hours go.
 */
export function readinessIfClosed(
  gaps: GapResult[],
  trackId: string
): number {
  return readinessScore(
    gaps.map((g) =>
      g.trackId === trackId
        ? { ...g, gap: 0, provenLevel: g.requiredLevel, status: "met" as const }
        : g
    )
  )
}

/** Ranked list of the highest-leverage tracks to close next. */
export function readinessLeverage(
  gaps: GapResult[]
): { trackId: string; delta: number; weeksToClose: number }[] {
  const base = readinessScore(gaps)
  return gaps
    .filter((g) => g.status === "open")
    .map((g) => ({
      trackId: g.trackId,
      delta: readinessIfClosed(gaps, g.trackId) - base,
      weeksToClose: g.weeksToClose,
    }))
    .sort((a, b) => b.delta - a.delta)
}
