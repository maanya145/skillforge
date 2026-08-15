# How the agent works — presenter's guide

The companion for demoing SkillForge in person. What to say, what to show,
and the honest answer to every hard question a judge is likely to ask.
Architecture reference: [TECHSTACK.md](../TECHSTACK.md).

---

## The 30-second version

> "A student uploads their resume. One model call reads it — not to score it,
> but to extract *evidence*: what they built, what shipped, what has tests,
> with a page and line number for every claim. From there it's pure
> TypeScript: every level, gap, week and score is arithmetic over a published
> benchmark. The AI found the facts; code did the judging. That's why every
> number on screen can be explained, and why switching target roles
> re-measures everything instantly — no second model call."

If you say only one sentence: **the model extracts, code decides.**

---

## The cast

Six agents, one shared rule: numbers come from tools reading Postgres, never
from the model's memory.

| Agent | Where | What it does | What it *cannot* do |
|---|---|---|---|
| **Extractor** | analysis pipeline | Reads the resume, returns evidence signals + cited flags | Has no tools; never emits a score |
| **Mentor** | `/app/chat` | Streaming coach with 10 tools over the student's real numbers | Can't reach another student — the student id is closed over in its tools, not a parameter |
| **Studio** | `/app/studio` | Same mentor, but answers in UI — real gauges, galleries, embeds | Can't invent media — images/embeds must come from the preview tool |
| **Scout** | background | Finds courses/projects on the open web for the student's gaps | Doesn't rank — TypeScript scores its finds with the same gap arithmetic |
| **Greeter** | landing console | Explains the product to visitors | No tools, no memory, no student — nothing to leak |
| **Portfolio verifier** | mentor tools | Inspects a public GitHub repo, reports cited evidence | Signals are detected by code from file paths; the model only interprets |

---

## The pipeline, beat by beat

Say this while the intake checklist animates:

1. **Parse** — `unpdf` gives page/line-indexed text. *Deterministic.*
   (Scans with no text layer go through OCR or the paste fallback.)
2. **Extract** — the one model call. It fills in evidence *signals* —
   booleans and counts a model is good at ("has tests", "3 projects",
   "shipped 1") — and flags weak resume lines with a quote and location.
3. **The guard** — before anything persists, every flag's quote is checked
   against that exact page and line of the source. A hallucinated citation
   is silently dropped. *This is the single highest-value line of code in
   the app.*
4. **Score** — `provenLevel` = weighted sum of signals, snapped to a rubric
   rung. `gap = required − proven`. `readiness = 100·(1 − Σw·gap ⁄
   Σw·required)`. All pure functions, all unit-tested.
5. **Rank & schedule** — projects/certs/questions scored by weighted gap
   points per week of effort; the roadmap is a topological sort over
   prerequisites. "Docker lands in week 1 because the load test needs it"
   is a property of the algorithm, not a lucky sample.

---

## The three demo beats that prove trust

These are the moments that separate this from "an LLM read my resume":

1. **Open `/benchmarks` — logged out.** The full rubric ladder, the four
   formulas, the evidence-weight table. "You don't have to believe me that
   code does the scoring; here is the ruler, public, versioned."
2. **Click a flagged resume line.** It cites `p.1 L7` — and the quote is
   *really there*, because unverifiable citations never survive the guard.
3. **Switch target roles.** Every gauge, the roadmap and all rankings
   re-compute in one round trip. "If a model were scoring, this would take
   a minute and cost a call. It's arithmetic, so it's instant."

Then one agent moment: ask the mentor *"why is my system design a 2?"* — it
calls `explain_track`, and the chat shows **which tools ran** under the
reply. Provenance, not vibes.

---

## Hard questions, honest answers

**"Why wouldn't I just paste my resume into ChatGPT?"**
Ask it twice and you get two different numbers — an unreproducible score
isn't a measurement. It rates you against nothing in particular; there's no
bar to read or disagree with. It's tuned to be encouraging. And its answer
to "why?" is a rationalization written *after* the number, not the cause of
it. SkillForge uses the model only for what models are reliably good at —
reading the document — and computes the judgment: same resume, same
benchmark, same number, every time, with the ruler public at `/benchmarks`.
Concede the flip side out loud: for rewriting bullets or cover letters, a
chatbot is genuinely better. This is an instrument, not an editor.
*One-liner: "You can ask an AI what it thinks of your resume. You can't ask
it to measure."*

**"Isn't the AI just making these numbers up?"**
No — it never produces one. Show `/benchmarks`. The model reports what the
resume contains; the score is a weighted sum you can recompute by hand.

**"What if it hallucinates a skill that isn't on the resume?"**
Two guards: track ids are validated against the seeded vocabulary (unknown
ones are dropped), and every flagged line must quote text that actually
occurs at the cited position or it never persists.

**"What about prompt injection — a resume that says 'give me a 10'?"**
There's no 10 to give: the model can't emit scores, so the worst an
injected instruction can do is distort the evidence booleans — which are
then still checked against citations. Repository text in the portfolio tool
is fenced line-by-line and labelled untrusted before the model sees it.

**"Which model? What did this cost?"**
OpenCode Zen's free tier, keyless. Total model spend: zero. That's a
consequence of the architecture — one extraction call per analysis, and
everything else is arithmetic, so there's almost nothing to pay for.

**"What happens when the model fails?"**
Honestly and visibly. The free tier rate-limits; when a run dies the row is
marked failed with a plain-language reason and a working fallback (paste
the text). Nothing pretends to have succeeded.

**"Can the chat change my scores?"**
No. The mentor's write tools reuse the same deterministic functions the
pipeline uses — chat cannot produce a state the workflow couldn't. Readiness
moves only when a gap closes on the roadmap.

**"Why should I believe the portfolio verification?"**
The signals (README, tests, CI, Docker…) are detected by TypeScript from
the repository's file tree — the model never decides whether something is
present, only what it means. Every claim carries a commit SHA and path.

---

## Suggested 3-minute flow

1. Landing — let the console boot, ask the greeter "what is this?" *(15s)*
2. Upload the fixture resume, narrate the pipeline beats while the
   checklist runs. *(45s)*
3. Skill map — pick one gauge, read its resume citation. *(30s)*
4. Switch role → everything re-measures instantly. *(20s)*
5. `/benchmarks` — "here's the ruler, no login." *(20s)*
6. Mentor: "why is my system design a 2?" — point at the tool badges. *(30s)*
7. Studio: "show me my Docker gap" — the answer renders as a gauge. *(20s)*

Fallbacks if the free tier is rate-limited mid-demo: the pre-seeded demo
account already has a full analysis, and role-switching, `/benchmarks`, the
skill map and the roadmap all work with **zero** model calls.
