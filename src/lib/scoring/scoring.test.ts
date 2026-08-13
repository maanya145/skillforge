import { describe, it, expect } from "vitest"

import { provenLevel, rungFor, nextRung, EVIDENCE_WEIGHTS } from "./level"
import { computeGap, prioritiseGaps, type BenchmarkRow } from "./gap"
import {
  readinessScore,
  readinessIfClosed,
  readinessLeverage,
  trackReadiness,
} from "./readiness"
import {
  signals,
  GENERIC_RUBRIC,
  SYSTEM_DESIGN_RUBRIC,
  AARAV_SIGNALS,
  BACKEND_BENCHMARK,
  AARAV_WEEKLY_HOURS,
} from "./fixtures"
import { EMPTY_SIGNALS } from "./types"

const rubricFor = (trackId: string) =>
  trackId === "system-design" ? SYSTEM_DESIGN_RUBRIC : GENERIC_RUBRIC

/** The full demo-student pipeline, exactly as the workflow runs it. */
function demoGaps() {
  return BACKEND_BENCHMARK.map((b) => {
    const { level } = provenLevel(AARAV_SIGNALS[b.trackId], rubricFor(b.trackId))
    return computeGap(level, b, AARAV_WEEKLY_HOURS)
  })
}

describe("provenLevel", () => {
  it("gives nothing for no evidence", () => {
    expect(provenLevel(EMPTY_SIGNALS, GENERIC_RUBRIC).level).toBe(0)
  })

  it("treats a bare resume claim as nearly worthless", () => {
    const claim = provenLevel(
      signals({ mentionedOnResume: true }),
      GENERIC_RUBRIC
    )
    // Below the bottom rung: saying it does not make it true.
    expect(claim.level).toBe(1)
    expect(claim.rungHit).toBe(0)
  })

  it("values a shipped project above a built one", () => {
    const built = provenLevel(signals({ projectCount: 1 }), GENERIC_RUBRIC)
    const shipped = provenLevel(
      signals({ projectCount: 1, shippedProjectCount: 1 }),
      GENERIC_RUBRIC
    )
    expect(shipped.level).toBeGreaterThan(built.level)
  })

  it("cannot count more shipped projects than projects", () => {
    const impossible = provenLevel(
      signals({ projectCount: 1, shippedProjectCount: 5 }),
      GENERIC_RUBRIC
    )
    const honest = provenLevel(
      signals({ projectCount: 1, shippedProjectCount: 1 }),
      GENERIC_RUBRIC
    )
    expect(impossible.level).toBe(honest.level)
  })

  it("is monotonic — more evidence never lowers a level", () => {
    const keys = Object.keys(EMPTY_SIGNALS) as (keyof typeof EMPTY_SIGNALS)[]
    const base = provenLevel(
      signals({ mentionedOnResume: true, projectCount: 1 }),
      GENERIC_RUBRIC
    ).level

    for (const key of keys) {
      const richer = signals({
        mentionedOnResume: true,
        projectCount: 1,
        ...(key === "courseworkGrade"
          ? { courseworkGrade: "A" as const }
          : typeof EMPTY_SIGNALS[key] === "boolean"
            ? { [key]: true }
            : { [key]: 4 }),
      })
      expect(
        provenLevel(richer, GENERIC_RUBRIC).level,
        `adding ${key} lowered the level`
      ).toBeGreaterThanOrEqual(base)
    }
  })

  it("clamps at 10 however much evidence piles up", () => {
    const everything = provenLevel(
      signals({
        mentionedOnResume: true,
        projectCount: 99,
        shippedProjectCount: 99,
        hasQuantifiedOutcome: true,
        hasTests: true,
        hasPublicRepo: true,
        internshipMonths: 99,
        courseworkGrade: "A",
        competitionUse: true,
        yearsClaimed: 99,
      }),
      GENERIC_RUBRIC
    )
    expect(everything.level).toBe(10)
    expect(everything.rungHit).toBe(8)
  })

  it("shows its working", () => {
    const { breakdown } = provenLevel(
      signals({ mentionedOnResume: true, hasTests: true }),
      GENERIC_RUBRIC
    )
    expect(breakdown).toEqual([
      { label: "Named on the resume", points: EVIDENCE_WEIGHTS.mentioned },
      { label: "Tested", points: EVIDENCE_WEIGHTS.tests },
    ])
  })
})

describe("rubric rungs", () => {
  it("reports the highest rung reached, and 0 below the ladder", () => {
    expect(rungFor(0, GENERIC_RUBRIC)).toBe(0)
    expect(rungFor(1.9, GENERIC_RUBRIC)).toBe(0)
    expect(rungFor(2, GENERIC_RUBRIC)).toBe(2)
    expect(rungFor(5.9, GENERIC_RUBRIC)).toBe(4)
    expect(rungFor(10, GENERIC_RUBRIC)).toBe(8)
  })

  it("names what closing the gap requires", () => {
    expect(nextRung(2.5, SYSTEM_DESIGN_RUBRIC)?.label).toBe(
      "Has drawn one under load"
    )
    expect(nextRung(9, SYSTEM_DESIGN_RUBRIC)).toBeNull()
  })
})

describe("computeGap", () => {
  const bench: BenchmarkRow = {
    trackId: "t",
    requiredLevel: 6,
    weight: 1,
    hoursPerLevel: 9,
    isBlocking: false,
  }

  it("classifies open, met and above", () => {
    expect(computeGap(3, bench, 9).status).toBe("open")
    expect(computeGap(6, bench, 9).status).toBe("met")
    expect(computeGap(7, bench, 9).status).toBe("above")
  })

  it("never reports a negative gap", () => {
    expect(computeGap(9, bench, 9).gap).toBe(0)
  })

  it("converts a gap into weeks via hours-per-level", () => {
    // 3 levels short × 9 hours per level = 27 hours ÷ 9 per week = 3 weeks
    expect(computeGap(3, bench, 9).weeksToClose).toBe(3)
    // Half the weekly hours, double the weeks
    expect(computeGap(3, bench, 4.5).weeksToClose).toBe(6)
  })

  it("survives a student who logs no hours", () => {
    const g = computeGap(3, bench, 0)
    expect(Number.isFinite(g.weeksToClose)).toBe(true)
    expect(g.weeksToClose).toBe(27)
  })

  it("puts blocking gaps first regardless of size", () => {
    const gaps = [
      computeGap(2, { ...bench, trackId: "big", requiredLevel: 9, weight: 2 }, 9),
      computeGap(
        5,
        { ...bench, trackId: "blocker", requiredLevel: 6, isBlocking: true },
        9
      ),
    ]
    expect(prioritiseGaps(gaps)[0].trackId).toBe("blocker")
  })
})

describe("readiness", () => {
  const met = (trackId: string): ReturnType<typeof computeGap> =>
    computeGap(6, { trackId, requiredLevel: 6, weight: 1, hoursPerLevel: 9, isBlocking: false }, 9)

  it("is 100 when every requirement is met", () => {
    expect(readinessScore([met("a"), met("b")])).toBe(100)
  })

  it("is 0 with no evidence at all", () => {
    const none = computeGap(
      0,
      { trackId: "a", requiredLevel: 6, weight: 1, hoursPerLevel: 9, isBlocking: false },
      9
    )
    expect(readinessScore([none])).toBe(0)
  })

  it("gives no credit for overshooting", () => {
    const gaps = [
      computeGap(10, { trackId: "over", requiredLevel: 6, weight: 1, hoursPerLevel: 9, isBlocking: false }, 9),
      computeGap(0, { trackId: "under", requiredLevel: 6, weight: 1, hoursPerLevel: 9, isBlocking: false }, 9),
    ]
    // Exactly half the weighted requirement is unmet — being double the bar on
    // one track cannot compensate for a hole in another.
    expect(readinessScore(gaps)).toBe(50)
  })

  it("ranks tracks by how much closing them would move the number", () => {
    const gaps = demoGaps()
    const leverage = readinessLeverage(gaps)
    expect(leverage[0].delta).toBeGreaterThan(0)
    // Sorted descending
    for (let i = 1; i < leverage.length; i++) {
      expect(leverage[i - 1].delta).toBeGreaterThanOrEqual(leverage[i].delta)
    }
    // Closing a track really does produce the promised score
    const top = leverage[0]
    expect(readinessIfClosed(gaps, top.trackId) - readinessScore(gaps)).toBe(
      top.delta
    )
  })

  it("caps per-track readiness at 100", () => {
    expect(trackReadiness(met("a"))).toBe(100)
    const above = computeGap(
      10,
      { trackId: "a", requiredLevel: 5, weight: 1, hoursPerLevel: 9, isBlocking: false },
      9
    )
    expect(trackReadiness(above)).toBe(100)
  })
})

/**
 * The regression net for the demo.
 *
 * These numbers are the arithmetic consequence of the seeded benchmark and the
 * signal sets in fixtures.ts. If a weight, a required level or an hours-per-
 * level changes, this test fails and the demo script needs rewriting — which
 * is the point.
 */
describe("demo student — Aarav Menon, backend engineer, 9 hrs/week", () => {
  const expected = {
    "system-design": { level: 2.5, gap: 3.5, weeks: 7, status: "open" },
    "docker-cicd": { level: 1.2, gap: 4.8, weeks: 5, status: "open" },
    testing: { level: 1.0, gap: 4.0, weeks: 4, status: "open" },
    concurrency: { level: 2.1, gap: 4.9, weeks: 7, status: "open" },
    dsa: { level: 5.5, gap: 2.5, weeks: 8, status: "open" },
    "sql-modelling": { level: 6.7, gap: 0.3, weeks: 1, status: "open" },
    "api-design": { level: 8.7, gap: 0, weeks: 0, status: "above" },
    "linux-shell": { level: 6.3, gap: 0, weeks: 0, status: "above" },
  } as const

  const gaps = demoGaps()

  it.each(Object.entries(expected))("%s", (trackId, want) => {
    const got = gaps.find((g) => g.trackId === trackId)!
    expect(got.provenLevel).toBe(want.level)
    expect(got.gap).toBe(want.gap)
    expect(got.weeksToClose).toBe(want.weeks)
    expect(got.status).toBe(want.status)
  })

  it("scores 61 readiness with 6 open gaps", () => {
    expect(readinessScore(gaps)).toBe(61)
    expect(gaps.filter((g) => g.status === "open")).toHaveLength(6)
  })

  it("puts both blocking tracks at the top of the queue", () => {
    const order = prioritiseGaps(gaps).map((g) => g.trackId)
    expect(order.slice(0, 2).sort()).toEqual(["docker-cicd", "system-design"])
  })

  it("closing system design is worth more than closing SQL", () => {
    const leverage = readinessLeverage(gaps)
    const sd = leverage.find((l) => l.trackId === "system-design")!
    const sql = leverage.find((l) => l.trackId === "sql-modelling")!
    expect(sd.delta).toBeGreaterThan(sql.delta)
  })
})
