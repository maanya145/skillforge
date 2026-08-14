-- chat_threads never had a writer (Mastra memory was removed), so the
-- mastra_thread_id link column is dropped rather than migrated.
ALTER TABLE "chat_threads" DROP COLUMN IF EXISTS "mastra_thread_id";
ALTER TABLE "chat_threads" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
DROP INDEX IF EXISTS "threads_mastra_uidx";
CREATE INDEX IF NOT EXISTS "threads_student_idx" ON "chat_threads" USING btree ("student_id","updated_at");

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL REFERENCES "chat_threads"("id") ON DELETE cascade,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "tools_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "messages_thread_idx" ON "chat_messages" USING btree ("thread_id","created_at");

-- Duplicate-upload detection: reuse a prior extraction instead of re-running
-- the model on identical bytes.
ALTER TABLE "resumes" ADD COLUMN IF NOT EXISTS "content_hash" text;
CREATE INDEX IF NOT EXISTS "resumes_hash_idx" ON "resumes" USING btree ("student_id","content_hash");
