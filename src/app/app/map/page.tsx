import Link from "next/link"

import { requireAuth } from "@/lib/auth"
import { ensureStudent } from "@/lib/students"
import { getLatestRun, getSkillMap } from "@/lib/analysis"
import { db, schema } from "@/db"
import { Button } from "@/components/ui/button"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame, EmptyState } from "@/components/shell/workspace"
import { AppHeading, ToolPill, SubCard } from "@/components/shell/frame"
import { GapGauge, GaugeLegend } from "@/components/viz/gap-gauge"
import { getExtractCache, compareRoles } from "@/lib/replan"
import { getShareForRun } from "@/lib/shares"
import { eq } from "drizzle-orm"

import { RoleSwitcher } from "./role-switcher"
import { SharePanel } from "./share-panel"

export const metadata = { title: "Skill map · SkillForge" }

export default async function SkillMapPage() {
  await requireAuth()
  const student = await ensureStudent()

  const run = await getLatestRun(student.id)
  const map = run ? await getSkillMap(run.id) : null

  if (!map) {
    return (
      <Shell>
        <EmptyState
          title="No resume analysed yet"
          action={
            <Button asChild>
              <Link href="/app/intake">Upload a resume</Link>
            </Button>
          }
        >
          Gaps are measured against a versioned benchmark for the role
          you&rsquo;re targeting. Upload a resume and every track appears here
          with a level, a requirement, and a weeks-to-close estimate.
        </EmptyState>
      </Shell>
    )
  }

  const [role] = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.id, map.roleId))


  const blocking = map.gauges.filter((g) => g.status === "open").slice(0, 3)

  // Role comparison from the cached, role-independent evidence. Null for runs
  // that predate the cache; the panel simply doesn't render then.
  const cache = await getExtractCache(map.runId)
  const comparison = cache
    ? await compareRoles(cache, map.roleId, student.weeklyHours)
    : null

  const share = await getShareForRun(student.id, map.runId)

  return (
    <Shell
      tools={
        <>
          <Badge variant="tag">
            <BadgeDot />
            {role?.name ?? map.roleId}
          </Badge>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
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
            <span className="t-micro">Close these first</span>
            <div className="mt-3 flex flex-col gap-3">
              {blocking.length === 0 ? (
                <p className="text-xs text-fog">
                  Every track meets its requirement. Re-run against a harder
                  role to find the next edge.
                </p>
              ) : (
                blocking.map((g) => (
                  <div key={g.trackId} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-mist">{g.name}</span>
                      <span className="font-mono text-xs tabular text-ash">
                        {g.weeksToClose} wk{g.weeksToClose === 1 ? "" : "s"}
                      </span>
                    </div>
                    <span className="text-xs text-ash">{g.note}</span>
                  </div>
                ))
              )}
            </div>
          </SubCard>

          {comparison ? (
            <SubCard>
              <span className="t-micro">If you switched target</span>
              <div className="mt-2">
                <RoleSwitcher roles={comparison} />
              </div>
            </SubCard>
          ) : null}

          <SubCard>
            <span className="t-micro">Share this report</span>
            <div className="mt-2">
              <SharePanel
                initialToken={share?.token ?? null}
                initialShowName={share?.showName ?? true}
                views={share?.viewCount ?? 0}
              />
            </div>
          </SubCard>

          <SubCard>
            <span className="t-micro">How this was measured</span>
            <p className="mt-2 text-xs text-fog">
              Every level here was computed from evidence found on your resume,
              scored against a published benchmark. The model reported what it
              found; it did not choose any of these numbers.
            </p>
            <p className="mt-2 text-xs text-fog">
              The benchmark is public —{" "}
              <Link
                href={`/benchmarks?role=${map.roleId}`}
                className="text-mist underline decoration-graphite underline-offset-2 transition-colors hover:decoration-mist"
              >
                read the rubric it was scored against
              </Link>
              .
            </p>
            <p className="mt-2 font-mono text-xs text-ash">
              analysed {map.computedAt.toISOString().slice(0, 10)}
            </p>
          </SubCard>

          <Button variant="ghost" size="sm" asChild className="self-start">
            <Link href="/app/intake">Re-analyse</Link>
          </Button>
        </aside>
      </div>
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
      <SectionHead eyebrow="Step 02" title="Skill map">
        Each track runs 0&ndash;10. The solid bar is what your resume and
        coursework prove, the notch is what the role asks for, and the hatched
        span between them is the gap.
      </SectionHead>

      <WorkspaceFrame
        current="/app/map"
        trail={["Workspace"]}
        crumb="Skill map"
        tools={tools}
      >
        {children}
      </WorkspaceFrame>
    </div>
  )
}
