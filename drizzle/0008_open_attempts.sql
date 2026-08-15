-- Attempts hold any LeetCode slug, not just curated ones, with a title.
ALTER TABLE "problem_attempts" DROP CONSTRAINT IF EXISTS "problem_attempts_problem_id_problem_catalog_id_fk";
ALTER TABLE "problem_attempts" ADD COLUMN IF NOT EXISTS "title" text;
