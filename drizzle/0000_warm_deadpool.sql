CREATE TYPE "public"."cert_verdict" AS ENUM('worth_it', 'skip', 'later');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('study_session', 'item_completed', 'project_shipped', 'question_attempted', 'mock_interview', 'resume_reupload', 'role_changed');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('project', 'internship', 'award', 'coursework', 'publication');--> statement-breakpoint
CREATE TYPE "public"."gap_status" AS ENUM('open', 'met', 'above');--> statement-breakpoint
CREATE TYPE "public"."item_kind" AS ENUM('gap', 'project', 'drill', 'milestone');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('planned', 'in_progress', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."lane_kind" AS ENUM('close_gaps', 'build_proof', 'drill');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."snapshot_source" AS ENUM('run', 'event', 'manual', 'seed');--> statement-breakpoint
CREATE TABLE "analysis_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"resume_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	"workflow_run_id" text,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"current_step" text,
	"progress" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cert_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"cost_inr" integer,
	"exam_window" text,
	"base_value" real NOT NULL,
	"proves_track_ids" jsonb NOT NULL,
	"cheaper_alternative" text
);
--> statement-breakpoint
CREATE TABLE "chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"mastra_thread_id" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"raw_label" text NOT NULL,
	"track_id" text,
	"is_new_since_last" boolean DEFAULT false NOT NULL,
	"confidence" real NOT NULL,
	"signals" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" "event_type" NOT NULL,
	"track_id" text,
	"roadmap_item_id" uuid,
	"minutes" integer DEFAULT 0 NOT NULL,
	"level_delta" real DEFAULT 0 NOT NULL,
	"headline" text NOT NULL,
	"body" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"stack" jsonb NOT NULL,
	"effort_weeks" integer NOT NULL,
	"difficulty" integer NOT NULL,
	"closes_track_ids" jsonb NOT NULL,
	"evidence_produced" text NOT NULL,
	"requires_track_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_bank" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt" text NOT NULL,
	"track_id" text NOT NULL,
	"topic" text NOT NULL,
	"company" text,
	"round" text,
	"year" integer,
	"difficulty" integer NOT NULL,
	"model_answer_outline" text
);
--> statement-breakpoint
CREATE TABLE "readiness_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	"captured_on" date NOT NULL,
	"readiness" real NOT NULL,
	"per_track" jsonb NOT NULL,
	"source" "snapshot_source" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommended_certs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"cert_id" text NOT NULL,
	"verdict" "cert_verdict" NOT NULL,
	"score" real NOT NULL,
	"rank" integer NOT NULL,
	"rationale" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommended_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"project_id" text NOT NULL,
	"score" real NOT NULL,
	"rank" integer NOT NULL,
	"rationale" text NOT NULL,
	"closes_track_ids" jsonb NOT NULL,
	"start_week" integer,
	"end_week" integer
);
--> statement-breakpoint
CREATE TABLE "recommended_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"is_gap_track" boolean NOT NULL,
	"rank" integer NOT NULL,
	"score" real NOT NULL,
	"coach_note" text,
	"status" text DEFAULT 'queued' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"kind" "evidence_kind" NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"metric" text,
	"source_page" integer,
	"source_line" integer,
	"track_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"page" integer NOT NULL,
	"line" integer NOT NULL,
	"quote" text NOT NULL,
	"critique" text NOT NULL,
	"suggested_fix" text,
	"severity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"page_count" integer NOT NULL,
	"raw_text" text NOT NULL,
	"pages_text" jsonb NOT NULL,
	"parse_ms" integer NOT NULL,
	"sections_found" integer DEFAULT 0 NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roadmap_id" uuid NOT NULL,
	"lane" "lane_kind" NOT NULL,
	"kind" "item_kind" NOT NULL,
	"track_id" text,
	"project_id" text,
	"label" text NOT NULL,
	"detail" text NOT NULL,
	"start_week" integer NOT NULL,
	"end_week" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"status" "item_status" DEFAULT 'planned' NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "roadmap_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roadmap_id" uuid NOT NULL,
	"week" integer NOT NULL,
	"headline" text NOT NULL,
	"body" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	"total_weeks" integer DEFAULT 14 NOT NULL,
	"weekly_hours" integer DEFAULT 9 NOT NULL,
	"start_date" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_benchmarks" (
	"role_id" text NOT NULL,
	"track_id" text NOT NULL,
	"required_level" real NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"hours_per_level" real NOT NULL,
	"is_blocking" boolean DEFAULT false NOT NULL,
	"rationale" text NOT NULL,
	"source_note" text NOT NULL,
	"benchmark_version" text DEFAULT '2026.1' NOT NULL,
	CONSTRAINT "role_benchmarks_role_id_track_id_pk" PRIMARY KEY("role_id","track_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"blurb" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	"track_id" text NOT NULL,
	"proven_level" real NOT NULL,
	"required_level" real NOT NULL,
	"gap" real NOT NULL,
	"weight" real NOT NULL,
	"weeks_to_close" real NOT NULL,
	"status" "gap_status" NOT NULL,
	"note" text NOT NULL,
	"rubric_level_hit" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"level_rubric" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text,
	"full_name" text,
	"college" text,
	"grad_year" integer,
	"target_role_id" text,
	"weekly_hours" integer DEFAULT 9 NOT NULL,
	"target_date" date,
	"horizon_weeks" integer DEFAULT 14 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_log" (
	"student_id" uuid NOT NULL,
	"day" date NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "study_log_student_id_day_pk" PRIMARY KEY("student_id","day")
);
--> statement-breakpoint
CREATE TABLE "track_prerequisites" (
	"role_id" text NOT NULL,
	"track_id" text NOT NULL,
	"requires_track_id" text NOT NULL,
	CONSTRAINT "track_prerequisites_role_id_track_id_requires_track_id_pk" PRIMARY KEY("role_id","track_id","requires_track_id")
);
--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_skills" ADD CONSTRAINT "extracted_skills_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_skills" ADD CONSTRAINT "extracted_skills_track_id_skill_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."skill_tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_track_id_skill_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."skill_tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_roadmap_item_id_roadmap_items_id_fk" FOREIGN KEY ("roadmap_item_id") REFERENCES "public"."roadmap_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_bank" ADD CONSTRAINT "question_bank_track_id_skill_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."skill_tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_snapshots" ADD CONSTRAINT "readiness_snapshots_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommended_certs" ADD CONSTRAINT "recommended_certs_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommended_certs" ADD CONSTRAINT "recommended_certs_cert_id_cert_catalog_id_fk" FOREIGN KEY ("cert_id") REFERENCES "public"."cert_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommended_projects" ADD CONSTRAINT "recommended_projects_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommended_projects" ADD CONSTRAINT "recommended_projects_project_id_project_catalog_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommended_questions" ADD CONSTRAINT "recommended_questions_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommended_questions" ADD CONSTRAINT "recommended_questions_question_id_question_bank_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question_bank"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_evidence" ADD CONSTRAINT "resume_evidence_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_flags" ADD CONSTRAINT "resume_flags_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_track_id_skill_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."skill_tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_project_id_project_catalog_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_notes" ADD CONSTRAINT "roadmap_notes_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_benchmarks" ADD CONSTRAINT "role_benchmarks_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_benchmarks" ADD CONSTRAINT "role_benchmarks_track_id_skill_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."skill_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_track_id_skill_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."skill_tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_target_role_id_roles_id_fk" FOREIGN KEY ("target_role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_log" ADD CONSTRAINT "study_log_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_prerequisites" ADD CONSTRAINT "track_prerequisites_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_prerequisites" ADD CONSTRAINT "track_prerequisites_track_id_skill_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."skill_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_prerequisites" ADD CONSTRAINT "track_prerequisites_requires_track_id_skill_tracks_id_fk" FOREIGN KEY ("requires_track_id") REFERENCES "public"."skill_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runs_student_idx" ON "analysis_runs" USING btree ("student_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "threads_mastra_uidx" ON "chat_threads" USING btree ("mastra_thread_id");--> statement-breakpoint
CREATE INDEX "events_student_time_idx" ON "progress_events" USING btree ("student_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "snap_uidx" ON "readiness_snapshots" USING btree ("student_id","role_id","captured_on");--> statement-breakpoint
CREATE UNIQUE INDEX "reccert_run_cert_uidx" ON "recommended_certs" USING btree ("run_id","cert_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recproj_run_proj_uidx" ON "recommended_projects" USING btree ("run_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recq_run_q_uidx" ON "recommended_questions" USING btree ("run_id","question_id");--> statement-breakpoint
CREATE INDEX "resumes_student_idx" ON "resumes" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "items_roadmap_idx" ON "roadmap_items" USING btree ("roadmap_id","lane","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "assess_run_track_uidx" ON "skill_assessments" USING btree ("run_id","track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_clerk_uidx" ON "students" USING btree ("clerk_user_id");