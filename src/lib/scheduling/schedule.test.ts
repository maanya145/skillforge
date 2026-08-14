import { describe, it, expect } from "vitest"

import { provenLevel } from "@/lib/scoring/level"
import { computeGap } from "@/lib/scoring/gap"
import {
  AARAV_SIGNALS,
  BACKEND_BENCHMARK,
  AARAV_WEEKLY_HOURS,
  GENERIC_RUBRIC,
  SYSTEM_DESIGN_RUBRIC,
} from "@/lib/scoring/fixtures"
import { buildSchedule, type ScheduleInput } from "./schedule"
import { rankProjects, rankCerts, rankQuestions } from "@/lib/ranking/rank"

const TRACK_NAMES: Record<string, string> = {
  "system-design": "System design",
  "docker-cicd": "Docker & CI/CD",
  testing: "Testing",
  concurrency: "Concurrency",
  dsa: "DSA",
  "sql-modelling": "SQL & data modelling",
  "api-design": "REST & API design",
  "linux-shell": "Linux & shell",
}

function demoGaps() {
  return BACKEND_BENCHMARK.map((b) => {
    const rubric =
      b.trackId === "system-design" ? SYSTEM_DESIGN_RUBRIC : GENERIC_RUBRIC
    const { level } = provenLevel(AARAV_SIGNALS[b.trackId], rubric)
    return computeGap(level, b, AARAV_WEEKLY_HOURS)
  })
}

const SHORTENER = {
  projectId: "rate-limited-shortener",
  title: "Rate-limited link shortener",
  effortWeeks: 4,
  requiresTrackIds: ["docker-cicd"],
  closesTrackIds: ["system-design", "docker-cicd"],
}

function input(over: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    totalWeeks: 14,
    weeklyHours: 9,
    gaps: demoGaps(),
    trackNames: TRACK_NAMES,
    prerequisites: [
      { trackId: "system-design", requiresTrackId: "docker-cicd" },
    ],
    projects: [SHORTENER],
    hasDsaTrack: true,
    ...over,
  }
}

describe("buildSchedule", () => {
  const schedule = buildSchedule(input())
  const items = schedule.items
  const gapItems = items.filter((i) => i.kind === "gap")
  const byTrack = (id: string) => gapItems.find((i) => i.trackId === id)!

  it("puts a blocking track first", () => {
    // system-design and docker-cicd are blocking; docker has no prerequisite
    // so it must be week 1, while system design waits for it.
    expect(byTrack("docker-cicd").startWeek).toBe(1)
  })

  it("honours prerequisites — system design starts after Docker ends", () => {
    expect(byTrack("system-design").startWeek).toBeGreaterThan(
      byTrack("docker-cicd").endWeek
    )
  })

  it("gates the project on the tracks it requires", () => {
    const project = items.find((i) => i.projectId === SHORTENER.projectId)!
    expect(project.startWeek).toBeGreaterThan(byTrack("docker-cicd").endWeek)
  })

  it("keeps every bar inside the horizon", () => {
    for (const i of items) {
      expect(i.startWeek).toBeGreaterThanOrEqual(1)
      expect(i.endWeek).toBeGreaterThanOrEqual(i.startWeek)
      expect(i.endWeek).toBeLessThanOrEqual(14)
    }
  })

  it("places the portfolio pass in the final three weeks", () => {
    const portfolio = items.find((i) => i.label === "Portfolio pass")!
    expect(portfolio.startWeek).toBe(12)
    expect(portfolio.endWeek).toBe(14)
  })

  it("spans the drill lane and places two mocks", () => {
    const drill = items.find((i) => i.label === "Problem sets")!
    expect(drill.startWeek).toBe(1)
    expect(drill.endWeek).toBe(14)
    const mocks = items.filter((i) => i.kind === "milestone")
    expect(mocks.map((m) => m.startWeek)).toEqual([7, 12])
  })

  it("derives the first note from the prerequisite edge, not prose", () => {
    const first = schedule.notes[0]
    expect(first.headline).toContain("Docker & CI/CD comes first")
    expect(first.body).toContain("Rate-limited link shortener")
  })

  it("is deterministic", () => {
    expect(buildSchedule(input())).toEqual(buildSchedule(input()))
  })

  it("survives a student with no open gaps", () => {
    const closed = demoGaps().map((g) => ({
      ...g,
      gap: 0,
      status: "met" as const,
    }))
    const s = buildSchedule(input({ gaps: closed }))
    expect(s.items.filter((i) => i.kind === "gap")).toHaveLength(0)
    // Drill and portfolio still exist — the plan degrades, it doesn't vanish.
    expect(s.items.length).toBeGreaterThan(0)
  })
})

describe("ranking", () => {
  const gaps = demoGaps()

  it("scores a project by gap points per week of effort", () => {
    const [top] = rankProjects(
      [
        {
          id: "a",
          title: "High leverage",
          summary: "",
          effortWeeks: 2,
          closesTrackIds: ["system-design", "docker-cicd"],
          requiresTrackIds: [],
          evidenceProduced: "a load test",
        },
        {
          id: "b",
          title: "Low leverage",
          summary: "",
          effortWeeks: 6,
          closesTrackIds: ["linux-shell"],
          requiresTrackIds: [],
          evidenceProduced: "a script",
        },
      ],
      gaps,
      TRACK_NAMES
    )
    expect(top.id).toBe("a")
    expect(top.rationale).toContain("System design")
  })

  it("marks a cert redundant when a scheduled project covers the same track", () => {
    const [cert] = rankCerts(
      [
        {
          id: "dca",
          name: "Docker Certified Associate",
          provider: "Docker",
          costInr: 16000,
          examWindow: null,
          baseValue: 1,
          provesTrackIds: ["docker-cicd"],
          cheaperAlternative: "The CI retrofit proves this for free.",
        },
      ],
      gaps,
      new Set(["docker-cicd"]),
      TRACK_NAMES
    )
    expect(cert.verdict).toBe("skip")
    expect(cert.rationale).toBe("The CI retrofit proves this for free.")
  })

  /**
   * The budget is an override, not a fudge to the score — a certificate you
   * cannot afford is a skip however good it is, and the score stays visible so
   * the reason is legible. The Practice artifact re-runs this in the browser,
   * so these cases are what the slider is actually doing.
   */
  describe("budget", () => {
    const expensive = [
      {
        id: "pricey",
        name: "Expensive but excellent",
        provider: "X",
        costInr: 18000,
        examWindow: null,
        baseValue: 6,
        provesTrackIds: ["system-design"],
        cheaperAlternative: null,
      },
    ]

    it("leaves verdicts untouched when no budget is set", () => {
      const [cert] = rankCerts(expensive, gaps, new Set(), TRACK_NAMES)
      expect(cert.verdict).toBe("worth_it")
      expect(cert.breakdown.overBudget).toBe(false)
    })

    it("overrides a good cert to skip when it costs more than the budget", () => {
      const [cert] = rankCerts(expensive, gaps, new Set(), TRACK_NAMES, {
        budgetInr: 5000,
      })
      expect(cert.verdict).toBe("skip")
      expect(cert.breakdown.overBudget).toBe(true)
      // The score is unchanged — only the decision flipped.
      expect(cert.score).toBeGreaterThanOrEqual(4)
      expect(cert.rationale).toContain("over the ₹5,000")
    })

    it("keeps it when the budget covers the cost exactly", () => {
      const [cert] = rankCerts(expensive, gaps, new Set(), TRACK_NAMES, {
        budgetInr: 18000,
      })
      expect(cert.verdict).toBe("worth_it")
      expect(cert.breakdown.overBudget).toBe(false)
    })

    it("never rejects a free certificate, even at a zero budget", () => {
      const [cert] = rankCerts(
        [{ ...expensive[0], id: "free", costInr: null }],
        gaps,
        new Set(),
        TRACK_NAMES,
        { budgetInr: 0 }
      )
      expect(cert.breakdown.overBudget).toBe(false)
      expect(cert.verdict).toBe("worth_it")
    })
  })

  it("exposes every term of the score so the UI can show its working", () => {
    const [cert] = rankCerts(
      [
        {
          id: "b",
          name: "Bench",
          provider: "X",
          costInr: 8000,
          examWindow: null,
          baseValue: 2,
          provesTrackIds: ["system-design"],
          cheaperAlternative: null,
        },
      ],
      gaps,
      new Set(),
      TRACK_NAMES
    )
    const { baseValue, gapPoints, costPenalty, redundancyPenalty } = cert.breakdown
    expect(costPenalty).toBe(2) // 8000 / 4000
    expect(redundancyPenalty).toBe(0)
    // The terms must reconstruct the score, or the panel would be lying.
    expect(baseValue + gapPoints - costPenalty - redundancyPenalty).toBeCloseTo(
      cert.score,
      1
    )
  })

  it("doubles question weight on gap tracks and caps the list", () => {
    const catalog = Array.from({ length: 12 }, (_, i) => ({
      id: `q${i}`,
      prompt: `Question ${i}`,
      trackId: i % 2 === 0 ? "system-design" : "api-design",
      topic: "t",
      company: null,
      round: null,
      year: 2025,
      difficulty: 2,
    }))
    const ranked = rankQuestions(catalog, gaps, TRACK_NAMES, 8)
    expect(ranked).toHaveLength(8)
    // Open-gap questions outrank at-the-bar ones
    expect(ranked[0].trackId).toBe("system-design")
    expect(ranked[0].isGapTrack).toBe(true)
  })
})
