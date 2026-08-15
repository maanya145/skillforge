# Tech stack

What SkillForge is built on, and how the pieces fit. Setup lives in
[docs/SETUP.md](docs/SETUP.md); the design system in
[docs/DESIGN.md](docs/DESIGN.md).

## At a glance

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, React 19, TypeScript) | Server Components by default — every dashboard is server-rendered SVG/CSS with almost no client JS |
| Styling | **Tailwind v4 + shadcn/ui**, Linear-style tokens | One `@theme` bridge maps 16 hand-picked hexes onto shadcn's contract; `npm run check:design` enforces it |
| Agents | **Mastra** (`@mastra/core`) | Agents, typed tools and a step workflow, all in TypeScript next to the app code |
| Models | **OpenCode Zen** free tier | Served **without an API key**; agents talk to it via `OpenAICompatibleConfig` rather than Mastra's router (the router demands a key the API doesn't) |
| Database | **Neon Postgres** + **Drizzle ORM** | Serverless HTTP driver — stateless, so no pooled sockets to die on flaky networks |
| Auth | **Clerk** | Resource-based `auth.protect()` per page/route, not middleware path-matching |
| Generative UI | **OpenUI Lang** (`@openuidev/react-lang`) | The studio's model output renders as our own components — no foreign CSS |
| Motion | **framer-motion** | ⌘K palette, and the 3D console's spring-driven tilt |
| Hosting | **Vercel** | `after()` keeps analysis alive past the response; SSE streams chat |

## The one rule everything follows

**The model never produces a number that appears on screen.** It extracts
facts (evidence signals: booleans and counts it's good at) and writes prose.
TypeScript computes every level, gap, week, rank and score from seeded,
version-controlled benchmarks — pure functions in `src/lib/scoring`,
`src/lib/ranking` and `src/lib/scheduling`, covered by the unit tests. The
rubrics, formulas and evidence weights are published at `/benchmarks` with no
account, so the claim is checkable rather than asserted.

## How an analysis works

```
PDF upload ──► unpdf (page/line-indexed text)          [deterministic]
   │              └─ no text layer? → Firecrawl OCR (optional key)
   ▼
resumeExtractorAgent ── evidence signals + cited flags [the ONE model step]
   │              └─ every "p.N LN" quote is verified against the source
   │                 before persisting; hallucinated citations are dropped
   ▼
score → rank → schedule                                [pure TypeScript]
   │      readiness = 100·(1 − Σw·gap ⁄ Σw·required)
   │      projects/certs/questions scored by weighted gap points
   │      roadmap = topological sort over prerequisites, greedy-packed
   ▼
Postgres (Drizzle) ──► every screen reads these rows
```

The upload route answers in ~2s and the pipeline continues in Vercel's
`after()`; the intake screen polls a progress row. The extraction is cached
**role-independently**, which is why switching target roles re-scores
everything instantly — it's arithmetic over cached signals, zero model calls.

## The agents

All run keyless on Zen's free tier. Numbers still come from tools reading
Postgres — never from the model's memory.

- **Extractor** — structured output only, no tools; the single model step in
  an analysis.
- **Mentor** (`/app/chat`) — streams over SSE with 10 tools: five read the
  student's own measured state (built per-request with the student id closed
  over, so a hallucinated id can't reach anyone else's data), plus keyless
  web lookup (GitHub, Hacker News, Wikipedia/MDN), Open Graph link previews,
  and read-only GitHub portfolio inspection (signals computed in TypeScript
  from the commit tree — the model interprets, never detects).
- **Studio** (`/app/studio`) — same tools, but answers in **OpenUI Lang**:
  the reply streams as gauges, stats, galleries and embeds rendered by our
  own component library. Media must come from the preview tool; a made-up
  image URL renders nothing.
- **Scout** — background discovery. TypeScript picks the gaps and writes the
  queries, **Exa's keyless MCP endpoint** searches, the model only
  classifies results against the closed track vocabulary, TypeScript scores
  and ranks.
- **Greeter** (`/api/hello`) — the landing console's mentor. Public by
  design: no tools, no student, no memory, hard caps on transcript size.

## Data

Postgres via the Neon HTTP driver (`@neondatabase/serverless`): each query is
a stateless fetch, which is what survives serverless and hostile networks.
Drizzle owns the ~27 tables in `public` (benchmarks, resumes, runs,
assessments, roadmaps, recommendations, discoveries, shares, chat).
Migrations are plain SQL files under `drizzle/`. `report_shares` powers
recruiter links: a 128-bit token pointing at a *run*, so re-analysing never
rewrites a report someone already opened.

## The console

The landing hero and workspace dock share one chassis
(`console-shell.tsx`): CSS-only 3D — a perspective container, spring-driven
tilt following the pointer, depth from `translateZ` layers, a specular sheen
that tracks the tilt. The screen is a lit 1-bit panel (bone glass, dark
pixels). D-pad, A/B and a crank drive a visual cursor over ordinary `<a>`
links — the console is never the only way to reach anything.

## Verification

Every capability has a `check:*` script that exercises it against the live
service — `check:workflow`, `check:mentor`, `check:studio`, `check:greeter`,
`check:discovery`, `check:portfolio`, `check:feed`, `check:ocr`,
`check:models`, `check:tools`, `check:design` — because the failure modes
that matter (model drift, API format changes, rate limits) never show up in
a build. Unit tests cover the deterministic core: scoring, ranking,
scheduling, citation verification, gantt row-packing.
