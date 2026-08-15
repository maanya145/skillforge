import {
  pgTable,
  pgEnum,
  text,
  integer,
  real,
  boolean,
  timestamp,
  date,
  jsonb,
  uuid,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core"

import type { EvidenceSignals, LevelRubric } from "@/lib/scoring/types"

/**
 * Application tables live in `public`. Mastra creates its memory and trace
 * tables in the `mastra` schema, and drizzle.config.ts sets
 * `schemaFilter: ['public']` so a push never proposes dropping them.
 */

/** Progress entries written by each workflow step; drives the intake checklist. */
export type ProgressLog = { key: string; label: string; value: string }[]

// ─── Enums ───────────────────────────────────────────────────────────────────

export const runStatus = pgEnum("run_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
])
export const gapStatus = pgEnum("gap_status", ["open", "met", "above"])
export const laneKind = pgEnum("lane_kind", ["close_gaps", "build_proof", "drill"])
export const itemKind = pgEnum("item_kind", ["gap", "project", "drill", "milestone"])
export const itemStatus = pgEnum("item_status", [
  "planned",
  "in_progress",
  "done",
  "skipped",
])
export const evidenceKind = pgEnum("evidence_kind", [
  "project",
  "internship",
  "award",
  "coursework",
  "publication",
])
export const certVerdict = pgEnum("cert_verdict", ["worth_it", "skip", "later"])
export const discoveredKind = pgEnum("discovered_kind", ["course", "project"])
export const eventType = pgEnum("event_type", [
  "study_session",
  "item_completed",
  "project_shipped",
  "question_attempted",
  "problem_solved",
  "mock_interview",
  "resume_reupload",
  "role_changed",
])
export const snapshotSource = pgEnum("snapshot_source", [
  "run",
  "event",
  "manual",
  "seed",
])

// ─── The benchmark core: seeded, version-controlled, never model-written ─────

export const roles = pgTable("roles", {
  id: text("id").primaryKey(), // 'backend-engineer'
  name: text("name").notNull(),
  blurb: text("blurb").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
})

/** One row per horizontal bar on the skill map. The gauge vocabulary. */
export const skillTracks = pgTable("skill_tracks", {
  id: text("id").primaryKey(), // 'system-design'
  name: text("name").notNull(),
  category: text("category").notNull(), // core | tooling | dsa | data | systems
  description: text("description").notNull(),
  /**
   * The human-authored ladder the model is shown. It is asked which rung the
   * evidence supports — never for a score.
   */
  levelRubric: jsonb("level_rubric").$type<LevelRubric>().notNull(),
})

/** The ruler. Everything downstream is measured against these rows. */
export const roleBenchmarks = pgTable(
  "role_benchmarks",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    trackId: text("track_id")
      .notNull()
      .references(() => skillTracks.id, { onDelete: "cascade" }),
    /** 0–10 — the white notch on the gauge */
    requiredLevel: real("required_level").notNull(),
    /** Readiness weighting */
    weight: real("weight").notNull().default(1),
    /** Study hours to move one level — this is what turns a gap into a date */
    hoursPerLevel: real("hours_per_level").notNull(),
    /** Screened early enough that a gap here ends the interview */
    isBlocking: boolean("is_blocking").notNull().default(false),
    rationale: text("rationale").notNull(),
    sourceNote: text("source_note").notNull(), // "340 campus JDs, 2026 cycle"
    benchmarkVersion: text("benchmark_version").notNull().default("2026.1"),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.trackId] })]
)

/** Ordering constraints for the scheduler: "Docker before the load test". */
export const trackPrerequisites = pgTable(
  "track_prerequisites",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    trackId: text("track_id")
      .notNull()
      .references(() => skillTracks.id, { onDelete: "cascade" }),
    requiresTrackId: text("requires_track_id")
      .notNull()
      .references(() => skillTracks.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.trackId, t.requiresTrackId] })]
)

// ─── Identity ────────────────────────────────────────────────────────────────

export const students = pgTable(
  "students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email"),
    fullName: text("full_name"),
    college: text("college"),
    gradYear: integer("grad_year"),
    targetRoleId: text("target_role_id").references(() => roles.id),
    weeklyHours: integer("weekly_hours").notNull().default(9),
    targetDate: date("target_date"),
    horizonWeeks: integer("horizon_weeks").notNull().default(14),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("students_clerk_uidx").on(t.clerkUserId)]
)

// ─── Resume intake ───────────────────────────────────────────────────────────

export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    pageCount: integer("page_count").notNull(),
    rawText: text("raw_text").notNull(),
    /** Per page. This is what makes "p.1 L7" a citation and not decoration. */
    pagesText: jsonb("pages_text").$type<string[]>().notNull(),
    /** sha256 of the uploaded bytes — lets an identical re-upload reuse a
     *  prior extraction instead of paying for the model again. */
    contentHash: text("content_hash"),
    parseMs: integer("parse_ms").notNull(),
    sectionsFound: integer("sections_found").notNull().default(0),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("resumes_student_idx").on(t.studentId),
    index("resumes_hash_idx").on(t.studentId, t.contentHash),
  ]
)

export const analysisRuns = pgTable(
  "analysis_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    workflowRunId: text("workflow_run_id"),
    status: runStatus("status").notNull().default("queued"),
    currentStep: text("current_step"),
    progress: jsonb("progress").$type<ProgressLog>().notNull().default([]),
    /**
     * The extraction's role-independent output: evidence signals and gauge
     * notes per track. Persisting this is what makes role switching instant —
     * re-scoring against a different benchmark is pure arithmetic over these,
     * no second model call.
     */
    extractCache: jsonb("extract_cache").$type<{
      signals: Record<string, EvidenceSignals>
      notes: Record<string, string>
    }>(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("runs_student_idx").on(t.studentId, t.startedAt)]
)

export const extractedSkills = pgTable("extracted_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  rawLabel: text("raw_label").notNull(), // the chip text, e.g. 'PostgreSQL'
  trackId: text("track_id").references(() => skillTracks.id),
  /** Not on the previous run — rendered in violet */
  isNewSinceLast: boolean("is_new_since_last").notNull().default(false),
  confidence: real("confidence").notNull(),
  signals: jsonb("signals").$type<EvidenceSignals>().notNull(),
})

export const resumeEvidence = pgTable("resume_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  kind: evidenceKind("kind").notNull(),
  title: text("title").notNull(), // 'Campus Mess Portal'
  detail: text("detail").notNull(), // 'Django, Postgres'
  metric: text("metric"), // '400 users'
  sourcePage: integer("source_page"),
  sourceLine: integer("source_line"),
  trackIds: jsonb("track_ids").$type<string[]>().notNull().default([]),
})

/**
 * Flagged resume lines. `quote` must occur verbatim on `pagesText[page-1]`
 * line `line`; the workflow drops any flag that fails that check before
 * persisting. Cheapest anti-hallucination guard in the app.
 */
export const resumeFlags = pgTable("resume_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  page: integer("page").notNull(),
  line: integer("line").notNull(),
  quote: text("quote").notNull(),
  critique: text("critique").notNull(),
  suggestedFix: text("suggested_fix"),
  severity: integer("severity").notNull().default(1),
})

// ─── Assessments: one row per gauge ──────────────────────────────────────────

export const skillAssessments = pgTable(
  "skill_assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    roleId: text("role_id").notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => skillTracks.id),
    provenLevel: real("proven_level").notNull(), // solid bar
    requiredLevel: real("required_level").notNull(), // white notch
    gap: real("gap").notNull(), // hatched span
    weight: real("weight").notNull(),
    weeksToClose: real("weeks_to_close").notNull(),
    status: gapStatus("status").notNull(),
    note: text("note").notNull(),
    rubricLevelHit: integer("rubric_level_hit").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("assess_run_track_uidx").on(t.runId, t.trackId)]
)

// ─── Catalogs (seeded) and recommendations (per run) ─────────────────────────

export const projectCatalog = pgTable("project_catalog", {
  id: text("id").primaryKey(), // 'rate-limited-shortener'
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  stack: jsonb("stack").$type<string[]>().notNull(),
  effortWeeks: integer("effort_weeks").notNull(),
  difficulty: integer("difficulty").notNull(),
  closesTrackIds: jsonb("closes_track_ids").$type<string[]>().notNull(),
  evidenceProduced: text("evidence_produced").notNull(),
  requiresTrackIds: jsonb("requires_track_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
})

export const recommendedProjects = pgTable(
  "recommended_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projectCatalog.id),
    score: real("score").notNull(),
    rank: integer("rank").notNull(),
    /** Model prose, grounded in this student's evidence */
    rationale: text("rationale").notNull(),
    closesTrackIds: jsonb("closes_track_ids").$type<string[]>().notNull(),
    startWeek: integer("start_week"),
    endWeek: integer("end_week"),
  },
  (t) => [uniqueIndex("recproj_run_proj_uidx").on(t.runId, t.projectId)]
)

export const certCatalog = pgTable("cert_catalog", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  costInr: integer("cost_inr"),
  examWindow: text("exam_window"),
  baseValue: real("base_value").notNull(),
  provesTrackIds: jsonb("proves_track_ids").$type<string[]>().notNull(),
  /** "the CI retrofit proves this for free" */
  cheaperAlternative: text("cheaper_alternative"),
})

export const recommendedCerts = pgTable(
  "recommended_certs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    certId: text("cert_id")
      .notNull()
      .references(() => certCatalog.id),
    verdict: certVerdict("verdict").notNull(),
    score: real("score").notNull(),
    rank: integer("rank").notNull(),
    rationale: text("rationale").notNull(),
  },
  (t) => [uniqueIndex("reccert_run_cert_uidx").on(t.runId, t.certId)]
)

export const questionBank = pgTable("question_bank", {
  id: text("id").primaryKey(),
  prompt: text("prompt").notNull(),
  trackId: text("track_id")
    .notNull()
    .references(() => skillTracks.id),
  topic: text("topic").notNull(),
  company: text("company"),
  round: text("round"),
  year: integer("year"),
  difficulty: integer("difficulty").notNull(),
  modelAnswerOutline: text("model_answer_outline"),
})

export const recommendedQuestions = pgTable(
  "recommended_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questionBank.id),
    /** Red "gap track" vs neutral "covered" */
    isGapTrack: boolean("is_gap_track").notNull(),
    rank: integer("rank").notNull(),
    score: real("score").notNull(),
    coachNote: text("coach_note"),
    status: text("status").notNull().default("queued"),
  },
  (t) => [uniqueIndex("recq_run_q_uidx").on(t.runId, t.questionId)]
)

// ─── Roadmap ─────────────────────────────────────────────────────────────────

export const roadmaps = pgTable("roadmaps", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  runId: uuid("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  roleId: text("role_id").notNull(),
  totalWeeks: integer("total_weeks").notNull().default(14),
  weeklyHours: integer("weekly_hours").notNull().default(9),
  startDate: date("start_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/** `startWeek`/`endWeek` are 1-based inclusive → grid-column: start / end+1 */
export const roadmapItems = pgTable(
  "roadmap_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roadmapId: uuid("roadmap_id")
      .notNull()
      .references(() => roadmaps.id, { onDelete: "cascade" }),
    lane: laneKind("lane").notNull(),
    kind: itemKind("kind").notNull(),
    trackId: text("track_id").references(() => skillTracks.id),
    projectId: text("project_id").references(() => projectCatalog.id),
    label: text("label").notNull(), // row label
    detail: text("detail").notNull(), // bar text
    startWeek: integer("start_week").notNull(),
    endWeek: integer("end_week").notNull(),
    sortOrder: integer("sort_order").notNull(),
    status: itemStatus("status").notNull().default("planned"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("items_roadmap_idx").on(t.roadmapId, t.lane, t.sortOrder)]
)

/** The W1/W5/W8/W12 rationale rail beside the gantt. */
export const roadmapNotes = pgTable("roadmap_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  roadmapId: uuid("roadmap_id")
    .notNull()
    .references(() => roadmaps.id, { onDelete: "cascade" }),
  week: integer("week").notNull(),
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  sortOrder: integer("sort_order").notNull(),
})

// ─── Progress and analytics ──────────────────────────────────────────────────

export const progressEvents = pgTable(
  "progress_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    type: eventType("type").notNull(),
    trackId: text("track_id").references(() => skillTracks.id),
    roadmapItemId: uuid("roadmap_item_id").references(() => roadmapItems.id, {
      onDelete: "set null",
    }),
    minutes: integer("minutes").notNull().default(0),
    /** How much proven level this moved — the only thing readiness reacts to */
    levelDelta: real("level_delta").notNull().default(0),
    headline: text("headline").notNull(),
    body: text("body"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (t) => [index("events_student_time_idx").on(t.studentId, t.occurredAt)]
)

export const readinessSnapshots = pgTable(
  "readiness_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    roleId: text("role_id").notNull(),
    capturedOn: date("captured_on").notNull(),
    readiness: real("readiness").notNull(), // 0–100, the sparkline
    perTrack: jsonb("per_track").$type<Record<string, number>>().notNull(),
    source: snapshotSource("source").notNull(),
  },
  (t) => [uniqueIndex("snap_uidx").on(t.studentId, t.roleId, t.capturedOn)]
)

/** Materialised roll-up of progressEvents — the 26×7 heatmap reads this. */
export const studyLog = pgTable(
  "study_log",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    minutes: integer("minutes").notNull().default(0),
    level: integer("level").notNull().default(0), // 0–4 bucket
  },
  (t) => [primaryKey({ columns: [t.studentId, t.day] })]
)

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** First user message, truncated — computed in TypeScript, no model call */
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("threads_student_idx").on(t.studentId, t.updatedAt)]
)

/**
 * Chat transcript, owned by the app rather than by Mastra's memory store.
 *
 * Mastra's PostgresStore was removed after its pooled driver proved unusable
 * on IPv6-degraded networks (see src/db/client.ts); persisting messages
 * through the same HTTP driver everything else uses keeps one connection
 * path and one failure mode.
 */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant'
    content: text("content").notNull(),
    /** Which tools ran for this answer — rendered as provenance in the UI */
    toolsUsed: jsonb("tools_used").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("messages_thread_idx").on(t.threadId, t.createdAt)]
)

// ─── Discovery ───────────────────────────────────────────────────────────────

/**
 * Courses and project ideas found on the open web for one student's open gaps.
 *
 * Kept in its own table rather than merged into `project_catalog` on purpose.
 * The seeded catalogs are the product's authority: hand-authored, versioned,
 * with verified `effortWeeks` and prerequisites the scheduler depends on.
 * Anything a model found on the web has none of that, so it stays here, is
 * shown as a separate "Found for you" surface, and never reaches the roadmap.
 *
 * What it DOES share is the scorer. `score` is produced by the same
 * Σ(weightₜ · gapₜ) arithmetic that ranks the seeded catalog — the model's only
 * job is to propose a candidate and map it to track ids from the closed seeded
 * vocabulary. It never assigns a number.
 */
export const discoveredResources = pgTable(
  "discovered_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    kind: discoveredKind("kind").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    /** Host, shown as provenance so a student can judge the source. */
    source: text("source").notNull(),
    summary: text("summary").notNull(),
    /** Post-validated against the seeded track ids; unknown ids are dropped. */
    closesTrackIds: jsonb("closes_track_ids").$type<string[]>().notNull(),
    /** Model's estimate, clamped. Advisory only — never fed to the scheduler. */
    effortWeeks: integer("effort_weeks"),
    costNote: text("cost_note"),
    /** Deterministic: Σ(weightₜ · gapₜ) over the open tracks it touches. */
    score: real("score").notNull(),
    rank: integer("rank").notNull(),
    /** Template over the same numbers, so prose can't contradict the score. */
    rationale: text("rationale").notNull(),
    /** Which generated query surfaced this — the audit trail for a finding. */
    sourceQuery: text("source_query").notNull(),
    status: text("status").notNull().default("new"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One row per student per URL: re-running discovery refreshes rather than
    // accumulating duplicates of the same course.
    uniqueIndex("discovered_student_url_uidx").on(t.studentId, t.url),
    index("discovered_run_idx").on(t.runId, t.rank),
  ]
)

// ─── Drill problems ──────────────────────────────────────────────────────────

/**
 * Real LeetCode problems, seeded and hand-mapped to tracks — the same closed-
 * catalog discipline as projects and certs. Every slug is verified against
 * LeetCode's GraphQL API by `npm run check:problems`, including that it is
 * not paywalled.
 */
export const problemCatalog = pgTable("problem_catalog", {
  /** The LeetCode slug — the id IS the URL. */
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  trackId: text("track_id")
    .notNull()
    .references(() => skillTracks.id),
  /** 1 easy · 2 medium · 3 hard, matching LeetCode's own labels. */
  difficulty: integer("difficulty").notNull(),
  /** Why this one: the pattern it drills, e.g. "BFS on a grid". */
  pattern: text("pattern").notNull(),
})

/** Solved marks. Habit trail only — solving drills never moves readiness. */
export const problemAttempts = pgTable(
  "problem_attempts",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    problemId: text("problem_id")
      .notNull()
      .references(() => problemCatalog.id),
    solvedAt: timestamp("solved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.problemId] })]
)

// ─── Job targets ─────────────────────────────────────────────────────────────

/**
 * A pasted job posting, mapped onto the track vocabulary.
 *
 * The model's entire contribution is `mappings` — which tracks the posting
 * treats as core or mentions, each citing the JD line (verified before
 * persisting, exactly like resume flags). Levels are never stored per target:
 * the benchmark is derived at read time from the seeded rows + these mappings,
 * so a benchmark improvement retroactively improves every saved target.
 *
 * Works without an analysis: a target with no cached evidence still shows what
 * the posting demands; measurement switches on once a resume exists.
 */
export const jobTargets = pgTable(
  "job_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    company: text("company"),
    /** Nearest seeded role — the baseline the derivation modulates. */
    baseRoleId: text("base_role_id")
      .notNull()
      .references(() => roles.id),
    /** The posting, pseudo-paged like pasted resumes so citations verify. */
    sourceText: text("source_text").notNull(),
    mappings: jsonb("mappings")
      .$type<
        { trackId: string; emphasis: "core" | "mentioned"; line: number; quote: string }[]
      >()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("job_targets_student_idx").on(t.studentId, t.createdAt)]
)

// ─── Sharing ─────────────────────────────────────────────────────────────────

/**
 * A read-only, unguessable link to one analysis run.
 *
 * The token is the whole access control model, so it is 128 bits of CSPRNG
 * randomness — not a slug, not the run's uuid. A share points at a *run* rather
 * than a student, which means re-analysing or switching roles never silently
 * changes what a recruiter already opened: the old link keeps showing the
 * numbers that were true when it was sent.
 *
 * `revokedAt` rather than a delete, so "I un-shared it" stays auditable and the
 * view counter survives.
 */
export const reportShares = pgTable(
  "report_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    token: text("token").notNull(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    /** Opt-in: off means the report shows the role and numbers but no name. */
    showName: boolean("show_name").notNull().default(true),
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("shares_token_uidx").on(t.token),
    index("shares_student_idx").on(t.studentId, t.createdAt),
  ]
)
