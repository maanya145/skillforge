import { and, eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { ensureStudent } from "@/lib/students"
import { RUN_TIMEOUT_MS } from "@/app/api/resume/upload/route"

export const runtime = "nodejs"

/**
 * Polled by the intake screen while an analysis runs.
 *
 * Scoped to the signed-in student's own runs — the run id is a UUID, but
 * guessability is not an access control model.
 *
 * Also reaps dead runs. The `after()` block that owns a run can vanish with
 * its serverless instance (redeploy, crash, platform timeout), leaving the row
 * stuck on "running" forever and the UI polling a corpse. Since this endpoint
 * is hit every second while a run is in flight, it is the natural place to
 * notice.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/analysis/[runId]">
) {
  const student = await ensureStudent()
  const { runId } = await params

  const [run] = await db
    .select({
      id: schema.analysisRuns.id,
      status: schema.analysisRuns.status,
      currentStep: schema.analysisRuns.currentStep,
      progress: schema.analysisRuns.progress,
      error: schema.analysisRuns.error,
      startedAt: schema.analysisRuns.startedAt,
      finishedAt: schema.analysisRuns.finishedAt,
    })
    .from(schema.analysisRuns)
    .where(
      and(
        eq(schema.analysisRuns.id, runId),
        eq(schema.analysisRuns.studentId, student.id)
      )
    )

  if (!run) {
    return Response.json({ error: "No such analysis." }, { status: 404 })
  }

  const unfinished = run.status === "queued" || run.status === "running"
  const expired = Date.now() - run.startedAt.getTime() > RUN_TIMEOUT_MS

  if (unfinished && expired) {
    const error =
      "The analysis didn't finish in time — the free model service is slow right now. Try again, or paste your resume text instead."
    await db
      .update(schema.analysisRuns)
      .set({ status: "failed", error, finishedAt: new Date() })
      .where(eq(schema.analysisRuns.id, run.id))
    return Response.json(
      { ...run, status: "failed", error },
      { headers: { "cache-control": "no-store" } }
    )
  }

  return Response.json(run, {
    // Polled every second; a cached response would freeze the checklist.
    headers: { "cache-control": "no-store" },
  })
}
