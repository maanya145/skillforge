import { createHash } from "node:crypto"
import { after, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, isNotNull } from "drizzle-orm"

import { db, schema } from "@/db"
import { ensureStudent } from "@/lib/students"
import {
  extractResume,
  pseudoPages,
  ResumeParseError,
  type ExtractedResume,
} from "@/lib/pdf/extract"
import { ocrResume, ocrConfigured } from "@/lib/pdf/firecrawl"
import { wrapImageAsPdf, imageMimeFor } from "@/lib/pdf/image-to-pdf"
import { replanRole } from "@/lib/replan"
import { mastra } from "@/mastra"

export const runtime = "nodejs"
/**
 * The response returns in ~2s, but the analysis continues via `after()` and
 * the free-tier model spends ~160s reasoning. Sized to the after() work.
 */
export const maxDuration = 300

/**
 * Vercel caps a serverless request body at 4.5MB, so a larger file dies at the
 * platform with a non-JSON 413 before any of this code runs. Advertising 8MB
 * would be a promise the deployment cannot keep.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
/**
 * A run older than this with no terminal status is presumed dead.
 *
 * Deliberately just above `maxDuration`: on Hobby the platform kills the
 * function at 300s, and the free model tier has been observed taking far
 * longer than that end to end. When the function dies mid-run nothing can mark
 * the row failed, so the reaper is the only thing that will — and waiting ten
 * minutes to say so is its own bad experience.
 */
export const RUN_TIMEOUT_MS = 6 * 60 * 1000

/** Minimum characters of pasted text worth analysing. */
const MIN_PASTE_CHARS = 200

/** Model and infrastructure failures, translated for a student. */
function friendlyFailure(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "")
  if (/429|rate.?limit|FreeUsageLimit/i.test(raw)) {
    return "The analysis service is rate-limited right now. Wait a minute and try again."
  }
  if (/no structured output|schema|validation/i.test(raw)) {
    return "The analysis came back unreadable. Try again — this usually clears on a second run."
  }
  if (/timeout|ETIMEDOUT|fetch failed|ECONN/i.test(raw)) {
    return "The analysis lost its connection partway through. Try again."
  }
  return "The analysis failed. Try again."
}

export async function POST(request: NextRequest) {
  // ensureStudent throws on no session. The client already handles a 401 by
  // telling the student to sign in again; an opaque 500 sends it down the
  // "the upload failed, try again" path, which is a lie.
  const { userId } = await auth()
  if (!userId) {
    return Response.json(
      { error: "Your session expired — sign in again.", code: "unauthorized" },
      { status: 401 }
    )
  }

  const student = await ensureStudent()

  // ── One analysis at a time ────────────────────────────────────────────────
  // Concurrent runs race in persistStep — whichever finishes last wins the
  // active roadmap — so a second submission joins the first instead.
  const [inFlight] = await db
    .select({
      id: schema.analysisRuns.id,
      status: schema.analysisRuns.status,
      startedAt: schema.analysisRuns.startedAt,
    })
    .from(schema.analysisRuns)
    .where(eq(schema.analysisRuns.studentId, student.id))
    .orderBy(desc(schema.analysisRuns.startedAt))
    .limit(1)

  if (
    inFlight &&
    (inFlight.status === "queued" || inFlight.status === "running") &&
    Date.now() - inFlight.startedAt.getTime() < RUN_TIMEOUT_MS
  ) {
    return Response.json(
      {
        error: "An analysis is already running.",
        code: "already_running",
        runId: inFlight.id,
      },
      { status: 409 }
    )
  }

  const form = await request.formData().catch(() => null)
  if (!form) {
    return Response.json(
      { error: "That upload was malformed. Try again." },
      { status: 400 }
    )
  }

  // ── Validate the target role before writing anything ──────────────────────
  const requestedRole = (form.get("roleId") as string) || student.targetRoleId
  if (!requestedRole) {
    return Response.json({ error: "Pick a target role first." }, { status: 400 })
  }
  const [role] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.id, requestedRole))
  if (!role) {
    return Response.json(
      { error: "That role isn't available — pick one from the list." },
      { status: 400 }
    )
  }
  const roleId = role.id

  // ── Two intake paths: a PDF, or pasted text ───────────────────────────────
  const pasted = (form.get("text") as string | null)?.trim() ?? null
  const file = form.get("resume")

  let fileName: string
  let fileSize: number
  let pageCount: number
  let pagesText: string[]
  let rawText: string
  let parseMs: number
  let contentHash: string
  let source: ExtractedResume["source"]

  if (pasted) {
    if (pasted.length < MIN_PASTE_CHARS) {
      return Response.json(
        {
          error: `That's only ${pasted.length} characters — paste the whole resume so there's something to measure.`,
        },
        { status: 400 }
      )
    }
    const started = performance.now()
    pagesText = pseudoPages(pasted)
    rawText = pagesText.join("\n\n")
    fileName = "Pasted resume"
    fileSize = pasted.length
    pageCount = pagesText.length
    parseMs = Math.round(performance.now() - started)
    contentHash = createHash("sha256").update(rawText).digest("hex")
    source = "pasted"
  } else {
    if (!(file instanceof File)) {
      return Response.json(
        { error: "Attach a PDF, or paste your resume text." },
        { status: 400 }
      )
    }
    const looksPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    const imageMime = looksPdf ? null : imageMimeFor(file)
    if (!looksPdf && !imageMime) {
      return Response.json(
        {
          error:
            "That file type isn't supported. Upload a PDF, a PNG or JPG photo of your resume — or paste the text.",
        },
        { status: 415 }
      )
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        {
          error: `That file is over ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB. Most resumes are under 500 KB.`,
        },
        { status: 413 }
      )
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    contentHash = createHash("sha256").update(bytes).digest("hex")

    let parsed: ExtractedResume | null = null
    if (imageMime) {
      // A photo has no text layer by definition — OCR is the only path, so
      // fail fast and honestly when it isn't configured rather than trying.
      if (!ocrConfigured) {
        return Response.json(
          {
            error:
              "Photo uploads need the OCR service, which isn't set up here. Paste your resume text instead.",
          },
          { status: 422 }
        )
      }
      // OCR is seconds of third-party latency the student should spend
      // watching the checklist, not a spinner on the upload button — so the
      // photo path defers everything: the run is created now, and wrap → OCR
      // → analysis all happen in after(), with failures marked on the run.
      return deferredImageIntake({
        student,
        roleId,
        bytes,
        imageMime,
        fileName: file.name || "resume-photo",
        fileSize: file.size,
        contentHash,
      })
    } else {
      try {
        parsed = await extractResume(bytes)
      } catch (err) {
        if (!(err instanceof ResumeParseError)) throw err

        // No text layer means a scan, a photo or outlined glyphs — precisely
        // the case OCR exists for. Every other parse failure (encrypted,
        // corrupt) is not something OCR can rescue, so it goes straight back.
        if (err.kind === "no-text-layer") {
          parsed = await ocrResume(bytes, file.name)
        }
        if (!parsed) {
          return Response.json(
            { error: err.message, kind: err.kind },
            { status: 422 }
          )
        }
      }
    }
    pagesText = parsed.pagesText
    rawText = parsed.rawText
    pageCount = parsed.pageCount
    parseMs = parsed.parseMs
    source = parsed.source
    fileName = file.name || "resume.pdf"
    fileSize = file.size
  }

  // ── Identical bytes already analysed? Skip the model entirely ─────────────
  // The extraction is role-independent, so a re-upload of the same resume is
  // pure arithmetic — the same insight that makes role switching instant.
  const [priorRun] = await db
    .select({
      extractCache: schema.analysisRuns.extractCache,
    })
    .from(schema.analysisRuns)
    .innerJoin(schema.resumes, eq(schema.resumes.id, schema.analysisRuns.resumeId))
    .where(
      and(
        eq(schema.resumes.studentId, student.id),
        eq(schema.resumes.contentHash, contentHash),
        eq(schema.analysisRuns.status, "succeeded"),
        isNotNull(schema.analysisRuns.extractCache)
      )
    )
    .orderBy(desc(schema.analysisRuns.startedAt))
    .limit(1)

  const [resume] = await db
    .insert(schema.resumes)
    .values({
      studentId: student.id,
      fileName,
      fileSize,
      pageCount,
      rawText,
      pagesText,
      contentHash,
      parseMs,
      sectionsFound: pagesText.length,
    })
    .returning()

  const reusable = priorRun?.extractCache ?? null

  const [run] = await db
    .insert(schema.analysisRuns)
    .values({
      studentId: student.id,
      resumeId: resume.id,
      roleId,
      status: reusable ? "running" : "queued",
      extractCache: reusable,
      progress: reusable
        ? [
            {
              key: "cached",
              label: "Recognised this resume",
              value: "reusing the previous reading",
            },
          ]
        : [],
    })
    .returning()

  if (reusable) {
    // Deterministic path: score, rank and schedule from the cached evidence.
    // Sub-second, so it is awaited rather than deferred.
    try {
      await replanRole({
        studentId: student.id,
        runId: run.id,
        roleId,
        weeklyHours: student.weeklyHours,
      })
      await db
        .update(schema.analysisRuns)
        .set({ status: "succeeded", currentStep: "persist", finishedAt: new Date() })
        .where(eq(schema.analysisRuns.id, run.id))
      return Response.json({ runId: run.id, resumeId: resume.id, cached: true })
    } catch (err) {
      console.error("[upload] cached replan failed:", err)
      // Fall through to a full analysis rather than failing the upload.
      await db
        .update(schema.analysisRuns)
        .set({ status: "queued", extractCache: null, progress: [] })
        .where(eq(schema.analysisRuns.id, run.id))
    }
  }

  // The analysis outlives this response; `after()` keeps the function alive.
  after(() => runAnalysis(run.id, student, resume.id, roleId))

  return Response.json({
    runId: run.id,
    resumeId: resume.id,
    pageCount,
    parseMs,
    cached: false,
    // The student should know their scan went through OCR — it is why the
    // citations below will not line up with the pages they can see.
    ocr: source === "ocr",
  })
}

/** Start the workflow for a run and translate failures for the student. */
async function runAnalysis(
  runId: string,
  student: { id: string; weeklyHours: number },
  resumeId: string,
  roleId: string
) {
  try {
    const workflowRun = await mastra.getWorkflow("analyzeResumeWorkflow").createRun()

    await db
      .update(schema.analysisRuns)
      .set({ workflowRunId: workflowRun.runId, status: "running" })
      .where(eq(schema.analysisRuns.id, runId))

    const result = await workflowRun.start({
      inputData: {
        runId,
        studentId: student.id,
        resumeId,
        roleId,
        weeklyHours: student.weeklyHours,
      },
    })

    if (result.status !== "success") {
      throw new Error(
        result.status === "failed"
          ? String(result.error ?? "failed")
          : `ended as ${result.status}`
      )
    }
  } catch (err) {
    // Raw internal messages ("Run `npm run db:seed`") must never reach a
    // student; log the cause, store something actionable.
    console.error("[upload] analysis failed:", err)
    await db
      .update(schema.analysisRuns)
      .set({ status: "failed", error: friendlyFailure(err), finishedAt: new Date() })
      .where(eq(schema.analysisRuns.id, runId))
  }
}

/**
 * The photo path: respond immediately, do the slow parts in after().
 *
 * The resume row is created with empty text and filled in once OCR returns —
 * `rawText` is NOT NULL by design, and an empty string under a queued run is
 * honest: nothing has been read yet. Failures mark the run failed with a
 * message the intake screen already knows how to show.
 */
async function deferredImageIntake({
  student,
  roleId,
  bytes,
  imageMime,
  fileName,
  fileSize,
  contentHash,
}: {
  student: { id: string; weeklyHours: number }
  roleId: string
  bytes: Uint8Array
  imageMime: "image/png" | "image/jpeg"
  fileName: string
  fileSize: number
  contentHash: string
}) {
  const [resume] = await db
    .insert(schema.resumes)
    .values({
      studentId: student.id,
      fileName,
      fileSize,
      pageCount: 0,
      rawText: "",
      pagesText: [],
      contentHash,
      parseMs: 0,
      sectionsFound: 0,
    })
    .returning()

  const [run] = await db
    .insert(schema.analysisRuns)
    .values({
      studentId: student.id,
      resumeId: resume.id,
      roleId,
      status: "queued",
      progress: [
        { key: "ocr", label: "Reading your photo", value: "OCR in progress" },
      ],
    })
    .returning()

  after(async () => {
    try {
      const wrapped = await wrapImageAsPdf(bytes, imageMime)
      const parsed = await ocrResume(wrapped, fileName.replace(/\.\w+$/, ".pdf"))
      if (!parsed) {
        await db
          .update(schema.analysisRuns)
          .set({
            status: "failed",
            error:
              "Couldn't read that photo — try a sharper, straight-on shot, or paste the text.",
            finishedAt: new Date(),
          })
          .where(eq(schema.analysisRuns.id, run.id))
        return
      }
      await db
        .update(schema.resumes)
        .set({
          rawText: parsed.rawText,
          pagesText: parsed.pagesText,
          pageCount: parsed.pageCount,
          parseMs: parsed.parseMs,
          sectionsFound: parsed.pagesText.length,
        })
        .where(eq(schema.resumes.id, resume.id))
      await runAnalysis(run.id, student, resume.id, roleId)
    } catch (err) {
      console.error("[upload] deferred photo intake failed:", err)
      await db
        .update(schema.analysisRuns)
        .set({ status: "failed", error: friendlyFailure(err), finishedAt: new Date() })
        .where(eq(schema.analysisRuns.id, run.id))
    }
  })

  return Response.json({
    runId: run.id,
    resumeId: resume.id,
    pageCount: 0,
    parseMs: 0,
    cached: false,
    ocr: true,
  })
}
