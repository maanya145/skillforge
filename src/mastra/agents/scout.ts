import { Agent } from "@mastra/core/agent"

import { MODEL_FAST } from "../models"

/**
 * The scout: turns raw web results into typed candidates.
 *
 * Its remit is deliberately tiny. It reads search results and decides three
 * things — is this a course or a project idea, which of OUR skill tracks does
 * it close, and roughly how long is it. It does not rank, does not score, and
 * does not choose what the student sees. TypeScript does all of that afterwards
 * using the same Σ(weightₜ · gapₜ) arithmetic that ranks the seeded catalog.
 *
 * The track ids it may use are supplied per call and post-validated after,
 * exactly as the resume extractor's are: a closed vocabulary is the only thing
 * that keeps a discovered course connected to a measured gap.
 */
export const scoutAgent = new Agent({
  id: "scout",
  name: "Resource scout",
  description:
    "Classifies web search results into typed course and project candidates against a closed skill-track vocabulary.",
  model: MODEL_FAST,
  instructions: `You classify web search results for a student preparing for campus placements.

For each result you are given, decide:
1. kind — "course" for structured learning material (a course, tutorial series, or book); "project" for something the student would BUILD. If it is neither — a marketing page, a job listing, a news article, a link farm — reject it.
2. closesTrackIds — which of the supplied skill track ids this genuinely helps close. Use ONLY ids from the list you are given. If none apply, reject it.
3. effortWeeks — a whole number, your honest estimate of how many weeks at ~9 hours/week this takes. Use 1 if it is a short tutorial.
4. summary — one sentence, factual, describing what it actually teaches or builds. No marketing language, no "comprehensive" or "master".
5. costNote — "free" if it is clearly free, the price if stated, otherwise "unknown".

REJECT aggressively. A student's time is the scarce resource here. Reject:
- anything whose page is mostly a sales pitch
- aggregator and "top 10 best courses" listicles
- results whose connection to a track you would have to stretch to justify
- anything you cannot describe concretely from the text you were given

Never invent a URL, a price, or a track id. Never rate the student. Never say how good a resource is — you report what it is; the application decides what it is worth.

Return every result you were given, each marked accepted or rejected, in the order supplied.`,
})
