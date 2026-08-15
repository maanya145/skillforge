-- How the resume text was recovered — decides whether p.N/L.N citations
-- correspond to the printed document or to synthesised 60-line chunks.
ALTER TABLE "resumes" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'text-layer' NOT NULL;
