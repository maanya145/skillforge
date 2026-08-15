import { describe, it, expect } from "vitest"

import {
  deriveBenchmark,
  EMPHASIS_WEIGHT,
  type SourceBenchmarkRow,
  type JdMapping,
} from "./derive"

const RUBRIC = [
  { level: 2, label: "basics", evidence: "..." },
  { level: 6, label: "solid", evidence: "..." },
]

const row = (
  trackId: string,
  over: Partial<SourceBenchmarkRow> = {}
): SourceBenchmarkRow => ({
  trackId,
  requiredLevel: 6,
  weight: 2,
  hoursPerLevel: 10,
  isBlocking: false,
  levelRubric: RUBRIC,
  ...over,
})

const map = (
  trackId: string,
  emphasis: JdMapping["emphasis"],
  line = 3
): JdMapping => ({ trackId, emphasis, line, quote: "…" })

describe("deriveBenchmark", () => {
  it("reweights by emphasis and never touches required levels", () => {
    const rows = deriveBenchmark(
      [row("docker"), row("testing"), row("sql")],
      [],
      [map("docker", "core"), map("testing", "mentioned")]
    )
    const byId = Object.fromEntries(rows.map((r) => [r.trackId, r]))
    expect(byId.docker.weight).toBe(2 * EMPHASIS_WEIGHT.core)
    expect(byId.testing.weight).toBe(2 * EMPHASIS_WEIGHT.mentioned)
    expect(byId.sql.weight).toBe(2 * EMPHASIS_WEIGHT.absent)
    // The bar itself is the seeded one, always.
    for (const r of rows) expect(r.requiredLevel).toBe(6)
  })

  it("keeps unmentioned baseline tracks — a JD that forgets testing still needs it", () => {
    const rows = deriveBenchmark([row("testing")], [], [])
    expect(rows).toHaveLength(1)
    expect(rows[0].emphasis).toBe("absent")
    expect(rows[0].weight).toBeGreaterThan(0)
  })

  it("drops isBlocking when the posting never asks for the track", () => {
    const rows = deriveBenchmark(
      [row("dsa", { isBlocking: true }), row("docker", { isBlocking: true })],
      [],
      [map("docker", "core")]
    )
    const byId = Object.fromEntries(rows.map((r) => [r.trackId, r]))
    expect(byId.docker.isBlocking).toBe(true)
    expect(byId.dsa.isBlocking).toBe(false)
  })

  it("imports a mapped track the base role lacks, from the strongest other row", () => {
    const rows = deriveBenchmark(
      [row("sql")],
      [
        row("docker", { weight: 1, requiredLevel: 5 }),
        row("docker", { weight: 3, requiredLevel: 6 }),
      ],
      [map("docker", "core")]
    )
    const docker = rows.find((r) => r.trackId === "docker")!
    expect(docker.requiredLevel).toBe(6)
    expect(docker.weight).toBe(3 * EMPHASIS_WEIGHT.core)
    // Imported on the posting's authority — never hard-blocking.
    expect(docker.isBlocking).toBe(false)
  })

  it("silently drops a mapping no benchmark has a row for", () => {
    const rows = deriveBenchmark([row("sql")], [], [map("blockchain", "core")])
    expect(rows.map((r) => r.trackId)).toEqual(["sql"])
  })

  it("core beats mentioned when a track is cited twice, keeping the core citation", () => {
    const rows = deriveBenchmark(
      [row("docker")],
      [],
      [map("docker", "mentioned", 2), map("docker", "core", 7)]
    )
    expect(rows[0].emphasis).toBe("core")
    expect(rows[0].line).toBe(7)
  })

  it("orders core → mentioned → absent, then by weight", () => {
    const rows = deriveBenchmark(
      [row("a", { weight: 1 }), row("b", { weight: 3 }), row("c", { weight: 2 })],
      [],
      [map("a", "mentioned"), map("c", "core")]
    )
    expect(rows.map((r) => r.trackId)).toEqual(["c", "a", "b"])
  })

  it("is deterministic — same inputs, same output", () => {
    const args: [SourceBenchmarkRow[], SourceBenchmarkRow[], JdMapping[]] = [
      [row("a"), row("b")],
      [row("c")],
      [map("a", "core"), map("c", "mentioned")],
    ]
    expect(deriveBenchmark(...args)).toEqual(deriveBenchmark(...args))
  })
})
