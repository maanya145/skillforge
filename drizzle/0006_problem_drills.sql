-- Real LeetCode problems, seeded per track, plus per-student solved marks.
ALTER TYPE "event_type" ADD VALUE IF NOT EXISTS 'problem_solved';

CREATE TABLE IF NOT EXISTS "problem_catalog" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "track_id" text NOT NULL REFERENCES "skill_tracks"("id"),
  "difficulty" integer NOT NULL,
  "pattern" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "problem_attempts" (
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "problem_id" text NOT NULL REFERENCES "problem_catalog"("id"),
  "solved_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("student_id","problem_id")
);
