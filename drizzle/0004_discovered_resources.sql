-- Courses and project ideas found on the open web for a student's open gaps.
-- Separate from project_catalog on purpose: the seeded catalogs are versioned
-- and hand-authored, and the scheduler depends on their verified effortWeeks.
-- Discovered rows share the scorer but never reach the roadmap.
-- Postgres has no CREATE TYPE IF NOT EXISTS. The applier tolerates error
-- 42710 (duplicate_object) on this one statement so the file stays re-runnable.
CREATE TYPE "discovered_kind" AS ENUM ('course', 'project');

CREATE TABLE IF NOT EXISTS "discovered_resources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "run_id" uuid NOT NULL REFERENCES "analysis_runs"("id") ON DELETE cascade,
  "kind" "discovered_kind" NOT NULL,
  "title" text NOT NULL,
  "url" text NOT NULL,
  "source" text NOT NULL,
  "summary" text NOT NULL,
  "closes_track_ids" jsonb NOT NULL,
  "effort_weeks" integer,
  "cost_note" text,
  "score" real NOT NULL,
  "rank" integer NOT NULL,
  "rationale" text NOT NULL,
  "source_query" text NOT NULL,
  "status" text DEFAULT 'new' NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "discovered_student_url_uidx" ON "discovered_resources" USING btree ("student_id","url");
CREATE INDEX IF NOT EXISTS "discovered_run_idx" ON "discovered_resources" USING btree ("run_id","rank");
