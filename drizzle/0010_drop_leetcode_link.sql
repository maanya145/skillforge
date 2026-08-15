-- Remove the LeetCode account link: its columns and the rows it created.
-- Verified marks came from the connection, so they leave with it.
DELETE FROM "progress_events" WHERE "type" = 'problem_solved' AND "metadata"->>'via' = 'leetcode';
DELETE FROM "problem_attempts" WHERE "via" = 'leetcode';
ALTER TABLE "problem_attempts" DROP COLUMN IF EXISTS "via";
ALTER TABLE "students" DROP COLUMN IF EXISTS "leetcode_username";
