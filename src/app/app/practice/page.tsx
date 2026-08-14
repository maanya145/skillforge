import Link from "next/link"

import { requireAuth } from "@/lib/auth"
import { ensureStudent } from "@/lib/students"
import { getLatestRun } from "@/lib/analysis"
import { getRecommendations } from "@/lib/plan-queries"
import { Button } from "@/components/ui/button"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame, EmptyState } from "@/components/shell/workspace"
import { AppHeading, SubCard } from "@/components/shell/frame"

import { QuestionList } from "./question-list"

const VERDICT: Record<
  string,
  { label: string; variant: "lime" | "alt" | "default" }
> = {
  worth_it: { label: "Worth it", variant: "lime" },
  later: { label: "Later", variant: "alt" },
  skip: { label: "Skip", variant: "default" },
}

export const metadata = { title: "Practice · SkillForge" }

export default async function PracticePage() {
  await requireAuth()
  const student = await ensureStudent()
  const run = await getLatestRun(student.id)
  const recs = run ? await getRecommendations(run.id) : null

  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="Step 04" title="Practice">
        Every recommendation names the gap it closes and what it&rsquo;s worth.
        Nothing is here because it&rsquo;s popular — the scores are weighted gap
        points, and most of the certification list says don&rsquo;t bother. The
        questions are archetypes drawn from publicly shared interview
        experiences, not transcripts.
      </SectionHead>

      <WorkspaceFrame
        current="/app/practice"
        trail={["Workspace"]}
        crumb="Practice"
      >
        {!recs || recs.projects.length + recs.questions.length === 0 ? (
          <EmptyState
            title="Nothing ranked yet"
            action={
              <Button asChild>
                <Link href="/app/intake">Upload a resume</Link>
              </Button>
            }
          >
            Projects, certifications and interview questions are scored against
            your open gaps, so they stay empty until a skill map exists.
          </EmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <AppHeading aside={`${recs.projects.length} ranked`}>
                Projects to build
              </AppHeading>
              <div className="flex flex-col">
                {recs.projects.map((p) => (
                  <div
                    key={p.id}
                    className="border-t border-graphite/70 px-2 py-3 first:border-t-0 hover:bg-white/[0.02]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h4 className="text-sm font-[510] tracking-[-0.01em] text-mist">
                        {p.title}
                      </h4>
                      <span className="font-mono text-xs tabular text-ash">
                        {p.startWeek
                          ? `W${p.startWeek}–${p.endWeek}`
                          : `${p.effortWeeks} wks`}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-fog">{p.summary}</p>
                    <p className="mt-1.5 text-xs text-ash">{p.rationale}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {p.stack.map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                      {p.closesTrackIds.length ? (
                        <Badge variant="tag">
                          <BadgeDot />
                          Closes {p.closesTrackIds.length} gap
                          {p.closesTrackIds.length === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <AppHeading aside="patterns, not transcripts">
                  Interview drill
                </AppHeading>
                <QuestionList
                  questions={recs.questions.map((q) => ({
                    questionId: q.questionId,
                    prompt: q.prompt,
                    topic: q.topic,
                    company: q.company,
                    round: q.round,
                    year: q.year,
                    isGapTrack: q.isGapTrack,
                    coachNote: q.coachNote,
                    outline: q.outline,
                    status: q.status,
                  }))}
                />
              </div>

              <SubCard>
                <AppHeading
                  className="px-0"
                  aside={`${recs.certs.filter((c) => c.verdict === "worth_it").length} worth it`}
                >
                  Certifications
                </AppHeading>
                <div className="flex flex-col">
                  {recs.certs.map((c) => {
                    const v = VERDICT[c.verdict]
                    return (
                      <div
                        key={c.rank}
                        className="flex flex-col gap-1 border-t border-graphite/70 py-2.5 first:border-t-0"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-caption text-mist">
                            {c.name}
                          </span>
                          <Badge variant={v.variant}>
                            {c.verdict === "worth_it" ? <BadgeDot /> : null}
                            {v.label}
                          </Badge>
                        </div>
                        <span className="text-xs text-ash">{c.rationale}</span>
                      </div>
                    )
                  })}
                </div>
              </SubCard>
            </div>
          </div>
        )}
      </WorkspaceFrame>
    </div>
  )
}
