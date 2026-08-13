import type { GapResult } from "@/lib/scoring/gap"

/**
 * Deterministic ranking of projects, certifications and interview questions
 * against a student's open gaps. No model call anywhere in this file — which
 * is what makes "three of the four certifications say don't bother" a property
 * of the algorithm rather than a lucky sample.
 *
 * Every score is Σ(weightₜ · gapₜ) over the tracks an item touches: literally
 * "how many readiness points is this worth", divided or discounted by what it
 * costs. The rationales are templates over the same numbers, so the prose can
 * never disagree with the arithmetic.
 */

const round1 = (n: number) => Math.round(n * 10) / 10

function gapPoints(trackIds: string[], byTrack: Map<string, GapResult>) {
  let points = 0
  const closes: string[] = []
  for (const id of trackIds) {
    const g = byTrack.get(id)
    if (g && g.status === "open") {
      points += g.weight * g.gap
      closes.push(id)
    }
  }
  return { points, closes }
}

// ─── Projects ────────────────────────────────────────────────────────────────

export interface CatalogProject {
  id: string
  title: string
  summary: string
  effortWeeks: number
  closesTrackIds: string[]
  requiresTrackIds: string[]
  evidenceProduced: string
}

export interface RankedProject extends CatalogProject {
  score: number
  rank: number
  rationale: string
  /** Which of its tracks are actually open for this student */
  closesOpenTrackIds: string[]
}

export function rankProjects(
  catalog: CatalogProject[],
  gaps: GapResult[],
  trackNames: Record<string, string>
): RankedProject[] {
  const byTrack = new Map(gaps.map((g) => [g.trackId, g]))

  return catalog
    .map((p) => {
      const { points, closes } = gapPoints(p.closesTrackIds, byTrack)
      // Prior art bonus: extending something already started is cheaper than
      // starting cold — the CI-retrofit effect.
      const priorArt = p.closesTrackIds.some(
        (id) => (byTrack.get(id)?.provenLevel ?? 0) > 2
      )
      const score = round1((points / Math.max(1, p.effortWeeks)) * (priorArt ? 1.35 : 1))

      const names = closes.map((id) => trackNames[id] ?? id)
      const rationale =
        closes.length === 0
          ? `Covers ${p.closesTrackIds.map((id) => trackNames[id] ?? id).join(", ")} — already at the bar, so this is polish, not gap work.`
          : `Closes ${names.join(" and ")} — worth ${round1(points)} weighted gap points for ${p.effortWeeks} week${p.effortWeeks === 1 ? "" : "s"} of work${priorArt ? ", building on evidence you already have" : ""}. Produces: ${p.evidenceProduced}`

      return { ...p, score, rationale, closesOpenTrackIds: closes, rank: 0 }
    })
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }))
}

// ─── Certifications ──────────────────────────────────────────────────────────

export type CertVerdict = "worth_it" | "skip" | "later"

export interface CatalogCert {
  id: string
  name: string
  provider: string
  costInr: number | null
  examWindow: string | null
  baseValue: number
  provesTrackIds: string[]
  cheaperAlternative: string | null
}

export interface RankedCert extends CatalogCert {
  score: number
  rank: number
  verdict: CertVerdict
  rationale: string
}

export function rankCerts(
  catalog: CatalogCert[],
  gaps: GapResult[],
  /** Track ids a scheduled project already closes — makes the cert redundant */
  coveredByProjects: Set<string>,
  trackNames: Record<string, string>
): RankedCert[] {
  const byTrack = new Map(gaps.map((g) => [g.trackId, g]))

  return catalog
    .map((c) => {
      const { points, closes } = gapPoints(c.provesTrackIds, byTrack)
      const redundant =
        c.cheaperAlternative !== null &&
        c.provesTrackIds.some((id) => coveredByProjects.has(id))

      const score = round1(
        c.baseValue + points - (c.costInr ?? 0) / 4000 - (redundant ? 3 : 0)
      )
      const verdict: CertVerdict =
        score >= 4 ? "worth_it" : score >= 1.5 ? "later" : "skip"

      const rationale = redundant
        ? (c.cheaperAlternative as string)
        : verdict === "worth_it"
          ? `Proves ${closes.map((id) => trackNames[id] ?? id).join(", ") || "breadth"} where you're short${c.costInr ? ` · ₹${c.costInr.toLocaleString("en-IN")}` : ""}${c.examWindow ? ` · ${c.examWindow}` : ""}`
          : verdict === "later"
            ? `Real value, wrong moment — revisit once the current gaps close.`
            : closes.length === 0
              ? `Off your gap list — the tracks it proves are already at the bar.`
              : `The cost doesn't buy enough readiness against your open gaps.`

      return { ...c, score, verdict, rationale, rank: 0 }
    })
    .sort((a, b) => b.score - a.score)
    .map((c, i) => ({ ...c, rank: i + 1 }))
}

// ─── Interview questions ─────────────────────────────────────────────────────

export interface CatalogQuestion {
  id: string
  prompt: string
  trackId: string
  topic: string
  company: string | null
  round: string | null
  year: number | null
  difficulty: number
}

export interface RankedQuestion extends CatalogQuestion {
  score: number
  rank: number
  isGapTrack: boolean
  coachNote: string
}

export function rankQuestions(
  catalog: CatalogQuestion[],
  gaps: GapResult[],
  trackNames: Record<string, string>,
  limit = 8
): RankedQuestion[] {
  const byTrack = new Map(gaps.map((g) => [g.trackId, g]))

  return catalog
    .map((q) => {
      const g = byTrack.get(q.trackId)
      const isGapTrack = g?.status === "open"
      const weight = g?.weight ?? 1
      const gap = Math.max(g?.gap ?? 0, 0.5)
      const recency =
        q.year == null ? 1 : q.year >= 2025 ? 1.2 : q.year >= 2024 ? 1 : 0.8
      const score = round1((isGapTrack ? 2 : 1) * weight * gap * recency)

      const coachNote = isGapTrack
        ? `${trackNames[q.trackId] ?? q.trackId} is an open gap — expect to struggle, that's why it's here.`
        : `You're at the bar on ${trackNames[q.trackId] ?? q.trackId}; treat this as consolidation.`

      return { ...q, score, isGapTrack, coachNote, rank: 0 }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((q, i) => ({ ...q, rank: i + 1 }))
}
