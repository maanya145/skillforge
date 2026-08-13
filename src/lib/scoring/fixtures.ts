import type { EvidenceSignals, LevelRubric } from "./types"
import { EMPTY_SIGNALS } from "./types"
import type { BenchmarkRow } from "./gap"

/** Convenience for tests and seeds: start from nothing, state only what differs. */
export function signals(over: Partial<EvidenceSignals> = {}): EvidenceSignals {
  return { ...EMPTY_SIGNALS, ...over }
}

/**
 * A four-rung ladder is the default shape: name it, build it, justify it,
 * break it. Tracks override this where the progression genuinely differs.
 */
export const GENERIC_RUBRIC: LevelRubric = [
  { level: 2, label: "Can name the pieces", evidence: "Mentions it; no artefact." },
  { level: 4, label: "Has built with it", evidence: "A project uses it." },
  { level: 6, label: "Has justified a decision", evidence: "Shipped, with a measured outcome." },
  { level: 8, label: "Has broken it deliberately", evidence: "Tested it to failure and wrote it up." },
]

export const SYSTEM_DESIGN_RUBRIC: LevelRubric = [
  { level: 2, label: "Can name the components", evidence: "Uses the vocabulary." },
  { level: 4, label: "Has drawn one under load", evidence: "A diagram with a bottleneck identified." },
  { level: 6, label: "Has estimated capacity and justified a cache", evidence: "Numbers behind the choice." },
  { level: 8, label: "Has broken a real system and written it up", evidence: "A load test and a postmortem." },
]

/**
 * The demo student — Aarav Menon, B.Tech CSE year 3, targeting backend.
 *
 * These signal sets are what the extraction agent is expected to produce from
 * fixtures/aarav-menon-resume-v4.pdf. Holding them here as data means the
 * scoring maths can be regression-tested without a model call, and the
 * extraction eval has something concrete to be graded against.
 */
export const AARAV_SIGNALS: Record<string, EvidenceSignals> = {
  // Backend lead on the SIH build and shipped the mess portal, so the
  // vocabulary is there — but nothing shows capacity estimation or caching.
  "system-design": signals({
    mentionedOnResume: true,
    projectCount: 1,
    competitionUse: true,
  }),

  // "Familiar with Docker" on the resume with nothing behind it.
  "docker-cicd": signals({ mentionedOnResume: true, yearsClaimed: 1 }),

  // No test file in any repository.
  testing: signals({ mentionedOnResume: true }),

  // OS coursework at B, no applied work.
  concurrency: signals({ mentionedOnResume: true, courseworkGrade: "B", competitionUse: true }),

  // Strong on trees, slow on shortest paths. Competitive practice, no repo.
  dsa: signals({
    mentionedOnResume: true,
    projectCount: 2,
    competitionUse: true,
    courseworkGrade: "A",
    yearsClaimed: 3,
    hasPublicRepo: true,
  }),

  // Mess portal + slow-query work, DBMS at A, a measured 2.1s → 240ms.
  "sql-modelling": signals({
    mentionedOnResume: true,
    projectCount: 2,
    shippedProjectCount: 1,
    hasQuantifiedOutcome: true,
    hasPublicRepo: true,
    courseworkGrade: "A",
    internshipMonths: 2,
  }),

  // The mess portal is real, shipped, and has users.
  "api-design": signals({
    mentionedOnResume: true,
    projectCount: 3,
    shippedProjectCount: 2,
    hasQuantifiedOutcome: true,
    hasPublicRepo: true,
    internshipMonths: 2,
    courseworkGrade: "A",
  }),

  // Daily driver, internship tooling, networks at A.
  "linux-shell": signals({
    mentionedOnResume: true,
    projectCount: 2,
    shippedProjectCount: 1,
    hasPublicRepo: true,
    internshipMonths: 2,
    courseworkGrade: "A",
    yearsClaimed: 3,
  }),
}

/**
 * Backend engineer benchmark, abridged to the eight tracks the demo exercises.
 * `hoursPerLevel` is what turns a gap into a date, so it is authored per track
 * rather than assumed uniform: system design is slow to move, Docker is fast.
 */
export const BACKEND_BENCHMARK: BenchmarkRow[] = [
  { trackId: "system-design", requiredLevel: 6, weight: 1.6, hoursPerLevel: 16, isBlocking: true },
  { trackId: "docker-cicd", requiredLevel: 6, weight: 1.2, hoursPerLevel: 9, isBlocking: true },
  { trackId: "testing", requiredLevel: 5, weight: 1.0, hoursPerLevel: 9, isBlocking: false },
  { trackId: "concurrency", requiredLevel: 7, weight: 1.3, hoursPerLevel: 12, isBlocking: false },
  { trackId: "dsa", requiredLevel: 8, weight: 1.5, hoursPerLevel: 27, isBlocking: false },
  { trackId: "sql-modelling", requiredLevel: 7, weight: 1.4, hoursPerLevel: 14, isBlocking: false },
  { trackId: "api-design", requiredLevel: 7, weight: 1.3, hoursPerLevel: 12, isBlocking: false },
  { trackId: "linux-shell", requiredLevel: 5, weight: 0.8, hoursPerLevel: 8, isBlocking: false },
]

export const AARAV_WEEKLY_HOURS = 9
