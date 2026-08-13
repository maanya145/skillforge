import { z } from "zod"

import { verifyQuote } from "@/lib/pdf/extract"
import { EMPTY_SIGNALS, type EvidenceSignals } from "@/lib/scoring/types"

/**
 * What the extraction agent is allowed to say.
 *
 * Every field is a fact, a count or a location. There is no score anywhere in
 * this schema, because the model is never asked for one — TypeScript computes
 * levels from these signals. See the contract in README.md.
 */
export const evidenceSignalsSchema = z.object({
  mentionedOnResume: z.boolean(),
  projectCount: z.number().int().min(0).max(20),
  shippedProjectCount: z.number().int().min(0).max(20),
  hasQuantifiedOutcome: z.boolean(),
  hasTests: z.boolean(),
  hasPublicRepo: z.boolean(),
  internshipMonths: z.number().int().min(0).max(60),
  courseworkGrade: z.enum(["A", "B", "C", "none"]),
  competitionUse: z.boolean(),
  yearsClaimed: z.number().min(0).max(20).nullable(),
})

export const resumeExtractionSchema = z.object({
  candidate: z.object({
    fullName: z.string().max(80).nullable(),
    college: z.string().max(120).nullable(),
    gradYear: z.number().int().min(2020).max(2035).nullable(),
  }),

  sectionsFound: z.array(z.string().max(40)).max(12),

  /** The chips on the intake screen. */
  skills: z
    .array(
      z.object({
        rawLabel: z.string().min(1).max(40),
        trackId: z
          .string()
          .nullable()
          .describe("MUST be an id from the provided track list, or null"),
        confidence: z.number().min(0).max(1),
      })
    )
    .max(40),

  /** One entry per PROVIDED track. The model may not invent tracks. */
  trackSignals: z.array(
    z.object({
      trackId: z.string(),
      signals: evidenceSignalsSchema,
      rubricEvidence: z
        .string()
        .max(220)
        .describe(
          "Which rung of the ladder the evidence supports, and why. No numbers."
        ),
      note: z
        .string()
        .max(90)
        .describe(
          'Gauge footer line, e.g. "Claimed on the resume, no project behind it"'
        ),
    })
  ),

  evidence: z
    .array(
      z.object({
        /**
         * Deliberately a free string, not an enum.
         *
         * The database column IS an enum, but validating it here would reject
         * the entire extraction over one word — a real run died because the
         * model classified a hackathon placing as "achievement" rather than
         * "award", throwing away eleven perfectly good track signals with it.
         * Models will keep inventing plausible neighbours, so the value is
         * normalised to the enum in `normaliseEvidenceKind` instead.
         */
        kind: z.string().max(30),
        title: z.string().max(60),
        detail: z.string().max(80),
        metric: z.string().max(24).nullable(),
        sourcePage: z.number().int().min(1),
        sourceLine: z.number().int().min(1),
        trackIds: z.array(z.string()).max(6),
      })
    )
    .max(20),

  flags: z
    .array(
      z.object({
        page: z.number().int().min(1),
        line: z.number().int().min(1),
        quote: z
          .string()
          .max(120)
          .describe("VERBATIM substring of that line of the resume"),
        critique: z.string().max(260),
        suggestedFix: z.string().max(200).nullable(),
        severity: z.number().int().min(1).max(3),
      })
    )
    .max(6),
})

export type ResumeExtraction = z.infer<typeof resumeExtractionSchema>

/** What survived validation, and what didn't — surfaced in the run log. */
export interface SanitisedExtraction {
  extraction: ResumeExtraction
  dropped: {
    unknownTracks: string[]
    unverifiableFlags: { quote: string; page: number; line: number }[]
    unknownSkillTracks: number
  }
  /** Every seeded track, with signals if the model reported them. */
  signalsByTrack: Record<string, EvidenceSignals>
}

/**
 * The two guards that matter more than the schema itself.
 *
 * Zod can prove `trackId` is a string. It cannot prove it is one of the twelve
 * ids that exist, and it cannot prove a quote appears in the source document.
 * Both are exactly the shapes a language model invents under pressure, so both
 * are checked against ground truth here and dropped when they fail.
 *
 * Dropping rather than throwing is deliberate: a resume that produces four good
 * flags and one hallucinated one should yield four flags, not an error page.
 */
export function sanitiseExtraction(
  extraction: ResumeExtraction,
  knownTrackIds: readonly string[],
  pagesText: string[]
): SanitisedExtraction {
  const known = new Set(knownTrackIds)

  const unknownTracks: string[] = []
  const trackSignals = extraction.trackSignals.filter((t) => {
    if (known.has(t.trackId)) return true
    unknownTracks.push(t.trackId)
    return false
  })

  // A flag whose quote is not on the line it cites is an invented flag.
  const unverifiableFlags: SanitisedExtraction["dropped"]["unverifiableFlags"] =
    []
  const flags = extraction.flags.filter((f) => {
    if (verifyQuote(pagesText, f.page, f.line, f.quote)) return true
    unverifiableFlags.push({ quote: f.quote, page: f.page, line: f.line })
    return false
  })

  // Skill chips may map to no track — that's legitimate ("Figma"). But a chip
  // claiming a track id that doesn't exist is noise.
  let unknownSkillTracks = 0
  const skills = extraction.skills.map((s) => {
    if (s.trackId && !known.has(s.trackId)) {
      unknownSkillTracks++
      return { ...s, trackId: null }
    }
    return s
  })

  const evidence = extraction.evidence.map((e) => ({
    ...e,
    kind: normaliseEvidenceKind(e.kind),
    trackIds: e.trackIds.filter((id) => known.has(id)),
  }))

  // Every seeded track gets an entry. A track the model said nothing about
  // means no evidence was found, which is a real answer and scores as zero —
  // not a missing gauge.
  const signalsByTrack: Record<string, EvidenceSignals> = {}
  for (const id of knownTrackIds) {
    signalsByTrack[id] =
      trackSignals.find((t) => t.trackId === id)?.signals ?? {
        ...EMPTY_SIGNALS,
      }
  }

  return {
    extraction: { ...extraction, trackSignals, flags, skills, evidence },
    dropped: { unknownTracks, unverifiableFlags, unknownSkillTracks },
    signalsByTrack,
  }
}

/** Gauge footer text, when the model didn't supply a usable one. */
export function noteForTrack(
  extraction: ResumeExtraction,
  trackId: string
): string {
  const note = extraction.trackSignals.find((t) => t.trackId === trackId)?.note
  return note?.trim() || "No supporting evidence found on the resume."
}

/** The enum the `resume_evidence.kind` column actually accepts. */
export type EvidenceKind =
  | "project"
  | "internship"
  | "award"
  | "coursework"
  | "publication"

const EVIDENCE_KINDS = new Set<EvidenceKind>([
  "project",
  "internship",
  "award",
  "coursework",
  "publication",
])

/**
 * Maps whatever the model called it onto the five kinds the column stores.
 *
 * Observed in real runs: "achievement" for a hackathon placing. The synonyms
 * below cover the obvious neighbours; anything genuinely unrecognised becomes
 * a project, which is the least misleading default for a student resume — an
 * artefact they built rather than something they were given.
 */
export function normaliseEvidenceKind(raw: string): EvidenceKind {
  const k = raw.trim().toLowerCase()
  if (EVIDENCE_KINDS.has(k as EvidenceKind)) return k as EvidenceKind

  if (/achiev|honou?r|prize|award|winner|finalist|rank|medal/.test(k)) return "award"
  if (/course|class|subject|academic|education|degree|grade/.test(k)) return "coursework"
  if (/intern|job|employ|work|professional|experience|role/.test(k)) return "internship"
  if (/paper|publicat|journal|conference|research|thesis|patent/.test(k)) return "publication"
  return "project"
}
