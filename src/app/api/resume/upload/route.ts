import { after, type NextRequest } from "next/server"
import { eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { ensureStudent } from "@/lib/students"
import { extractResume, ResumeParseError } from "@/lib/pdf/extract"
import { mastra } from "@/mastra"

/** unpdf and pg both need Node APIs. */
export const runtime = "nodejs"
/**
 * The response returns in ~2s, but the analysis continues via `after()` and
 * the free-tier model spends ~160s reasoning. The function must stay alive
 * that long or the run dies mid-flight with its status stuck on "running" —
 * so this is sized to the after() work, not the response.
 */
export const maxDuration = 300

const MAX_BYTES = 8 * 1024 * 1024

export async function POST(request: NextRequest) {
  // Resource-based auth: Clerk deprecated middleware path matching, so every
  // handler checks for itself rather than trusting the proxy.
  const student = await ensureStudent()

  const form = await request.formData().catch(() => null)
  const file = form?.get("resume")

  if (!(file instanceof File)) {
    return Response.json(
      { error: "Attach a PDF as the `resume` field." },
      { status: 400 }
    )
  }
  if (file.type && file.type !== "application/pdf") {
    return Response.json(
      { error: "That's not a PDF. Export your resume as PDF and try again." },
      { status: 415 }
    )
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "That file is over 8 MB. Most resumes are under 500 KB." },
      { status: 413 }
    )
  }

  let parsed
  try {
    parsed = await extractResume(new Uint8Array(await file.arrayBuffer()))
  } catch (err) {
    if (err instanceof ResumeParseError) {
      // A scan has no text layer. Say so specifically and point at the way out
      // rather than returning a generic failure.
      return Response.json(
        { error: err.message, kind: err.kind },
        { status: 422 }
      )
    }
    throw err
  }

  const roleId = (form?.get("roleId") as string) || student.targetRoleId
  if (!roleId) {
    return Response.json({ error: "Pick a target role first." }, { status: 400 })
  }

  const [resume] = await db
    .insert(schema.resumes)
    .values({
      studentId: student.id,
      fileName: file.name || "resume.pdf",
      fileSize: file.size,
      pageCount: parsed.pageCount,
      rawText: parsed.rawText,
      pagesText: parsed.pagesText,
      parseMs: parsed.parseMs,
      sectionsFound: parsed.pagesText.length,
    })
    .returning()

  const [run] = await db
    .insert(schema.analysisRuns)
    .values({
      studentId: student.id,
      resumeId: resume.id,
      roleId,
      status: "queued",
    })
    .returning()

  // The analysis makes a model call and takes tens of seconds on the free
  // tier, so the response returns immediately and the client polls
  // /api/analysis/[runId]. `after()` keeps the work alive past the response —
  // without it a serverless function freezes the moment it replies.
  after(async () => {
    try {
      const workflowRun = await mastra
        .getWorkflow("analyzeResumeWorkflow")
        .createRun()

      await db
        .update(schema.analysisRuns)
        .set({ workflowRunId: workflowRun.runId, status: "running" })
        .where(eq(schema.analysisRuns.id, run.id))

      const result = await workflowRun.start({
        inputData: {
          runId: run.id,
          studentId: student.id,
          resumeId: resume.id,
          roleId,
          weeklyHours: student.weeklyHours,
        },
      })

      if (result.status !== "success") {
        throw new Error(
          result.status === "failed"
            ? String(result.error ?? "The analysis failed.")
            : `Analysis ended as "${result.status}".`
        )
      }
    } catch (err) {
      // A failed run must look failed. The free model tier rate-limits in
      // bursts, and a run stuck on "running" forever is worse than an honest
      // error the student can retry.
      await db
        .update(schema.analysisRuns)
        .set({
          status: "failed",
          error:
            err instanceof Error
              ? err.message.slice(0, 500)
              : "The analysis failed.",
          finishedAt: new Date(),
        })
        .where(eq(schema.analysisRuns.id, run.id))
    }
  })

  return Response.json({
    runId: run.id,
    resumeId: resume.id,
    pageCount: parsed.pageCount,
    parseMs: parsed.parseMs,
  })
}
