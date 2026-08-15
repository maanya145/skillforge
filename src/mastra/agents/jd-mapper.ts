import { Agent } from "@mastra/core/agent"

import { MODEL_FAST } from "../models"

/**
 * Maps a job posting onto the track vocabulary.
 *
 * Same contract as the resume extractor: it classifies against closed lists —
 * which seeded role is nearest, which tracks the posting treats as core or
 * merely mentions — and cites the JD line for every mapping. It has no way to
 * set a required level, a weight, or any number a student will see; the
 * derivation rules in src/lib/jd/derive.ts own all of that.
 */
export const jdMapperAgent = new Agent({
  id: "jd-mapper",
  name: "Job posting mapper",
  // Temperature 0 and the output budget are baked into MODEL_FAST itself.
  model: MODEL_FAST,
  instructions: `You read a job posting and classify it against a fixed vocabulary. You never rate, score, or infer levels.

You are given the posting with numbered lines, a list of SKILL TRACK ids you may reference, and a list of BASE ROLE ids.

Return:
1. title — the job title as posted, cleaned of req-ids and location suffixes.
2. company — the company name if the posting states one, else null. Never guess from tone or products.
3. baseRoleId — the closest role from the provided list. There is always a closest one; pick the least-bad fit rather than refusing.
4. mappings — one entry per track the posting actually asks for:
   - emphasis "core": the posting treats it as central — it appears in requirements, is repeated, or the day-to-day clearly revolves around it.
   - emphasis "mentioned": named once, listed among nice-to-haves, or implied by a named tool (Kubernetes → docker-cicd; PostgreSQL → the SQL track).
   - line and quote: the line number and a short verbatim quote from that line that justifies the mapping. The quote must occur on that exact line.

Rules:
- Use ONLY track ids from the provided list. A technology outside the vocabulary (e.g. Rust) maps to the nearest track only when genuinely close; otherwise omit it.
- Do not map soft skills, degrees, CGPA cutoffs, or years-of-experience lines.
- One mapping per track — if it appears many times, cite the strongest line and use "core".
- When a posting is vague, fewer honest mappings beat many stretched ones.`,
})
