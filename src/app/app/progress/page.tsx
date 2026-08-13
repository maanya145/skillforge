import Link from "next/link"
import { format } from "date-fns"

import { requireAuth } from "@/lib/auth"
import { ensureStudent } from "@/lib/students"
import { getLatestRun, getSkillMap } from "@/lib/analysis"
import { getProgress } from "@/lib/plan-queries"
import { Button } from "@/components/ui/button"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame, EmptyState } from "@/components/shell/workspace"
import { AppHeading, SubCard } from "@/components/shell/frame"
import {
  ReadinessSparkline,
  StudyHeatmap,
  MiniGapBar,
} from "@/components/viz/charts"
import { StudyForm } from "./study-form"

/** Median offer threshold at the target companies — the dashed line. */
const TARGET = 78

export default async function ProgressPage() {
  await requireAuth()
  const student = await ensureStudent()
  const run = await getLatestRun(student.id)
  const map = run ? await getSkillMap(run.id) : null

  if (!run || !map) {
    return (
      <Shell>
        <EmptyState
          title="No readiness history yet"
          action={
            <Button asChild>
              <Link href="/app/intake">Upload a resume</Link>
            </Button>
          }
        >
          The first analysis writes the first snapshot. After that this screen
          tracks how each track moved, and which ones stalled.
        </EmptyState>
      </Shell>
    )
  }

  const { snapshots, log, events } = await getProgress(student.id, map.roleId)
  const spark = snapshots.map((s) => s.readiness)
  const labels =
    snapshots.length > 1
      ? [
          format(new Date(snapshots[0].capturedOn), "d MMM"),
          format(
            new Date(snapshots[Math.floor(snapshots.length / 2)].capturedOn),
            "d MMM"
          ),
          format(
            new Date(snapshots[snapshots.length - 1].capturedOn),
            "d MMM"
          ),
        ]
      : undefined

  const closing = map.gauges.filter((g) => g.status === "open").slice(0, 4)
  const activeDays = log.filter((d) => d.level > 0).length

  return (
    <Shell
      tools={
        <Badge variant={map.readiness >= TARGET ? "ok" : "tag"}>
          <BadgeDot />
          {map.readiness >= TARGET ? "At threshold" : `Target ${TARGET}`}
        </Badge>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <SubCard className="flex flex-col items-center justify-center gap-1 py-6 text-center">
          <span className="t-micro">Readiness</span>
          <span className="text-heading-lg tabular text-paper">
            {map.readiness}
          </span>
          <span className="font-mono text-xs tabular text-ash">
            / 100
            {snapshots.length > 1
              ? ` · was ${snapshots[0].readiness} at the start`
              : ""}
          </span>
          <p className="mt-2 max-w-[24ch] text-xs text-fog">
            {TARGET} is the median offer threshold at your target companies.
          </p>
        </SubCard>

        <SubCard>
          <AppHeading className="px-0" aside={`target ${TARGET}`}>
            Readiness trend
          </AppHeading>
          {spark.length > 0 ? (
            <ReadinessSparkline points={spark} target={TARGET} labels={labels} />
          ) : (
            <p className="text-xs text-ash">No snapshots yet.</p>
          )}
        </SubCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SubCard>
          <AppHeading className="px-0" aside={`${closing.length} open`}>
            Gap closure
          </AppHeading>
          <div className="flex flex-col">
            {closing.map((g) => (
              <div
                key={g.trackId}
                className="border-t border-graphite/70 py-2.5 first:border-t-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-caption text-mist">{g.name}</span>
                  <span className="font-mono text-xs tabular text-ash">
                    {g.provenLevel.toFixed(1)} of {g.requiredLevel.toFixed(1)}
                  </span>
                </div>
                <MiniGapBar proven={g.provenLevel} required={g.requiredLevel} />
              </div>
            ))}
          </div>
        </SubCard>

        <SubCard>
          <AppHeading className="px-0">What moved the needle</AppHeading>
          {events.length === 0 ? (
            <p className="text-xs text-ash">
              Nothing yet. Readiness only moves when a gap closes — mark roadmap
              items done, or log study sessions to build the habit trail.
            </p>
          ) : (
            <div className="flex flex-col">
              {events.map((e) => (
                <div
                  key={e.id}
                  className="flex gap-3 border-t border-graphite/70 py-2.5 first:border-t-0"
                >
                  <span
                    className={
                      e.levelDelta > 0
                        ? "w-11 shrink-0 text-right font-mono text-xs tabular text-pulse-green"
                        : "w-11 shrink-0 text-right font-mono text-xs tabular text-ash"
                    }
                  >
                    {e.levelDelta > 0 ? `+${e.levelDelta.toFixed(1)}` : "0.0"}
                  </span>
                  <p className="text-xs text-fog">
                    <strong className="font-[510] text-mist">
                      {e.headline}
                    </strong>
                    {e.body ? <> {e.body}</> : null}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SubCard>
      </div>

      <SubCard>
        <AppHeading
          className="px-0"
          aside={`${activeDays} active days in 26 weeks`}
        >
          Study log
        </AppHeading>
        <StudyHeatmap
          days={log.map((d) => ({ day: d.day, level: d.level }))}
        />
        <StudyForm />
      </SubCard>
    </Shell>
  )
}

function Shell({
  children,
  tools,
}: {
  children: React.ReactNode
  tools?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="Step 05" title="Progress">
        Readiness is the weighted distance between your skills and the
        role&rsquo;s requirements. It only moves when a gap closes — hours
        logged on their own don&rsquo;t count, and that&rsquo;s the point.
      </SectionHead>

      <WorkspaceFrame
        current="/app/progress"
        trail={["Workspace"]}
        crumb="Progress"
        tools={tools}
      >
        <div className="flex flex-col gap-4">{children}</div>
      </WorkspaceFrame>
    </div>
  )
}
