export type GapStatus = "open" | "met" | "above"

export interface BenchmarkRow {
  trackId: string
  /** 0–10, the white notch on the gauge */
  requiredLevel: number
  /** Readiness weighting — how much this track matters for this role */
  weight: number
  /** Study hours to move one full level on this track */
  hoursPerLevel: number
  /** Screened for early enough that a gap here blocks an offer */
  isBlocking: boolean
}

export interface GapResult {
  trackId: string
  provenLevel: number
  requiredLevel: number
  /** max(0, required - proven) — the hatched span */
  gap: number
  weight: number
  weeksToClose: number
  status: GapStatus
  isBlocking: boolean
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * The whole of the gap arithmetic. Deliberately boring: subtraction and a
 * division, over numbers a human authored. A judge can check it by hand.
 */
export function computeGap(
  provenLevel: number,
  benchmark: BenchmarkRow,
  weeklyHours: number
): GapResult {
  const { requiredLevel, weight, hoursPerLevel, trackId, isBlocking } = benchmark

  const gap = round1(Math.max(0, requiredLevel - provenLevel))

  const status: GapStatus =
    provenLevel >= requiredLevel
      ? provenLevel > requiredLevel
        ? "above"
        : "met"
      : "open"

  // A student with no time still has a finite gap; guard the division rather
  // than returning Infinity into a UI that has to render it.
  const hours = Math.max(1, weeklyHours)
  const weeksToClose = gap === 0 ? 0 : Math.ceil((gap * hoursPerLevel) / hours)

  return {
    trackId,
    provenLevel: round1(provenLevel),
    requiredLevel,
    gap,
    weight,
    weeksToClose,
    status,
    isBlocking,
  }
}

/**
 * Which gaps to attack first: the ones that cost the most readiness per week
 * of work. Blocking tracks jump the queue regardless — a blocking gap doesn't
 * lower your score, it ends the interview.
 */
export function prioritiseGaps(gaps: GapResult[]): GapResult[] {
  return [...gaps]
    .filter((g) => g.status === "open")
    .sort((a, b) => {
      if (a.isBlocking !== b.isBlocking) return a.isBlocking ? -1 : 1
      const impact = b.weight * b.gap - a.weight * a.gap
      if (impact !== 0) return impact
      // Tie-break on cheapness: quick wins first, so early weeks show movement.
      return a.weeksToClose - b.weeksToClose
    })
}
