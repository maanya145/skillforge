# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Engineering students in India preparing for campus placements — typically B.Tech CSE, final or pre-final year, working alone on their own account. The situation is specific: a fixed placement season is approaching, the student has a resume that overstates some things and understates others, and they do not know which of the twenty things they could study actually changes whether they get an offer.

The job is triage under time pressure: *given what I can prove today and the hours I actually have each week, what do I do next.*

**Not the audience.** Placement cells, colleges and cohort administrators are not users of this product. The landing page carries a "For colleges" section; it is aspirational positioning, not a served audience. Future work should not build cohort views, staff reporting or institutional admin against it.

## Product Purpose

A student uploads a resume. The product reads it, measures the evidence against a published benchmark for a target role, and returns a skill map, a scheduled 14-week plan, ranked things to build and practise, and a readiness score that moves only when a gap actually closes.

Success is a student knowing, specifically and with the reasoning shown, what to do this week and why that rather than something else.

## Positioning

Existing platforms give generic recommendations. The differentiator here is not that a model reads a resume — it is that every number on screen is explicable and reproducible.

The implementation reflects that: the model extracts facts and writes prose, while TypeScript computes every level, gap, week, rank and score from seeded, version-controlled role benchmarks. The benchmarks, the arithmetic and the evidence weights are published at `/benchmarks` without an account, so the claim is checkable rather than asserted. A judge can ask "why is system design a 2?" and get a rubric rung and a resume line number.

*Status: this is an accurate description of the current implementation, verified in code and tests. It was not confirmed as a binding constraint during init — future work may revisit it, but should do so deliberately, because the public benchmark page and most of the product's copy currently depend on it.*

## Operating Context

- **Horizon: a hackathon demo, judged live.** The work must survive being presented and questioned in person. Demo reliability and the ability to explain any number on screen outrank scale, cost and multi-tenant concerns, which are not yet real.
- Two demo modes exist and both must keep working: a pre-populated account, and a live resume upload.
- Students arrive with PDFs of varying quality — LaTeX, Word exports, Canva designs and phone photographs of printouts.
- The 14-week horizon is not arbitrary; it is the realistic runway between deciding to prepare and the placement season starting.

## Capabilities and Constraints

**Confirmed capabilities.** Resume intake (PDF, pasted text, and OCR for scans); 12 skill tracks scored 0–10 against 5 target roles; instant role switching that re-scores cached evidence with no second model call; a 14-week three-lane schedule derived from prerequisites; ranked projects, certifications and interview questions; a readiness trend; a streaming mentor with tools over the student's own measured state; read-only GitHub portfolio inspection; web discovery of courses and projects; a generative-UI surface; a gap-ranked news feed; and shareable read-only report links.

**Binding constraints.**

- **India and campus placements are intrinsic, not a locale.** Rupee costs, Indian company interview questions, B.Tech and campus-placement vocabulary, and the pre-placement-season horizon are part of what the product is. Future work must not genericise them into an internationalisation layer.
- **Free and keyless external services are a deliberate constraint, not a temporary state.** Wherever a capability can run without a paid key it must — currently the free model tier, keyless Exa search, Hacker News, Wikipedia and MDN. Optional keys (`GITHUB_TOKEN`, `FIRECRAWL_API_KEY`) lift limits but the product degrades gracefully without them, and that degradation is a feature to preserve.

**Known temporary states.** The certification catalogue holds 6 hand-authored rows against an original budget of 12. The free model tier's latency has been observed between 164s and 1068s for a full analysis, which exceeds the 300s serverless ceiling on the current hosting plan; live upload is therefore the less reliable of the two demo modes.

**Explicitly undecided.** Whether the determinism contract and the dark-only interface are permanent commitments. Both are the current implementation; neither was confirmed binding.

## Brand Commitments

- **Name:** SkillForge. The mark is a hairline square with a rising path breaking out of its top-right corner — the gap being closed, which is the product's thesis.
- **Voice:** a good senior engineer who has the student's back. Direct, warm, specific. Honest without being bleak; encouraging without being hollow. Concrete instruction beats reassurance — "the CI retrofit is two weeks and closes Docker, which is blocking you" over any amount of encouragement.
- **No fabricated proof.** The product must never invent a statistic, a customer, a testimonial, a benchmark source or a market figure. Where a number would be needed and none was measured, the honest move is to say so or to omit it. This has already been enforced once by removing invented copy.

## Evidence on Hand

- A committed fixture resume and its extracted text (`fixtures/aarav-menon-resume-v4.pdf`).
- A seeded demo student with a full analysis, roadmap and readiness history (`npm run db:demo`).
- Seeded, version-controlled benchmark data: 5 roles, 12 skill tracks with rubric ladders, role benchmarks at version 2026.1, ~30 projects, 6 certifications, ~80 interview questions.
- 81 passing unit tests over the scoring, scheduling, ranking, PDF-citation and gantt-layout logic.
- A live deployment at `skillforge-eight-pink.vercel.app`.
- Verification scripts that exercise real external services: `check:workflow`, `check:mentor`, `check:portfolio`, `check:discovery`, `check:feed`, `check:studio`, `check:ocr`.

**Absences future work must not fabricate.** There are no real users, no usage data, no outcome data, no placement statistics, no testimonials and no institutional partners. The interview questions are archetypes drawn from publicly shared experiences, not transcripts.

## Product Principles

1. **Show the working.** Any number a student sees must be traceable to a rubric rung, a resume line, or an arithmetic expression they can read. Explicability is the product.
2. **Refuse to flatter.** Under-claiming beats over-claiming. Say "not observed" rather than implying absence is proof, and never let a recommendation imply readiness the evidence does not support.
3. **Specific beats supportive.** The student is under real time pressure; respect that by being useful rather than soothing.
4. **Only real work moves the number.** Readiness changes when a gap closes, not when hours are logged or a page is read. Anything that suggests otherwise has been removed.
5. **Degrade honestly.** When a service is missing, slow or rate-limited, say what happened and offer the path that still works. Never present a fallback as though it were the full result.
