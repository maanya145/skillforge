import { and, eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { ensureStudent } from "@/lib/students"

export const runtime = "nodejs"

/**
 * Polled by the intake screen while an analysis runs.
 *
 * Scoped to the signed-in student's own runs — the run id is a UUID, but
 * guessability is not an access control model.
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

  return Response.json(run, {
    // Polled every 800ms; a cached response would freeze the checklist.
    headers: { "cache-control": "no-store" },
  })
}
