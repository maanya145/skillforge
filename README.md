# SkillForge

Reads a student's resume, measures every skill against the role they're
actually chasing, and returns the shortest honest path to placement-ready.

**Live: [skillforge-eight-pink.vercel.app](https://skillforge-eight-pink.vercel.app)**

Next.js 16 · Mastra · OpenCode Zen (keyless free tier) · Neon Postgres +
Drizzle · Clerk · Tailwind v4 + shadcn/ui · OpenUI Lang

**Setup: [docs/SETUP.md](docs/SETUP.md)** · Tech stack:
[TECHSTACK.md](TECHSTACK.md) · Presenting: [docs/AGENT.md](docs/AGENT.md) ·
Design system: [docs/DESIGN.md](docs/DESIGN.md)

---

## The one architectural rule

> **The LLM never produces a number that appears on screen.**
> It extracts facts. Every level, gap, week, rank and score is computed by
> TypeScript from seeded, version-controlled role benchmarks — published at
> [`/benchmarks`](https://skillforge-eight-pink.vercel.app/benchmarks), no
> account required.

Career platforms give generic recommendations because an LLM asked to "score
this resume out of 10" produces a different number every run and can explain
neither. So the split is explicit:

| Concern | Who | Where |
|---|---|---|
| PDF → page/line-indexed text | deterministic | `src/lib/pdf` (`unpdf`; OCR fallback for scans) |
| Text → evidence signals, cited flags | **LLM** — the one call | `resumeExtractorAgent` |
| Evidence → proven level (0–10) | deterministic | `src/lib/scoring/level.ts` |
| Gap, weeks-to-close, readiness (0–100) | deterministic | `src/lib/scoring/` |
| What to build/practise, and in what order | deterministic | `src/lib/ranking/` |
| The *why* under each recommendation | deterministic templates over the same numbers | `src/lib/ranking/rank.ts` |
| Week assignment, lane packing, prerequisites | deterministic | `src/lib/scheduling/schedule.ts` |

The model is asked which rung of a human-authored rubric the evidence
supports — never for a score. It returns booleans and counts, which are
things it is good at; TypeScript turns those into numbers.

Consequences worth knowing:

- **One LLM call per analysis.** Everything downstream is arithmetic — which
  is also why switching target roles re-measures everything instantly, from
  cached evidence, with zero model calls.
- **Every gauge is explicable.** Ask why system design is a 2 and there's a
  rubric rung and a resume line number behind it.
- **Every flag is verified.** The extractor returns `{page, line, quote}`
  per flagged sentence, and a post-step drops any flag whose quote doesn't
  occur at that position. The cheapest anti-hallucination guard in the app.

## The agents

Six, all on the keyless free tier. Numbers still come from tools reading
Postgres — never from a model's memory.

- **Extractor** — the analysis pipeline's single model step. No tools,
  structured output only.
- **Mentor** (`/app/chat`) — a conversational coach: streaming chat with
  persistent threads and 10 tools over the student's own measured state,
  plus keyless web lookup and read-only GitHub portfolio inspection. Its
  tools close over the signed-in student's id, so there is no id parameter
  for a model to get wrong.
- **Studio** (`/app/studio`) — the same brain, answering in **interface**
  instead of prose: replies stream as OpenUI Lang and render as real gauges,
  stats, galleries and video embeds from our own component library.
  Single-question and stateless where the mentor is conversational and
  persistent; media must come from the link-preview tool or it renders
  nothing.
- **Scout** — background discovery. TypeScript picks the gaps and writes
  the queries, Exa searches, the model only classifies results against the
  closed track vocabulary, TypeScript scores and ranks.
- **Greeter** — the landing console's mentor. Public endpoint, no tools, no
  memory, hard caps; its whole world is written into its instructions.
- **Portfolio verifier** — inspects a public repo; signals (README, tests,
  CI, Docker…) are detected by code from the commit tree, the model only
  interprets them, and every claim carries a commit SHA and path.

## The product

Landing: a 3D handheld console (CSS-only) that boots, offers upload or an
in-screen chat with the greeter. Inside: skill map with gap gauges and
instant role switching · 14-week roadmap (topological sort, three lanes) ·
practice (ranked projects and interview drills) · certifications as a live
artifact re-scored in the browser against a budget slider · gap-ranked
news feed · progress tracking that moves only when a gap closes · read-only
share links for recruiters · public benchmarks.

## Layout

```
src/
  app/            routes — public, /app/* (authenticated), /api/*
  components/
    ui/           shadcn, retuned to the Linear token system
    shell/        frame, sidebar, ⌘K palette, the console (shell/device/hero)
    viz/          gap gauge, roadmap gantt, sparkline — hand-built
    genui/        the OpenUI Lang component library the studio renders
  db/             Drizzle schema, migrations, seeds
  lib/
    scoring/ scheduling/ ranking/    the deterministic core — pure, unit-tested
    pdf/          extraction, normalisation, OCR fallback
    discovery/    Exa search + classification pipeline
    feed.ts shares.ts benchmarks.ts preview.ts github-portfolio.ts replan.ts
  mastra/         agents, workflow, tools, skills, structured-output schemas
```

## Checks

Unit tests cover the deterministic core; a `check:*` script exercises each
live capability, because model drift and API changes never show up in a build.

```bash
npm test               # scoring, scheduling, ranking, citations, gantt
npm run check:design   # design-system guard
npm run check:tools    # every agent tool has a UI label, key === id
npm run check:workflow # full analysis against the live model
npm run check:mentor   # a real tool-using conversation
npm run check:studio   # valid OpenUI Lang, grounded media
npm run check:greeter  # replies fit the console screen
npm run check:discovery · check:portfolio · check:feed · check:ocr · check:models
```

## Auth

Protection is resource-based, not middleware-based. `src/proxy.ts` carries
no auth logic; every protected page, route handler and server action calls
`requireAuth()` itself, and anything touching student data goes through
`requireUserId()`, which throws rather than degrading. The two deliberate
exceptions — `/benchmarks`, shared reports and the greeter — are public by
design and reach no student data.
