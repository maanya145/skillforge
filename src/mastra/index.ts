import { Mastra } from "@mastra/core"

import { resumeExtractorAgent } from "./agents/resume-extractor"
import { analyzeResumeWorkflow } from "./workflows/analyze-resume"

/**
 * The Mastra instance.
 *
 * Import this ONLY from route handlers, server actions and scripts. A stray
 * `'use client'` anywhere in an import chain that reaches this file pulls the
 * whole agent runtime into the browser bundle. It is deliberately not
 * re-exported from any barrel file for that reason.
 *
 * ── No storage configured, deliberately ─────────────────────────────────────
 *
 * Mastra's storage persists workflow snapshots, traces and chat memory. The
 * analysis pipeline needs none of that: every step writes its real output to
 * the application's own tables through Drizzle, and `analysis_runs.progress`
 * is the durable record of a run. Snapshotting to Postgres as well only added
 * a second write path — one that failed on flaky networks and took otherwise
 * healthy runs down with it.
 *
 * Chat memory in S6 does need persistence. Attach a PostgresStore then, and
 * scope it to the `mastra` schema so drizzle-kit leaves it alone.
 */
export const mastra = new Mastra({
  agents: { resumeExtractorAgent },
  workflows: { analyzeResumeWorkflow },
})
