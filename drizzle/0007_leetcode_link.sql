-- Connected LeetCode account: verified solves instead of self-report.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "leetcode_username" text;
ALTER TABLE "problem_attempts" ADD COLUMN IF NOT EXISTS "via" text DEFAULT 'manual' NOT NULL;
