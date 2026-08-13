import { z } from "zod"

import { ensureStudent } from "@/lib/students"
import { getLatestRun, getSkillMap } from "@/lib/analysis"
import { getRoadmap, getRecommendations } from "@/lib/plan-queries"
import { mentorAgent } from "@/mastra/agents/mentor"

export const runtime = "nodejs"
/** Free-tier reasoning models are slow; give the response room. */
export const maxDuration = 300

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(30),
})

/**
 * The mentor endpoint. Stateless by design: the client holds the transcript,
 * and every request rebuilds the CONTEXT block from the same database rows the
 * dashboards render — so the mentor is always talking about the student's
 * current numbers, not a memory of old ones.
 */
export async function POST(request: Request) {
  const student = await ensureStudent()

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: "Malformed chat payload." }, { status: 400 })
  }

  const run = await getLatestRun(student.id)
  if (!run) {
    return Response.json({
      text: "I don't have an analysis to work from yet — upload your resume on the Intake screen first, and I'll have your actual gaps in front of me.",
    })
  }

  const [map, roadmap, recs] = await Promise.all([
    getSkillMap(run.id),
    getRoadmap(student.id),
    getRecommendations(run.id),
  ])

  const context = [
    `Student: ${student.fullName ?? "unknown"} · target role ${map?.roleId} · ${student.weeklyHours} hrs/week available`,
    `Readiness: ${map?.readiness} / 100 · ${map?.openGaps} open gaps of ${map?.gauges.length} tracks`,
    ``,
    `GAUGES (track · proven / required · weeks to close · note)`,
    ...(map?.gauges ?? []).map(
      (g) =>
        `- ${g.name} · ${g.provenLevel.toFixed(1)} / ${g.requiredLevel.toFixed(1)} · ${
          g.status === "open" ? `${g.weeksToClose} wks` : g.status
        } · ${g.note}`
    ),
    ``,
    `ROADMAP (${roadmap?.totalWeeks ?? 0} weeks)`,
    ...(roadmap?.items ?? []).map(
      (i) =>
        `- [${i.status}] W${i.startWeek}–${i.endWeek} ${i.label}: ${i.detail}`
    ),
    ``,
    `RECOMMENDED PROJECTS`,
    ...(recs?.projects ?? []).map(
      (p) => `- ${p.title} (${p.effortWeeks} wks): ${p.rationale}`
    ),
    `CERT VERDICTS`,
    ...(recs?.certs ?? []).map((c) => `- ${c.name}: ${c.verdict} — ${c.rationale}`),
  ].join("\n")

  // Mapped with literal roles: Mastra's message union discriminates on the
  // role literal, and a widened "user" | "assistant" satisfies neither arm.
  const transcript = parsed.data.messages.map((m) =>
    m.role === "user"
      ? { role: "user" as const, content: m.content }
      : { role: "assistant" as const, content: m.content }
  )

  try {
    const result = await mentorAgent.generate(transcript, {
      instructions:
        mentorAgent.getInstructions() + `\n\nCONTEXT\n${context}`,
      maxSteps: 1,
    })
    return Response.json({ text: result.text })
  } catch (err) {
    // The shared free tier rate-limits in bursts; say so honestly.
    const message = err instanceof Error ? err.message : ""
    const throttled = /429|rate|limit/i.test(message)
    return Response.json(
      {
        error: throttled
          ? "The free model tier is saturated right now. Wait a minute and try again."
          : "The mentor couldn't respond. Try again.",
      },
      { status: 502 }
    )
  }
}
