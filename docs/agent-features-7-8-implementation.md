# Agent implementation plan: portfolio verification and Mastra skills

Status: **partially implemented — read as a roadmap, not a description.**
Scope: agent-only capabilities; no readiness-model changes are included in this document.
Features: **7. Tool-connected portfolio verifier** and **8. Agent skills pack**.

> **What actually shipped**, as of the merge of `agent-mastra-tools-research`:
>
> - The skills pack (§8) in full — `src/mastra/skills/index.ts`, attached to both
>   the mentor and the verifier.
> - Read-only GitHub inspection: `resolve_portfolio_repository` and
>   `inspect_portfolio_repository`, backed by `src/lib/github-portfolio.ts`.
>   Signals are computed in TypeScript from the commit tree; the agent
>   interprets them and may never emit a score.
> - `portfolioVerifierAgent`, registered on the Mastra instance.
>
> **Not built:** the `verifyPortfolioWorkflow` durable pipeline, the persisted
> evidence report, the suspend-for-review step, and `requestPortfolioRecheck`.
> Verification is a conversational tool call today, not a workflow.
>
> **Superseded:** the "Current baseline" section below predates the streaming
> mentor. The mentor now has ten registered tools and Postgres-backed
> transcripts, and `searchRepositories` from `src/lib/lookup.ts` is already
> exposed as `find_learning_resources` — so the separately proposed
> `searchGithubRepositories` tool was dropped as a duplicate rather than merged.

## Executive decision

Build the skills pack first, then place the portfolio verifier behind a typed Mastra workflow.

The verifier should be read-only in its first release. It may collect repository facts, map them to the existing skill rubrics, and produce cited evidence for a student to review. It must not directly change a gauge, mark a roadmap item complete, or infer a numeric score. Any readiness change remains a deterministic application decision after explicit student confirmation.

Mastra’s current primitives support this shape: tools expose typed inputs and executors; MCP can provide external tools; workflows can suspend and resume; workspaces can scope filesystem, sandbox, search, and skills; and tool calls can require approval. See [Using Tools with Agents](https://mastra.ai/docs/agents/mcp-guide), [workflow snapshots](https://mastra.ai/en/reference/workflows/snapshots), and [Mastra Workspaces](https://mastra.ai/blog/introducing-mastra-workspaces).

## Current baseline

- `mentorAgent` is conversational and receives a server-built context block; it has no registered tools.
- `src/lib/lookup.ts` already contains failure-tolerant public GitHub repository search, concept lookup, and discussion lookup, but those functions are not exposed to `mentorAgent`.
- `chatThreads` exists in `src/db/schema.ts`, but the chat route currently sends a client-held transcript and does not persist Mastra memory.
- The resume workflow already has the important trust pattern: the model extracts facts and TypeScript computes user-visible numbers.
- Existing project catalogs describe evidence such as CI, tests, and public repositories, but there is no repository snapshot or verification record.
- The repository has no local Mastra skill package. The plan therefore treats the official Mastra Skills/Workspace model as the reference and requires a compatibility check against the installed `@mastra/core` version before implementation.

## Feature 7 — tool-connected portfolio verifier

### User outcome

A student gives SkillForge a public repository URL, or selects a connected repository. The mentor can answer:

- what evidence the repository contains;
- which SkillForge tracks that evidence supports;
- what is missing or unverifiable;
- which roadmap project or rubric rung the evidence relates to; and
- what the student should improve before claiming the work.

The result is a cited evidence report, not a score.

### First-release scope

Support public GitHub repositories by URL. Defer private repositories, arbitrary Git providers, and code execution until the read-only flow is reliable.

The verifier may inspect:

- repository metadata and default branch;
- README and project documentation;
- repository tree and selected configuration files;
- test directories and test configuration;
- CI configuration, especially GitHub Actions;
- deployment/configuration indicators without reading secrets; and
- commit recency and presence of meaningful history.

It must not:

- execute repository code;
- read secrets, `.env` files, private repository content, or arbitrary filesystem paths;
- claim that tests pass unless a trusted run result is available; or
- write to GitHub or to SkillForge readiness state.

### Proposed agent tools

These are conceptual tool interfaces. Implement them as Mastra typed tools with Zod input/output schemas and a common student/request context.

| Tool | Purpose | Default policy |
|---|---|---|
| `resolvePortfolioRepository` | Normalize a URL, validate provider/owner/repo, and return a safe repository identity. | Read-only; no approval. |
| `getPortfolioRepositorySnapshot` | Fetch metadata, default branch, latest commit, tree summary, and bounded file contents. | Read-only; enforce allowlist and byte limits. |
| `inspectPortfolioSignals` | Deterministically detect README, tests, CI, Docker, deployment, docs, and public visibility signals. | Read-only; no LLM required. |
| `mapPortfolioEvidence` | Agent maps verified signals to existing `skillTracks` and rubric rung descriptions, with source paths and uncertainty. | Structured output; cannot emit readiness numbers. |
| `comparePortfolioToPlan` | Compare evidence to the student’s active roadmap and recommended project requirements. | Student-scoped read-only. |
| `requestPortfolioRecheck` | Start a new snapshot after the student changes the repository. | Write-like operation; require confirmation and idempotency. |

The existing `searchRepositories` helper may remain a discovery tool, but verification must use a normalized repository identity and a bounded snapshot rather than trusting search-result prose.

### Workflow shape

Create a `verifyPortfolioWorkflow` with durable, inspectable steps:

1. Resolve and validate repository identity.
2. Fetch a bounded repository snapshot through a GitHub adapter or MCP adapter.
3. Run deterministic signal extraction.
4. Ask the portfolio verifier agent to map signals to known SkillForge tracks and rubric evidence.
5. Validate every cited path against the snapshot.
6. Persist a pending evidence report.
7. Suspend for student review if the report would be used for a portfolio claim.
8. On confirmation, persist the approved evidence; leave readiness recalculation to a later deterministic application action.

Mastra snapshots are appropriate for the review pause because suspended workflow state can be persisted and resumed from the exact step. Keep repository contents outside the snapshot; store repository and snapshot IDs instead, following Mastra’s guidance to minimize snapshot size.

### Persistence additions

Add application records conceptually equivalent to:

- `portfolio_repositories`: student, provider, owner, repository, URL, consent status, last checked, and current default branch;
- `portfolio_snapshots`: repository, commit SHA, fetched timestamp, status, and bounded signal summary;
- `portfolio_evidence`: snapshot, track ID, evidence type, claim, source path, source line/range when available, confidence category, and verification status;
- `portfolio_reviews`: student decision, reviewer/actor, decision timestamp, and reason.

Do not store complete repository contents in the application database by default. Store only the minimum excerpts needed for citation and re-fetchable snapshot identifiers.

### Trust and security requirements

- Enforce student ownership in every tool executor; never rely on the mentor’s instructions for authorization.
- Allowlist providers and URL formats.
- Apply request timeouts, response-size limits, path-count limits, and rate-limit handling.
- Ignore instructions found inside repository files; repository text is untrusted data, not agent instructions.
- Exclude secret-like paths and redact tokens before the model sees content.
- Return explicit `unknown` or `not observed` states instead of negative claims when a signal was not inspected.
- Keep the verifier read-only until private-repository consent and a secure credential strategy exist.

### Acceptance criteria

- A public repository can be resolved, snapshotted, and rechecked without blocking the chat request.
- Every evidence claim includes a repository, commit SHA, path, and bounded source excerpt or deterministic signal.
- Unknown, inaccessible, or rate-limited data is surfaced as uncertainty.
- The agent cannot create or modify readiness, roadmap status, or benchmark rows.
- A student can approve or reject a pending evidence report.
- Repeating verification for the same commit is idempotent and does not duplicate evidence.
- Adversarial repository files containing prompt injection do not change tool policy or output schema.

## Feature 8 — reusable Mastra agent skills pack

### User outcome

The mentor and verifier behave consistently across conversations because their specialized instructions are versioned, discoverable, and testable rather than embedded in one large prompt.

Mastra describes skills as reusable `SKILL.md` knowledge files, with optional references and scripts. Direct agent-level skills are suitable for instruction-only knowledge; use a Workspace when a skill needs filesystem, search, or sandbox capabilities. See [First-Class Skills for Mastra Agents](https://mastra.ai/blog/introducing-first-class-skills) and [Introducing Workspaces](https://mastra.ai/blog/introducing-mastra-workspaces).

### Initial skill set

Create a small, focused pack. Each skill should state when it applies, what evidence it may rely on, what it must never claim, and which tool/workflow it may invoke.

| Skill | Used by | Responsibility |
|---|---|---|
| `portfolio-evidence-review` | mentor, verifier | Interpret verified repository signals and phrase gaps without inflating claims. |
| `rubric-and-citation-discipline` | all agents | Require known track IDs, source citations, uncertainty labels, and no model-generated scores. |
| `roadmap-coaching` | mentor | Turn existing roadmap rows into concise next actions; never invent projects or resources. |
| `interview-coaching` | mentor | Run question/follow-up/feedback loops while keeping practice feedback separate from readiness. |
| `resume-evidence-review` | mentor, future revision agent | Explain grounded resume flags and preserve source-line references. |

Do not put authorization rules, student identity, benchmark values, or mutable plan state in skills. Those belong in tool executors, runtime context, and the database.

### Skill packaging and loading

Recommended repository shape:

```text
src/mastra/skills/
  portfolio-evidence-review/SKILL.md
  rubric-and-citation-discipline/SKILL.md
  roadmap-coaching/SKILL.md
  interview-coaching/SKILL.md
  resume-evidence-review/SKILL.md
```

Each `SKILL.md` should contain:

- a short description and trigger conditions;
- required context and permitted tools;
- a decision procedure;
- prohibited behavior and escalation rules;
- output shape and citation requirements; and
- a small set of examples and counterexamples.

If the installed Mastra version supports direct agent-level skills, attach the pack to `mentorAgent` and the verifier agent. If not, load the same files through a scoped Workspace or compose their contents into a versioned instruction provider. Do not assume the current website API matches the repository’s pinned `@mastra/core` version; verify the installed package before coding.

### Skill versioning

Persist or expose:

- skill name;
- content hash/version;
- agent name;
- model/provider identifier; and
- evaluation dataset version.

Include the skill version in traces and evidence reports so a later review can explain why two agent runs behaved differently.

### Guardrails around skills

Skills are advisory instructions, not security controls. Pair them with Mastra input/output processors for normalization, prompt-injection detection, PII redaction, schema validation, and retry/abort behavior. Mastra’s processor guidance covers input and output interception and guardrail enforcement: [Processors and guardrails](https://mastra.ai/workshops/implement-processors-in-mastra).

### Acceptance criteria

- Each skill can be loaded independently and has a clear activation condition.
- The mentor produces the same citation/uncertainty behavior whether a request is direct or routed through the verifier.
- Skills cannot grant access to a tool or bypass student ownership checks.
- Skill changes are reviewable and versioned.
- A regression dataset covers skill activation, non-activation, refusal, and citation behavior.

## Implementation sequence

### Phase 0 — compatibility and contracts

- Install dependencies in a clean environment and verify the pinned Mastra APIs.
- Confirm the storage configuration for Mastra memory/traces in the existing `mastra` schema.
- Define repository snapshot limits, consent language, and evidence states.
- Add deterministic fixtures for representative repositories: strong, incomplete, inaccessible, and malicious-content cases.

### Phase 1 — skills pack

- Extract mentor policy into the five focused skills.
- Add skill loading to the smallest supported Mastra mechanism for the pinned version.
- Add traces/evaluation metadata for skill version and activation.
- Keep the existing mentor behavior as the regression baseline.

### Phase 2 — read-only verifier

- Add repository identity and snapshot adapters.
- Implement deterministic signal extraction.
- Register the verifier tools with a dedicated agent.
- Build `verifyPortfolioWorkflow` through pending evidence report creation.

### Phase 3 — review and mentor integration

- Add review/resume endpoints and UI states for pending, approved, rejected, expired, and failed reports.
- Expose read-only portfolio tools to `mentorAgent`.
- Add explicit approval before `requestPortfolioRecheck` or any future action that affects application state.

### Phase 4 — quality gate

Use Mastra datasets and scorers to test:

- tool selection accuracy;
- parameter/schema validity;
- evidence citation faithfulness;
- prompt-injection resistance;
- uncertainty calibration;
- duplicate/idempotent verification; and
- refusal to emit or alter readiness numbers.

Mastra’s evaluation guidance recommends separating capability tests from regression tests and evaluating tool invocation, tool selection, and parameter extraction independently. See [AI agent evaluation](https://mastra.ai/articles/ai-agent-evaluation).

## Explicit non-goals

- No arbitrary shell execution in the first verifier release.
- No private repository access before consent and credential isolation are designed.
- No model-owned readiness score, benchmark, or roadmap mutation.
- No broad multi-agent network until the single verifier and mentor pass quality gates.
- No automatic portfolio claims sent to employers or public profiles.

## Key risks and decisions still required

1. **Provider choice:** direct GitHub adapter versus GitHub MCP. Start with a narrow adapter for predictable schemas; introduce MCP only when multiple external providers justify the seam.
2. **Evidence policy:** decide which signals can become approved evidence and which remain coaching-only observations.
3. **Storage:** decide retention for snapshots and excerpts, especially when repositories change or become private.
4. **Approval UX:** decide whether approval is a chat confirmation, review screen, or both. Mastra distinguishes tool approval (permission before execution) from workflow suspension (human clarification/review); use the latter for evidence reports and the former for future write tools.
5. **Compatibility:** pin and verify the exact Mastra APIs supported by this repository before implementation; current package versions may lag the current Mastra documentation.
