# SkillForge

Reads a student's resume, measures every skill against the role they're
actually chasing, and returns the shortest honest path to placement-ready.

Next.js 16 · Mastra · OpenCode Zen (DeepSeek v4) · Neon Postgres + Drizzle ·
Clerk · Tailwind v4 + shadcn/ui

**Setup: [docs/SETUP.md](docs/SETUP.md)** · Tech stack:
[TECHSTACK.md](TECHSTACK.md) · Design system:
[docs/DESIGN.md](docs/DESIGN.md) · Visual spec:
[docs/mockup.html](docs/mockup.html)

---

## The one architectural rule

> **The LLM never produces a number that appears on screen.**
> It extracts facts and writes prose. Every level, gap, week, rank and score is
> computed by TypeScript from seeded, version-controlled role benchmarks.

The problem this product exists to solve is that career platforms give generic
recommendations. An LLM asked to "score this resume out of 10" produces a
different number every run and cannot explain either one. So the split is
explicit:

| Concern | Who | Where |
|---|---|---|
| PDF → text | deterministic | `unpdf` |
| Text → skills, evidence, coursework, flagged lines | **LLM** | `resumeExtractorAgent` |
| Evidence signals → proven level (0–10) | deterministic | `src/lib/scoring/level.ts` |
| Gap, weeks-to-close, status | deterministic | `src/lib/scoring/gap.ts` |
| Readiness (0–100) | deterministic | `src/lib/scoring/readiness.ts` |
| Which projects/certs/questions surface, and in what order | deterministic | `src/lib/ranking/` |
| *Why* each was chosen | **LLM** | `recommendationNarratorAgent` |
| Week assignment, lane packing, prerequisite order | deterministic | `src/lib/scheduling/schedule.ts` |
| Roadmap bar labels and rationale notes | **LLM** | `roadmapNarratorAgent` |
| Chat mentor | **LLM + tools** | `mentorAgent` |

The model is asked which rung of a human-authored rubric the evidence supports —
never for a score. It returns booleans and counts, which are things it is good
at; TypeScript turns those into numbers.

Consequences worth knowing:

- **Three LLM calls per analysis**, all at `temperature: 0`.
- **Every gauge is explicable.** Ask why system design is a 2 and there's a
  rubric rung and a resume line number behind it.
- **Every flag is verified.** The extractor must return `{page, line, quote}`
  for each flagged sentence, and a post-step drops any flag whose quote doesn't
  actually occur on that line. It's the cheapest anti-hallucination guard in
  the app.
- **The chat mentor cannot produce a state the workflow couldn't.** Its write
  tools call the same deterministic functions, and it can only pick projects
  that exist in the seeded catalog.

## Layout

```
src/
  app/            routes — /(public), /app/* (authenticated), /api/*
  components/
    ui/           shadcn, retuned to the Linear token system
    shell/        frame, app bar, sidebar, section heads
    viz/          gap gauge, gantt, heatmap, sparkline — hand-built
  db/             Drizzle schema and seeds
  lib/
    scoring/      level, gap, readiness — pure, unit-tested
    scheduling/   the roadmap scheduler — pure, unit-tested
    ranking/      project, cert and question scoring — pure
    pdf/          unpdf extraction and normalisation
  mastra/         agents, workflows, tools, structured-output schemas
```

## Checks

```bash
npm run test           # scoring and scheduler golden fixtures
npm run check:design   # design-system guard
npm run check:models   # Mastra provider registry and model ids
npx tsc --noEmit
```

## Auth

Protection is resource-based, not middleware-based. Clerk deprecated
`createRouteMatcher` because path matching can diverge from how Next.js routes
a request and leave resources reachable — so `src/proxy.ts` carries no auth
logic, and every protected page, route handler and server action calls
`requireAuth()` itself. Anything touching student data goes through
`requireUserId()`, which throws rather than degrading.
