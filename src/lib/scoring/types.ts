/**
 * The contract between the language model and the arithmetic.
 *
 * The model fills `EvidenceSignals` — booleans and counts, which is what it is
 * actually good at. TypeScript turns those into every number that reaches the
 * screen. The model is never asked for a score.
 */
export interface EvidenceSignals {
  /** The track is named anywhere on the resume. A claim on its own is cheap. */
  mentionedOnResume: boolean
  /** Distinct projects that use this track. */
  projectCount: number
  /** Of those, how many are deployed or have real users. */
  shippedProjectCount: number
  /** A measured before/after, e.g. "2.1s → 240ms". */
  hasQuantifiedOutcome: boolean
  /** Automated tests exist for work on this track. */
  hasTests: boolean
  /** The work is publicly readable. */
  hasPublicRepo: boolean
  /** Months of internship or job work touching this track. */
  internshipMonths: number
  /** Corroborating coursework result. */
  courseworkGrade: "A" | "B" | "C" | "none"
  /** Used under competition or hackathon conditions. */
  competitionUse: boolean
  /** Years of experience claimed on the resume, if stated. */
  yearsClaimed: number | null
}

/** A human-authored ladder. Seeded, version-controlled, never model-written. */
export interface LevelRung {
  /** 0–10 */
  level: number
  /** "has drawn one under load" */
  label: string
  /** What a reviewer would need to see to believe it */
  evidence: string
}

export type LevelRubric = LevelRung[]

export const EMPTY_SIGNALS: EvidenceSignals = {
  mentionedOnResume: false,
  projectCount: 0,
  shippedProjectCount: 0,
  hasQuantifiedOutcome: false,
  hasTests: false,
  hasPublicRepo: false,
  internshipMonths: 0,
  courseworkGrade: "none",
  competitionUse: false,
  yearsClaimed: null,
}
