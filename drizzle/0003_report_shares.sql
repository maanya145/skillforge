-- Read-only share links for a single analysis run.
-- The token is the access control model, so it is uniquely indexed and never
-- reused. Revocation is a timestamp rather than a delete, so the view counter
-- and the audit trail survive it.
CREATE TABLE IF NOT EXISTS "report_shares" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" text NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "run_id" uuid NOT NULL REFERENCES "analysis_runs"("id") ON DELETE cascade,
  "show_name" boolean DEFAULT true NOT NULL,
  "view_count" integer DEFAULT 0 NOT NULL,
  "last_viewed_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "shares_token_uidx" ON "report_shares" USING btree ("token");
CREATE INDEX IF NOT EXISTS "shares_student_idx" ON "report_shares" USING btree ("student_id","created_at");
