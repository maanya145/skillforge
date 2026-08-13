import Link from "next/link"

import { requireAuth } from "@/lib/auth"
import { ensureStudent } from "@/lib/students"
import { getRoadmap } from "@/lib/plan-queries"
import { Button } from "@/components/ui/button"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { SectionHead, NoteRail, Note } from "@/components/shell/section"
import { WorkspaceFrame, EmptyState } from "@/components/shell/workspace"
import { SubCard } from "@/components/shell/frame"
import { RoadmapGantt } from "@/components/viz/roadmap-gantt"

import { DoneList } from "./done-list"
import { HoursControl } from "./hours-control"

export default async function RoadmapPage() {
  await requireAuth()
  const student = await ensureStudent()
  const roadmap = await getRoadmap(student.id)

  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="Step 03" title="Roadmap">
        Three lanes running in parallel. Gap work feeds the build; the build
        becomes what you talk about in the interview. Ordering falls out of
        which gap blocks which project.
      </SectionHead>

      <WorkspaceFrame
        current="/app/roadmap"
        trail={["Workspace"]}
        crumb="Roadmap"
        tools={
          roadmap ? (
            <>
              <HoursControl current={roadmap.weeklyHours} />
              <Badge variant="ok">
                <BadgeDot />
                {roadmap.totalWeeks} weeks
              </Badge>
            </>
          ) : undefined
        }
      >
        {!roadmap ? (
          <EmptyState
            title="Nothing to schedule yet"
            action={
              <Button asChild>
                <Link href="/app/intake">Upload a resume</Link>
              </Button>
            }
          >
            The scheduler needs a measured skill map before it can order
            anything. Analyse a resume and the plan builds itself from your open
            gaps and their prerequisites.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            <RoadmapGantt
              totalWeeks={roadmap.totalWeeks}
              items={roadmap.items.map((i) => ({
                id: i.id,
                lane: i.lane,
                kind: i.kind,
                label: i.label,
                detail: i.detail,
                startWeek: i.startWeek,
                endWeek: i.endWeek,
                status: i.status,
              }))}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <SubCard>
                <span className="t-micro">Why this order</span>
                <NoteRail className="mt-3 border-t-0 pt-0">
                  {roadmap.notes.map((n) => (
                    <Note key={n.id} k={`W${n.week}`}>
                      <strong className="font-[510] text-mist">
                        {n.headline}
                      </strong>{" "}
                      {n.body}
                    </Note>
                  ))}
                </NoteRail>
              </SubCard>

              <SubCard>
                <span className="t-micro">Mark work done</span>
                <div className="mt-3">
                  <DoneList
                    items={roadmap.items
                      .filter((i) => i.kind === "gap" || i.kind === "project")
                      .map((i) => ({
                        id: i.id,
                        label: i.label,
                        status: i.status,
                        startWeek: i.startWeek,
                        endWeek: i.endWeek,
                      }))}
                  />
                </div>
                <p className="mt-3 text-xs text-ash">
                  Completing a gap item closes that gap and moves readiness —
                  the same arithmetic the analysis used, replayed.
                </p>
              </SubCard>
            </div>
          </div>
        )}
      </WorkspaceFrame>
    </div>
  )
}
