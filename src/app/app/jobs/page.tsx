import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { requireAuth } from "@/lib/auth"
import { ensureStudent } from "@/lib/students"
import { listTargetReports, type TargetReport } from "@/lib/jd/target"
import { Button } from "@/components/ui/button"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame } from "@/components/shell/workspace"
import { AppHeading, SubCard } from "@/components/shell/frame"
import { MiniGapBar } from "@/components/viz/charts"
import { cn } from "@/lib/utils"

import { PasteForm, DeleteTarget } from "./jobs-client"

export const metadata = { title: "Job targets · SkillForge" }

const EMPHASIS = {
  core: { label: "core", variant: "ok" as const },
  mentioned: { label: "mentioned", variant: "alt" as const },
  absent: { label: "baseline", variant: "tag" as const },
}

/**
 * "Measure me against this job posting."
 *
 * Keyword matchers answer whether your resume says the right words. This
 * screen answers whether you clear the posting's bar — and in how many weeks.
 * Every requirement cites the JD line that put it there; the levels come from
 * the published benchmark, never from the posting's prose.
 */
export default async function JobsPage() {
  await requireAuth()
  const student = await ensureStudent()
  const reports = await listTargetReports(student.id)
  const measured = reports.length > 0 && reports[0].readiness !== null

  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="Targeting" title="Job targets">
        Paste a real posting and be measured against it — not keyword-matched.
        The posting chooses <em>which tracks matter</em>; the published
        benchmark still sets the bar; your cached evidence is re-scored in one
        pass. Every requirement cites the line that put it there.
      </SectionHead>

      <WorkspaceFrame current="/app/jobs" trail={["Workspace"]} crumb="Job targets">
        <div className="flex flex-col gap-6">
          <SubCard>
            <span className="t-micro">New target</span>
            <div className="mt-3">
              <PasteForm />
            </div>
            {!measured && reports.length === 0 ? (
              <p className="mt-3 border-t border-graphite pt-3 text-xs text-ash">
                Works before your first analysis too — you&rsquo;ll see what the
                posting demands, and measurement switches on once a{" "}
                <Link href="/app/intake" className="text-mist underline decoration-graphite underline-offset-2">
                  resume is analysed
                </Link>
                .
              </p>
            ) : null}
          </SubCard>

          {reports.length > 0 ? (
            <div>
              <AppHeading aside={`${reports.length} saved`}>
                Measured against your evidence
              </AppHeading>
              <div className="flex flex-col gap-3">
                {reports.map((r) => (
                  <Target key={r.id} report={r} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </WorkspaceFrame>
    </div>
  )
}

function Target({ report }: { report: TargetReport }) {
  const cited = report.requirements.filter((r) => r.emphasis !== "absent")
  const baseline = report.requirements.filter((r) => r.emphasis === "absent")

  return (
    <SubCard>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-[510] tracking-[-0.01em] text-paper">
            {report.title}
            {report.company ? (
              <span className="text-fog"> · {report.company}</span>
            ) : null}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-ash">
            baseline: {report.baseRoleName} · {cited.length} requirement
            {cited.length === 1 ? "" : "s"} cited from the posting
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {report.readiness !== null ? (
            <span className="font-mono text-xs tabular whitespace-nowrap text-mist">
              readiness <b className="text-paper">{report.readiness}</b>
              <span className="px-1.5 text-smoke">·</span>
              {report.openGaps} gaps
              <span className="px-1.5 text-smoke">·</span>
              {report.totalWeeks} wks
            </span>
          ) : (
            <Badge variant="tag">not measured yet</Badge>
          )}
          <DeleteTarget targetId={report.id} />
        </div>
      </div>

      <details className="group mt-2">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-fog transition-colors hover:text-mist [&::-webkit-details-marker]:hidden">
          <ChevronRight
            className="size-3 transition-transform group-open:rotate-90"
            aria-hidden
          />
          What this posting asks for
        </summary>

        <div className="mt-2 flex flex-col border-t border-graphite">
          {[...cited, ...baseline].map((req) => {
            const e = EMPHASIS[req.emphasis]
            const g = req.gapResult
            return (
              <div
                key={req.trackId}
                className="border-b border-graphite/60 py-2.5 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="text-caption text-mist">{req.name}</span>
                    <Badge variant={e.variant}>
                      {req.emphasis === "core" ? <BadgeDot /> : null}
                      {e.label}
                    </Badge>
                  </span>
                  <span className="font-mono text-xs tabular whitespace-nowrap text-ash">
                    {req.proven !== null ? (
                      <>
                        you <span className="text-paper">{req.proven.toFixed(1)}</span>
                        <span className="px-1">·</span>
                      </>
                    ) : null}
                    needs <span className="text-mist">{req.requiredLevel.toFixed(1)}</span>
                    {g && g.status === "open" ? (
                      <>
                        <span className="px-1">·</span>
                        {g.weeksToClose} wk{g.weeksToClose === 1 ? "" : "s"}
                      </>
                    ) : null}
                  </span>
                </div>

                {req.proven !== null ? (
                  <MiniGapBar proven={req.proven} required={req.requiredLevel} />
                ) : null}

                {req.quote ? (
                  <p className="mt-1.5 text-xs text-ash">
                    <span className="font-mono">L{req.line}</span>
                    <span className="px-1.5 text-smoke">·</span>
                    <span className={cn("italic")}>&ldquo;{req.quote}&rdquo;</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-ash">
                    Not in the posting — carried at half weight because the{" "}
                    {report.baseRoleName} baseline still expects it.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </details>

      {report.readiness === null ? (
        <p className="mt-3 border-t border-graphite pt-3 text-xs text-fog">
          This is what the posting demands.{" "}
          <Button variant="ghost" size="sm" asChild className="ml-1 align-baseline">
            <Link href="/app/intake">Analyse a resume to be measured</Link>
          </Button>
        </p>
      ) : null}
    </SubCard>
  )
}
