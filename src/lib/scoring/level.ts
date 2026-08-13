import type { EvidenceSignals, LevelRubric } from "./types"

/**
 * How much each kind of evidence is worth, on the 0–10 track scale.
 *
 * The shape of this table encodes an opinion worth defending out loud: a claim
 * on a resume is worth almost nothing, a shipped thing is worth several times
 * a built thing, and a measured outcome is worth more than either. That is the
 * difference between "familiar with Docker" and "here is the pipeline".
 *
 * Exported so the weights can be shown in the UI. Nothing about the scoring is
 * hidden from the student.
 */
export const EVIDENCE_WEIGHTS = {
  /** Named on the resume, nothing behind it. */
  mentioned: 1.0,
  /** Per project that uses the track. */
  perProject: 1.0,
  maxProjects: 3,
  /** Additional credit per project that actually shipped. */
  perShippedProject: 1.0,
  maxShippedProjects: 2,
  /** A measured before/after. The single strongest cheap signal. */
  quantifiedOutcome: 1.0,
  /** Tests exist. Rare enough in student work to be worth real credit. */
  tests: 0.8,
  /** Publicly readable. */
  publicRepo: 0.4,
  /** Per month of internship work, capped. */
  perInternshipMonth: 0.15,
  maxInternshipMonths: 6,
  /** Corroborating coursework. Confirms, never establishes. */
  coursework: { A: 1.0, B: 0.6, C: 0.2, none: 0 } as const,
  /** Used under competition conditions. */
  competition: 0.5,
  /** Per year claimed, capped. Self-reported, so weighted lightly. */
  perYearClaimed: 0.2,
  maxYearsClaimed: 3,
} as const

export interface LevelResult {
  /** 0–10, one decimal. The solid bar on the gauge. */
  level: number
  /** Highest rubric rung this level reaches. Explains the number in words. */
  rungHit: number
  /** Per-signal contributions, so the number can always be shown its working. */
  breakdown: { label: string; points: number }[]
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Evidence → a proven level on the 0–10 scale.
 *
 * Pure, total, and monotonic: adding evidence can never lower a level. That
 * last property is what makes the progress screen honest — a student who does
 * more work cannot watch their number fall.
 */
export function provenLevel(
  signals: EvidenceSignals,
  rubric: LevelRubric
): LevelResult {
  const w = EVIDENCE_WEIGHTS
  const breakdown: { label: string; points: number }[] = []

  const add = (label: string, points: number) => {
    if (points > 0) breakdown.push({ label, points: round1(points) })
    return points
  }

  const projects = clamp(Math.floor(signals.projectCount), 0, w.maxProjects)
  // Shipped projects can't exceed the projects they're drawn from.
  const shipped = clamp(
    Math.floor(signals.shippedProjectCount),
    0,
    Math.min(projects, w.maxShippedProjects)
  )
  const months = clamp(signals.internshipMonths, 0, w.maxInternshipMonths)
  const years = clamp(signals.yearsClaimed ?? 0, 0, w.maxYearsClaimed)

  let total = 0
  total += add("Named on the resume", signals.mentionedOnResume ? w.mentioned : 0)
  total += add(
    `${projects} project${projects === 1 ? "" : "s"}`,
    projects * w.perProject
  )
  total += add(
    `${shipped} shipped`,
    shipped * w.perShippedProject
  )
  total += add(
    "Measured outcome",
    signals.hasQuantifiedOutcome ? w.quantifiedOutcome : 0
  )
  total += add("Tested", signals.hasTests ? w.tests : 0)
  total += add("Public repository", signals.hasPublicRepo ? w.publicRepo : 0)
  total += add(
    `${months} month${months === 1 ? "" : "s"} on the job`,
    months * w.perInternshipMonth
  )
  total += add(
    `Coursework ${signals.courseworkGrade}`,
    w.coursework[signals.courseworkGrade]
  )
  total += add("Competition use", signals.competitionUse ? w.competition : 0)
  total += add(
    `${years} year${years === 1 ? "" : "s"} claimed`,
    years * w.perYearClaimed
  )

  const level = round1(clamp(total, 0, 10))

  return { level, rungHit: rungFor(level, rubric), breakdown }
}

/**
 * The highest rung the level reaches. Returns 0 when the evidence doesn't yet
 * reach the bottom of the ladder — which is a real and common answer.
 */
export function rungFor(level: number, rubric: LevelRubric): number {
  let hit = 0
  for (const rung of rubric) {
    if (level >= rung.level && rung.level > hit) hit = rung.level
  }
  return hit
}

/** The rung's wording, for explaining a gauge in prose. */
export function rungLabel(level: number, rubric: LevelRubric): string | null {
  const hit = rungFor(level, rubric)
  return rubric.find((r) => r.level === hit)?.label ?? null
}

/** The next rung up — what closing the gap actually requires. */
export function nextRung(level: number, rubric: LevelRubric) {
  return (
    [...rubric].sort((a, b) => a.level - b.level).find((r) => r.level > level) ??
    null
  )
}
