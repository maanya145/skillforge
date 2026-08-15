-- A pasted job posting mapped onto the track vocabulary. Only the mappings
-- persist; the derived benchmark is recomputed at read time from seeded rows.
CREATE TABLE IF NOT EXISTS "job_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "company" text,
  "base_role_id" text NOT NULL REFERENCES "roles"("id"),
  "source_text" text NOT NULL,
  "mappings" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "job_targets_student_idx" ON "job_targets" USING btree ("student_id","created_at");
