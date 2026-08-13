import type { Gauge } from "@/components/viz/gap-gauge"

/**
 * Illustrative data for the public landing page ONLY.
 *
 * Nothing in the product reads this. Every gauge a signed-in student sees is
 * computed by src/lib/scoring/ from their own resume and the seeded role
 * benchmarks. This file exists so the marketing hero can show the real
 * component rather than a screenshot.
 */
export const SAMPLE_GAUGES: Gauge[] = [
  {
    trackId: "system-design",
    name: "System design",
    provenLevel: 2.0,
    requiredLevel: 6.0,
    gap: 4.0,
    weeksToClose: 7,
    status: "open",
    note: "Thin on estimation, caching, sharding",
  },
  {
    trackId: "docker-cicd",
    name: "Docker & CI/CD",
    provenLevel: 3.0,
    requiredLevel: 6.0,
    gap: 3.0,
    weeksToClose: 3,
    status: "open",
    note: "Claimed on the resume, no project behind it",
  },
  {
    trackId: "testing",
    name: "Testing",
    provenLevel: 2.0,
    requiredLevel: 5.0,
    gap: 3.0,
    weeksToClose: 3,
    status: "open",
    note: "No test file in any repository",
  },
  {
    trackId: "concurrency",
    name: "Concurrency (Go)",
    provenLevel: 4.0,
    requiredLevel: 7.0,
    gap: 3.0,
    weeksToClose: 4,
    status: "open",
    note: "Coursework only, no applied work",
  },
  {
    trackId: "dsa",
    name: "DSA — graphs & DP",
    provenLevel: 6.0,
    requiredLevel: 8.0,
    gap: 2.0,
    weeksToClose: 6,
    status: "open",
    note: "Solid on trees, slow on shortest paths",
  },
  {
    trackId: "sql-modelling",
    name: "SQL & data modelling",
    provenLevel: 6.4,
    requiredLevel: 7.0,
    gap: 0.6,
    weeksToClose: 1,
    status: "open",
    note: "Index lab part 2 finishes this",
  },
  {
    trackId: "api-design",
    name: "REST & API design",
    provenLevel: 7.0,
    requiredLevel: 7.0,
    gap: 0,
    weeksToClose: 0,
    status: "met",
    note: "Met the bar with the mess portal",
  },
  {
    trackId: "linux-shell",
    name: "Linux & shell",
    provenLevel: 6.0,
    requiredLevel: 5.0,
    gap: 0,
    weeksToClose: 0,
    status: "above",
    note: "Above the bar",
  },
]

export const SAMPLE_READINESS = 71
export const SAMPLE_OPEN_GAPS = 5
export const SAMPLE_TOTAL_TRACKS = 12
