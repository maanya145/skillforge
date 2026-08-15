import Link from "next/link"
import { after } from "next/server"
import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { getSharedReport, recordShareView } from "@/lib/shares"
import { Container, SectionHead } from "@/components/shell/section"
import { PublicBar } from "@/components/shell/public-bar"
import {
  AppFrame,
  AppBar,
  AppHeading,
  Crumb,
  SubCard,
  ToolPill,
} from "@/components/shell/frame"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { GapGauge, GaugeLegend } from "@/components/viz/gap-gauge"

/**
 * A shared report is unlisted, not secret — but it carries someone's assessed
 * weaknesses, so it must never be indexed, cached by a CDN, or summarised into
 * a search result.
 */
export const metadata: Metadata = {
  title: "Skill report · SkillForge",
  robots: { index: false, follow: false, nocache: true },
}

export default async function SharedReportPage({
  params,
}: PageProps<"/r/[token]">) {
  const { token } = await params
  const report = await getSharedReport(token)

  // Revoked, unknown and malformed all render the same 404. Distinguishing them
  // would turn this route into an oracle for which tokens ever existed.
  if (!report) notFound()

  // After the response, so the counter never sits between a recruiter and the
  // page they clicked.
  after(() => recordShareView(token))

  const { map, roleName, roleBlurb, benchmarkVersion } = report
  const blocking = map.gauges.filter((g) => g.status === "open").slice(0, 3)
  const met = map.gauges.length - map.openGaps

  return (
    <>
      <PublicBar />
      <main className="py-12">
        <Container className="flex flex-col gap-8">
          <SectionHead
            eyebrow="Shared report"
            title={
              report.studentName
                ? `${report.studentName} — ${roleName}`
                : `Candidate readiness — ${roleName}`
            }
          >
            {roleBlurb ||
              "Every level below was computed from evidence found on a resume and scored against a published benchmark."}
          </SectionHead>

          <AppFrame>
            <AppBar>
              <Crumb trail={["Report"]}>Skill map</Crumb>
              <div className="flex items-center gap-2">
                <Badge variant="tag">
                  <BadgeDot />
                  {roleName}
                </Badge>
              </div>
            </AppBar>

            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <AppHeading aside={`readiness ${map.readiness} / 100`}>
                  {map.gauges.length} tracks measured{" "}
                  <span className="text-fog">· {map.openGaps} gaps open</span>
                </AppHeading>

                <div className="flex flex-col">
                  {map.gauges.map((g, i) => (
                    <GapGauge key={g.trackId} gauge={g} index={i} />
                  ))}
                </div>

                <GaugeLegend />
              </div>

              <aside className="flex flex-col gap-3">
                <SubCard>
                  <span className="t-micro">At a glance</span>
                  <dl className="mt-3 flex flex-col gap-2">
                    <Stat label="Readiness" value={`${map.readiness} / 100`} />
                    <Stat label="Tracks at or above bar" value={`${met}`} />
                    <Stat label="Open gaps" value={`${map.openGaps}`} />
                    <Stat
                      label="Study budget"
                      value={`${report.weeklyHours} hrs/wk`}
                    />
                  </dl>
                </SubCard>

                {blocking.length > 0 ? (
                  <SubCard>
                    <span className="t-micro">Working on</span>
                    <div className="mt-3 flex flex-col gap-3">
                      {blocking.map((g) => (
                        <div key={g.trackId} className="flex flex-col gap-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs text-mist">{g.name}</span>
                            <span className="font-mono text-xs tabular text-ash">
                              {g.weeksToClose} wk
                              {g.weeksToClose === 1 ? "" : "s"}
                            </span>
                          </div>
                          <span className="text-xs text-ash">{g.note}</span>
                        </div>
                      ))}
                    </div>
                  </SubCard>
                ) : null}

                <SubCard>
                  <span className="t-micro">How to read this</span>
                  <p className="mt-2 text-xs text-fog">
                    No number here was written by a language model. Levels come
                    from evidence on the resume, scored against a versioned
                    benchmark; gaps and weeks are arithmetic over that.
                  </p>
                  <p className="mt-2 text-xs text-fog">
                    <Link
                      href={`/benchmarks?role=${map.roleId}`}
                      className="text-mist underline decoration-graphite underline-offset-2 transition-colors hover:decoration-mist"
                    >
                      Read the benchmark
                    </Link>{" "}
                    this was measured against.
                  </p>
                  <p className="mt-2 font-mono text-xs text-ash">
                    benchmark {benchmarkVersion} · analysed{" "}
                    {map.computedAt.toISOString().slice(0, 10)}
                  </p>
                </SubCard>
              </aside>
            </div>
          </AppFrame>

          <p className="text-xs text-ash">
            This is a read-only snapshot shared by the candidate. It does not
            include their resume, the quoted evidence behind each level, or any
            conversation with the mentor.
          </p>
        </Container>
      </main>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-fog">{label}</dt>
      <dd className="font-mono text-xs tabular text-mist">{value}</dd>
    </div>
  )
}
