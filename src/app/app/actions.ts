"use server"

import { revalidatePath } from "next/cache"
import { and, eq, isNull } from "drizzle-orm"

import { db, schema } from "@/db"
import { ensureStudent } from "@/lib/students"
import { getLatestRun } from "@/lib/analysis"
import { getShareForRun, newShareToken } from "@/lib/shares"
import { discoverForRun } from "@/lib/discovery/discover"
import { createJobTarget, deleteJobTarget, JdError } from "@/lib/jd/target"
import { replanRole } from "@/lib/replan"
import { readinessScore, perTrackReadiness } from "@/lib/scoring/readiness"
import type { GapResult } from "@/lib/scoring/gap"

/**
 * Server actions. Each one re-authenticates via `ensureStudent()` — Clerk
 * deprecated middleware path matching precisely because Server Functions can
 * slip past a matcher, so nothing here trusts the proxy.
 *
 * The write path reuses the exact arithmetic the analysis used. The UI cannot
 * produce a state the workflow couldn't.
 */

const round1 = (n: number) => Math.round(n * 10) / 10

/** Reads the latest run's assessments back into GapResult shape. */
async function loadGauges(runId: string): Promise<
  (GapResult & { id: string })[]
> {
  const rows = await db
    .select()
    .from(schema.skillAssessments)
    .where(eq(schema.skillAssessments.runId, runId))
  return rows.map((r) => ({
    id: r.id,
    trackId: r.trackId,
    provenLevel: r.provenLevel,
    requiredLevel: r.requiredLevel,
    gap: r.gap,
    weight: r.weight,
    weeksToClose: r.weeksToClose,
    status: r.status,
    isBlocking: false,
  }))
}

/** Recomputes readiness from the stored gauges and writes today's snapshot. */
async function snapshotReadiness(
  studentId: string,
  roleId: string,
  runId: string
) {
  const gauges = await loadGauges(runId)
  const readiness = readinessScore(gauges)
  await db
    .insert(schema.readinessSnapshots)
    .values({
      studentId,
      roleId,
      capturedOn: new Date().toISOString().slice(0, 10),
      readiness,
      perTrack: perTrackReadiness(gauges),
      source: "event",
    })
    .onConflictDoUpdate({
      target: [
        schema.readinessSnapshots.studentId,
        schema.readinessSnapshots.roleId,
        schema.readinessSnapshots.capturedOn,
      ],
      set: { readiness, perTrack: perTrackReadiness(gauges) },
    })
  return readiness
}

/** Closes a track on the latest run: proven → required, gap → 0. */
async function closeTrack(runId: string, trackId: string) {
  const [row] = await db
    .select()
    .from(schema.skillAssessments)
    .where(
      and(
        eq(schema.skillAssessments.runId, runId),
        eq(schema.skillAssessments.trackId, trackId)
      )
    )
  if (!row || row.status !== "open") return { delta: 0, prev: row?.provenLevel }

  await db
    .update(schema.skillAssessments)
    .set({
      provenLevel: row.requiredLevel,
      gap: 0,
      weeksToClose: 0,
      status: "met",
    })
    .where(eq(schema.skillAssessments.id, row.id))

  return { delta: round1(row.gap), prev: row.provenLevel }
}

export type ActionSummary = {
  ok: boolean
  message: string
  readiness?: number
  delta?: number
}

export async function toggleRoadmapItem(
  itemId: string
): Promise<ActionSummary> {
  const student = await ensureStudent()

  // Ownership check: the item must belong to this student's roadmap.
  const [item] = await db
    .select({
      id: schema.roadmapItems.id,
      status: schema.roadmapItems.status,
      kind: schema.roadmapItems.kind,
      label: schema.roadmapItems.label,
      trackId: schema.roadmapItems.trackId,
      projectId: schema.roadmapItems.projectId,
      studentId: schema.roadmaps.studentId,
      roleId: schema.roadmaps.roleId,
      runId: schema.roadmaps.runId,
    })
    .from(schema.roadmapItems)
    .innerJoin(
      schema.roadmaps,
      eq(schema.roadmaps.id, schema.roadmapItems.roadmapId)
    )
    .where(eq(schema.roadmapItems.id, itemId))

  if (!item || item.studentId !== student.id)
    return { ok: false, message: "That item isn't on your roadmap." }

  if (item.status === "done") {
    // Undo: restore the level the completion event recorded, then re-snapshot.
    await db
      .update(schema.roadmapItems)
      .set({ status: "planned", completedAt: null })
      .where(eq(schema.roadmapItems.id, item.id))

    const events = await db
      .select()
      .from(schema.progressEvents)
      .where(eq(schema.progressEvents.studentId, student.id))
    const completion = events.find(
      (e) => e.roadmapItemId === item.id && e.type === "item_completed"
    )
    const restores = (completion?.metadata?.restores ?? []) as {
      trackId: string
      prev: number
    }[]

    for (const r of restores) {
      const [row] = await db
        .select()
        .from(schema.skillAssessments)
        .where(
          and(
            eq(schema.skillAssessments.runId, item.runId),
            eq(schema.skillAssessments.trackId, r.trackId)
          )
        )
      if (!row) continue
      const gap = round1(Math.max(0, row.requiredLevel - r.prev))
      await db
        .update(schema.skillAssessments)
        .set({
          provenLevel: r.prev,
          gap,
          status: gap > 0 ? "open" : row.provenLevel > row.requiredLevel ? "above" : "met",
        })
        .where(eq(schema.skillAssessments.id, row.id))
    }
    if (completion) {
      await db
        .delete(schema.progressEvents)
        .where(eq(schema.progressEvents.id, completion.id))
    }
    const readiness = await snapshotReadiness(student.id, item.roleId, item.runId)
    revalidatePath("/app/roadmap")
    revalidatePath("/app/map")
    revalidatePath("/app/progress")
    return {
      ok: true,
      message: `Reopened ${item.label} — readiness back to ${readiness}.`,
      readiness,
    }
  }
  {
    // Complete: a gap item closes its track; a project closes what it built.
    await db
      .update(schema.roadmapItems)
      .set({ status: "done", completedAt: new Date() })
      .where(eq(schema.roadmapItems.id, item.id))

    const trackIds: string[] = []
    if (item.kind === "gap" && item.trackId) trackIds.push(item.trackId)
    if (item.kind === "project" && item.projectId) {
      const [project] = await db
        .select({ closes: schema.projectCatalog.closesTrackIds })
        .from(schema.projectCatalog)
        .where(eq(schema.projectCatalog.id, item.projectId))
      trackIds.push(...(project?.closes ?? []))
    }

    let totalDelta = 0
    const restores: { trackId: string; prev: number }[] = []
    for (const trackId of trackIds) {
      const { delta, prev } = await closeTrack(item.runId, trackId)
      if (delta > 0 && prev !== undefined) {
        totalDelta += delta
        restores.push({ trackId, prev })
      }
    }

    await db.insert(schema.progressEvents).values({
      studentId: student.id,
      type: "item_completed",
      trackId: item.trackId,
      roadmapItemId: item.id,
      levelDelta: round1(totalDelta),
      headline: `Completed: ${item.label}.`,
      body:
        totalDelta > 0
          ? `Closed ${restores.length} track${restores.length === 1 ? "" : "s"} on the way.`
          : null,
      metadata: { restores },
    })
    const readiness = await snapshotReadiness(student.id, item.roleId, item.runId)

    revalidatePath("/app/roadmap")
    revalidatePath("/app/map")
    revalidatePath("/app/progress")
    return {
      ok: true,
      // No estimated "before" value: showing an arrow from a number nobody
      // measured would undercut the one thing this product promises.
      message:
        totalDelta > 0
          ? `${item.label} done — readiness now ${readiness}.`
          : `${item.label} done.`,
      readiness,
      delta: totalDelta,
    }
  }
}

/**
 * The flagship: re-target the analysis at a different role. Zero model calls —
 * the cached evidence signals are re-scored against the new role's benchmark,
 * and the rankers and scheduler rebuild the plan from the results.
 */
export async function switchTargetRole(roleId: string): Promise<ActionSummary> {
  const student = await ensureStudent()
  const run = await getLatestRun(student.id)
  if (!run) return { ok: false, message: "Analyse a resume first." }

  const [role] = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.id, roleId))
  if (!role) return { ok: false, message: "That role isn't available — pick one from the list." }

  try {
    const { readiness, openGaps } = await replanRole({
      studentId: student.id,
      runId: run.id,
      roleId,
      weeklyHours: student.weeklyHours,
    })

    await db
      .update(schema.students)
      .set({ targetRoleId: roleId })
      .where(eq(schema.students.id, student.id))

    await db.insert(schema.progressEvents).values({
      studentId: student.id,
      type: "role_changed",
      levelDelta: 0,
      headline: `Re-targeted at ${role.name}.`,
      body: `Same evidence, new benchmark: readiness ${readiness}, ${openGaps} open gaps.`,
    })

    revalidatePath("/app/map")
    revalidatePath("/app/roadmap")
    revalidatePath("/app/practice")
    revalidatePath("/app/progress")
    return {
      ok: true,
      message: `Measured against ${role.name}: readiness ${readiness}, ${openGaps} open gaps. Same evidence, different bar — no re-upload needed.`,
      readiness,
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not switch roles. Try again.",
    }
  }
}

/** Reschedules everything around a new time budget. Pure arithmetic. */
export async function setWeeklyHours(hours: number): Promise<ActionSummary> {
  const student = await ensureStudent()
  const clamped = Math.max(3, Math.min(40, Math.round(hours)))

  await db
    .update(schema.students)
    .set({ weeklyHours: clamped })
    .where(eq(schema.students.id, student.id))

  const run = await getLatestRun(student.id)
  if (run) {
    try {
      const { readiness, openGaps } = await replanRole({
        studentId: student.id,
        runId: run.id,
        roleId: run.roleId,
        weeklyHours: clamped,
      })
      revalidatePath("/app/map")
      revalidatePath("/app/roadmap")
      revalidatePath("/app/progress")
      return {
        ok: true,
        message: `Rescheduled around ${clamped} hrs/week — ${openGaps} gaps, readiness ${readiness}.`,
        readiness,
      }
    } catch {
      // Pre-cache run: hours are saved, plan stays as-is.
    }
  }
  revalidatePath("/app/roadmap")
  return { ok: true, message: `Weekly hours set to ${clamped}.` }
}

/** Profile fields from the settings screen. */
export async function updateProfile(formData: FormData): Promise<ActionSummary> {
  const student = await ensureStudent()
  const fullName = String(formData.get("fullName") ?? "").slice(0, 80).trim()
  const college = String(formData.get("college") ?? "").slice(0, 120).trim()
  const gradYearRaw = Number(formData.get("gradYear"))
  const gradYear =
    Number.isInteger(gradYearRaw) && gradYearRaw >= 2020 && gradYearRaw <= 2035
      ? gradYearRaw
      : null

  await db
    .update(schema.students)
    .set({
      fullName: fullName || null,
      college: college || null,
      gradYear,
    })
    .where(eq(schema.students.id, student.id))

  revalidatePath("/app/settings")
  return { ok: true, message: "Profile saved." }
}

// ─── Discovery ───────────────────────────────────────────────────────────────

/**
 * Searches the open web for courses and projects matching this student's top
 * open gaps. Slow — several searches plus a classification pass — so the UI
 * runs it behind a pending state rather than optimistically.
 */
export async function refreshDiscoveries(): Promise<ActionSummary> {
  const student = await ensureStudent()
  const run = await getLatestRun(student.id)
  if (!run) return { ok: false, message: "Analyse a resume first." }

  try {
    const outcome = await discoverForRun({ studentId: student.id, runId: run.id })
    revalidatePath("/app/practice")
    return { ok: outcome.found > 0, message: outcome.message }
  } catch (err) {
    console.error("[discovery] refresh failed:", err)
    return { ok: false, message: "The search failed. Try again in a moment." }
  }
}

// ─── Job targets ─────────────────────────────────────────────────────────────

/** Paste a posting → mapped, cited, saved. The one model call happens here. */
export async function addJobTarget(formData: FormData): Promise<ActionSummary> {
  const student = await ensureStudent()
  const text = String(formData.get("posting") ?? "")

  try {
    await createJobTarget(student.id, text)
    revalidatePath("/app/jobs")
    return { ok: true, message: "Posting mapped — every requirement cites its line." }
  } catch (err) {
    if (err instanceof JdError) return { ok: false, message: err.message }
    console.error("[jd] mapping failed:", err)
    return {
      ok: false,
      message: "Couldn't map that posting — the model service may be busy. Try again.",
    }
  }
}

export async function removeJobTarget(targetId: string): Promise<ActionSummary> {
  const student = await ensureStudent()
  await deleteJobTarget(student.id, targetId)
  revalidatePath("/app/jobs")
  return { ok: true, message: "Target removed." }
}

// ─── Sharing ─────────────────────────────────────────────────────────────────

export type ShareState = {
  ok: boolean
  message: string
  token?: string
  showName?: boolean
}

/**
 * Mints a read-only link to the latest analysis, or returns the existing one.
 *
 * Idempotent on purpose: a student who clicks "Share" twice should get the same
 * URL, not silently orphan the one they already pasted into an email.
 */
export async function createShareLink(): Promise<ShareState> {
  const student = await ensureStudent()
  const run = await getLatestRun(student.id)
  if (!run) return { ok: false, message: "Analyse a resume first." }

  const existing = await getShareForRun(student.id, run.id)
  if (existing) {
    return {
      ok: true,
      message: "Link ready.",
      token: existing.token,
      showName: existing.showName,
    }
  }

  const token = newShareToken()
  await db.insert(schema.reportShares).values({
    token,
    studentId: student.id,
    runId: run.id,
  })

  revalidatePath("/app/map")
  return {
    ok: true,
    message: "Link created — anyone with it can see this report.",
    token,
    showName: true,
  }
}

/**
 * Revokes every live link this student holds on the current run.
 *
 * Plural because a run can accumulate shares if one was revoked and re-created;
 * "stop sharing" has to mean all of them or it means nothing.
 */
export async function revokeShareLink(): Promise<ShareState> {
  const student = await ensureStudent()
  const run = await getLatestRun(student.id)
  if (!run) return { ok: false, message: "Nothing to revoke." }

  await db
    .update(schema.reportShares)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.reportShares.studentId, student.id),
        eq(schema.reportShares.runId, run.id),
        isNull(schema.reportShares.revokedAt)
      )
    )

  revalidatePath("/app/map")
  return { ok: true, message: "Link revoked — it now shows a 404." }
}

/** Toggles whether the shared report carries the student's name. */
export async function setShareShowName(showName: boolean): Promise<ShareState> {
  const student = await ensureStudent()
  const run = await getLatestRun(student.id)
  if (!run) return { ok: false, message: "Nothing to update." }

  await db
    .update(schema.reportShares)
    .set({ showName })
    .where(
      and(
        eq(schema.reportShares.studentId, student.id),
        eq(schema.reportShares.runId, run.id),
        isNull(schema.reportShares.revokedAt)
      )
    )

  const share = await getShareForRun(student.id, run.id)
  revalidatePath("/app/map")
  return {
    ok: true,
    message: showName ? "Your name is shown." : "Your name is hidden.",
    token: share?.token,
    showName,
  }
}

/** Marks an interview question practised — habit trail, not readiness. */
export async function markQuestionPractised(
  questionId: string,
  topic: string
): Promise<ActionSummary> {
  const student = await ensureStudent()
  const run = await getLatestRun(student.id)
  if (!run) return { ok: false, message: "Analyse a resume first." }

  await db
    .update(schema.recommendedQuestions)
    .set({ status: "attempted" })
    .where(
      and(
        eq(schema.recommendedQuestions.runId, run.id),
        eq(schema.recommendedQuestions.questionId, questionId)
      )
    )
  await db.insert(schema.progressEvents).values({
    studentId: student.id,
    type: "question_attempted",
    levelDelta: 0,
    headline: `Practised a ${topic} question.`,
    body: "Attempts build the habit trail; only closed gaps move readiness.",
  })

  revalidatePath("/app/practice")
  revalidatePath("/app/progress")
  return { ok: true, message: "Marked practised." }
}
