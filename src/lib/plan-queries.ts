import "server-only"

import { and, asc, desc, eq } from "drizzle-orm"

import { db, schema } from "@/db"

/** The active roadmap with its items and notes, or null before any analysis. */
export async function getRoadmap(studentId: string) {
  const [roadmap] = await db
    .select()
    .from(schema.roadmaps)
    .where(
      and(
        eq(schema.roadmaps.studentId, studentId),
        eq(schema.roadmaps.isActive, true)
      )
    )
    .orderBy(desc(schema.roadmaps.createdAt))
    .limit(1)

  if (!roadmap) return null

  const [items, notes] = await Promise.all([
    db
      .select()
      .from(schema.roadmapItems)
      .where(eq(schema.roadmapItems.roadmapId, roadmap.id))
      .orderBy(asc(schema.roadmapItems.sortOrder)),
    db
      .select()
      .from(schema.roadmapNotes)
      .where(eq(schema.roadmapNotes.roadmapId, roadmap.id))
      .orderBy(asc(schema.roadmapNotes.sortOrder)),
  ])

  return { ...roadmap, items, notes }
}

/** Ranked projects, certs and questions for a run, joined to their catalogs. */
export async function getRecommendations(runId: string) {
  const [projects, certs, questions] = await Promise.all([
    db
      .select({
        rank: schema.recommendedProjects.rank,
        rationale: schema.recommendedProjects.rationale,
        closesTrackIds: schema.recommendedProjects.closesTrackIds,
        startWeek: schema.recommendedProjects.startWeek,
        endWeek: schema.recommendedProjects.endWeek,
        id: schema.projectCatalog.id,
        title: schema.projectCatalog.title,
        summary: schema.projectCatalog.summary,
        stack: schema.projectCatalog.stack,
        effortWeeks: schema.projectCatalog.effortWeeks,
      })
      .from(schema.recommendedProjects)
      .innerJoin(
        schema.projectCatalog,
        eq(schema.projectCatalog.id, schema.recommendedProjects.projectId)
      )
      .where(eq(schema.recommendedProjects.runId, runId))
      .orderBy(asc(schema.recommendedProjects.rank)),
    db
      .select({
        rank: schema.recommendedCerts.rank,
        verdict: schema.recommendedCerts.verdict,
        rationale: schema.recommendedCerts.rationale,
        name: schema.certCatalog.name,
        provider: schema.certCatalog.provider,
        costInr: schema.certCatalog.costInr,
        examWindow: schema.certCatalog.examWindow,
      })
      .from(schema.recommendedCerts)
      .innerJoin(
        schema.certCatalog,
        eq(schema.certCatalog.id, schema.recommendedCerts.certId)
      )
      .where(eq(schema.recommendedCerts.runId, runId))
      .orderBy(asc(schema.recommendedCerts.rank)),
    db
      .select({
        rank: schema.recommendedQuestions.rank,
        questionId: schema.recommendedQuestions.questionId,
        isGapTrack: schema.recommendedQuestions.isGapTrack,
        coachNote: schema.recommendedQuestions.coachNote,
        status: schema.recommendedQuestions.status,
        prompt: schema.questionBank.prompt,
        topic: schema.questionBank.topic,
        company: schema.questionBank.company,
        round: schema.questionBank.round,
        year: schema.questionBank.year,
        outline: schema.questionBank.modelAnswerOutline,
      })
      .from(schema.recommendedQuestions)
      .innerJoin(
        schema.questionBank,
        eq(schema.questionBank.id, schema.recommendedQuestions.questionId)
      )
      .where(eq(schema.recommendedQuestions.runId, runId))
      .orderBy(asc(schema.recommendedQuestions.rank)),
  ])

  return { projects, certs, questions }
}

/** Everything the intake screen shows about the latest analysis. */
export async function getIntakeDetail(runId: string) {
  const [skills, evidence, flags, resume] = await Promise.all([
    db
      .select()
      .from(schema.extractedSkills)
      .where(eq(schema.extractedSkills.runId, runId)),
    db
      .select()
      .from(schema.resumeEvidence)
      .where(eq(schema.resumeEvidence.runId, runId)),
    db
      .select()
      .from(schema.resumeFlags)
      .where(eq(schema.resumeFlags.runId, runId))
      .orderBy(desc(schema.resumeFlags.severity)),
    db
      .select({
        fileName: schema.resumes.fileName,
        pageCount: schema.resumes.pageCount,
        parseMs: schema.resumes.parseMs,
        uploadedAt: schema.resumes.uploadedAt,
      })
      .from(schema.resumes)
      .innerJoin(
        schema.analysisRuns,
        eq(schema.analysisRuns.resumeId, schema.resumes.id)
      )
      .where(eq(schema.analysisRuns.id, runId)),
  ])

  return { skills, evidence, flags, resume: resume[0] ?? null }
}

/** Snapshots, study log and movers for the progress screen. */
export async function getProgress(studentId: string, roleId: string) {
  const [snapshots, log, events] = await Promise.all([
    db
      .select()
      .from(schema.readinessSnapshots)
      .where(
        and(
          eq(schema.readinessSnapshots.studentId, studentId),
          eq(schema.readinessSnapshots.roleId, roleId)
        )
      )
      .orderBy(asc(schema.readinessSnapshots.capturedOn)),
    db
      .select()
      .from(schema.studyLog)
      .where(eq(schema.studyLog.studentId, studentId))
      .orderBy(asc(schema.studyLog.day)),
    db
      .select()
      .from(schema.progressEvents)
      .where(eq(schema.progressEvents.studentId, studentId))
      .orderBy(desc(schema.progressEvents.occurredAt))
      .limit(8),
  ])

  return { snapshots, log, events }
}
