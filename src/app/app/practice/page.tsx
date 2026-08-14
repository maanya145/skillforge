import Link from "next/link"

import { requireAuth } from "@/lib/auth"
import { ensureStudent } from "@/lib/students"
import { getLatestRun } from "@/lib/analysis"
import { getRecommendations } from "@/lib/plan-queries"
import { getDiscoveries } from "@/lib/discovery/discover"
import { getCertInputs } from "@/lib/cert-artifact"
import { rankCerts, type CertVerdict } from "@/lib/ranking/rank"
import { ArrowRight } from "lucide-react"

/** Preview badges only — the full verdict styling lives in the artifact. */
const CERT_VARIANT: Record<CertVerdict, "ok" | "alt" | "err"> = {
  worth_it: "ok",
  later: "alt",
  skip: "err",
}
import { db, schema } from "@/db"
import { FoundForYou } from "./found-for-you"
import { Button } from "@/components/ui/button"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame, EmptyState } from "@/components/shell/workspace"
import { AppHeading, SubCard } from "@/components/shell/frame"

import { QuestionList } from "./question-list"

export const metadata = { title: "Practice · SkillForge" }

export default async function PracticePage() {
  await requireAuth()
  const student = await ensureStudent()
  const run = await getLatestRun(student.id)
  const recs = run ? await getRecommendations(run.id) : null

  const discoveries = run ? await getDiscoveries(student.id, run.id) : []
  // The preview is scored server-side at the default (no budget), so the card
  // is meaningful before any JavaScript runs.
  const certInputs = run ? await getCertInputs(run.id) : null
  const certPreview = certInputs
    ? (() => {
        const ranked = rankCerts(
          certInputs.catalog,
          certInputs.gaps,
          new Set(certInputs.coveredTrackIds),
          certInputs.trackNames
        )
        return {
          total: ranked.length,
          worthIt: ranked.filter((c) => c.verdict === "worth_it").length,
          skipped: ranked.filter((c) => c.verdict === "skip").length,
          top: ranked.slice(0, 3),
        }
      })()
    : null
  const tracks = await db
    .select({ id: schema.skillTracks.id, name: schema.skillTracks.name })
    .from(schema.skillTracks)
  const trackNames = Object.fromEntries(tracks.map((t) => [t.id, t.name]))

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

              {/* The artifact's preview card. The decision itself lives on its
                  own surface — this is the handle, not the tool. */}
              {certPreview ? (
                <SubCard className="flex flex-col gap-3">
                  <AppHeading
                    className="px-0"
                    aside={`${certPreview.worthIt} of ${certPreview.total} worth it`}
                  >
                    Certifications
                  </AppHeading>
                  <p className="text-xs text-fog">
                    {certPreview.skipped === certPreview.total
                      ? "Every one of these says don't bother against your current gaps."
                      : `${certPreview.skipped} of ${certPreview.total} say don't bother.`}{" "}
                    Set a budget and the verdicts re-decide live.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {certPreview.top.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <span className="truncate text-xs text-mist">
                          {c.name}
                        </span>
                        <Badge variant={CERT_VARIANT[c.verdict]}>
                          {c.verdict === "worth_it" ? <BadgeDot /> : null}
                          {c.verdict.replace("_", " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" asChild className="self-start">
                    <Link href="/app/certifications">
                      Weigh them up
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </SubCard>
              ) : null}
            </div>
          </div>
        )}

        {run ? (
          <div className="mt-6 border-t border-graphite pt-4">
            <FoundForYou items={discoveries} trackNames={trackNames} />
          </div>
        ) : null}
      </WorkspaceFrame>
    </div>
  )
}
