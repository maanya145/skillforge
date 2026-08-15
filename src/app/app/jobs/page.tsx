import Link from "next/link"
import { eq } from "drizzle-orm"
import { ExternalLink } from "lucide-react"

import { requireAuth } from "@/lib/auth"
import { ensureStudent } from "@/lib/students"
import { getLatestRun, getSkillMap } from "@/lib/analysis"
import { getJobBoard, postedAge } from "@/lib/jobs"
import { db, schema } from "@/db"
import { Button } from "@/components/ui/button"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame, EmptyState } from "@/components/shell/workspace"
import { AppHeading, SubCard } from "@/components/shell/frame"

export const metadata = { title: "Job targets · SkillForge" }

const SENIORITY: Record<string, { label: string; variant: "ok" | "alt" | "tag" }> = {
  entry: { label: "entry level", variant: "ok" },
  mid: { label: "mid", variant: "alt" },
  senior: { label: "senior", variant: "tag" },
}

/**
 * What the role you are being measured against looks like in the market.
 *
 * Deliberately not an application list. These are real, current postings from
 * companies' own boards, but almost none of them are roles a final-year
 * student can apply to — campus hiring runs through placement cells, not
 * public ATS boards. The screen says that out loud rather than letting the
 * layout imply otherwise.
 */
export default async function JobsPage() {
  await requireAuth()
  const student = await ensureStudent()
  const run = await getLatestRun(student.id)
  const map = run ? await getSkillMap(run.id) : null

  if (!map) {
    return (
      <Shell>
        <EmptyState
          title="No target role yet"
          action={
            <Button asChild>
              <Link href="/app/intake">Upload a resume</Link>
            </Button>
          }
        >
          Postings are matched to the role your skill map is measured against,
          so this screen needs an analysis first.
        </EmptyState>
      </Shell>
    )
  }

  const [role] = await db
    .select({ name: schema.roles.name, blurb: schema.roles.blurb })
    .from(schema.roles)
    .where(eq(schema.roles.id, map.roleId))

  const board = await getJobBoard(map.roleId)
  const roleName = role?.name ?? map.roleId
  const blocking = map.gauges.filter((g) => g.status === "open").slice(0, 3)

  return (
    <Shell
      tools={
        <Badge variant="tag">
          <BadgeDot />
          {roleName}
        </Badge>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <AppHeading
            aside={`${board.companiesReporting} of ${board.companiesAttempted} boards reporting`}
          >
            {board.postings.length} open {roleName.toLowerCase()} role
            {board.postings.length === 1 ? "" : "s"} in India
          </AppHeading>

          {board.postings.length === 0 ? (
            <p className="px-2 py-6 text-xs text-fog">
              Nothing open for this role at the companies we read right now.
              That is a real answer, not an error &mdash; these boards carry a
              handful of India engineering roles at a time.
            </p>
          ) : (
            <div className="flex flex-col">
              {board.postings.map((job) => {
                const s = SENIORITY[job.seniority]
                return (
                  <a
                    key={job.id}
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="group border-t border-graphite/70 px-2 py-3 first:border-t-0 hover:bg-white/[0.02]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <span className="truncate text-caption text-mist group-hover:text-paper">
                          {job.title}
                        </span>
                        <ExternalLink
                          className="size-3 shrink-0 text-ash opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                      </span>
                      <span className="font-mono text-xs tabular whitespace-nowrap text-ash">
                        {postedAge(job.postedAt)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant={s.variant}>{s.label}</Badge>
                      <span className="ml-auto font-mono text-xs text-ash">
                        {job.company} · {job.location}
                      </span>
                    </div>
                  </a>
                )
              })}
            </div>
          )}

          <p className="mt-3 border-t border-graphite px-2 pt-3 text-xs text-ash">
            Postings come straight from each company&rsquo;s own hiring board,
            so the link is the employer&rsquo;s listing rather than a copy that
            may have gone stale. Anything older than four months is dropped.
          </p>
        </div>

        <aside className="flex flex-col gap-3">
          <SubCard>
            <span className="t-micro">Your distance</span>
            <div className="mt-2 font-mono text-xl tabular text-paper">
              {map.readiness}
              <span className="pl-1 text-xs text-ash">/ 100</span>
            </div>
            <p className="mt-2 text-xs text-fog">
              Measured against the {roleName.toLowerCase()} benchmark &mdash;
              the same bar these postings hire against. {map.openGaps} track
              {map.openGaps === 1 ? "" : "s"} still short.
            </p>
            {blocking.length > 0 ? (
              <div className="mt-3 flex flex-col gap-1.5 border-t border-graphite pt-3">
                {blocking.map((g) => (
                  <div
                    key={g.trackId}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <span className="truncate text-xs text-mist">{g.name}</span>
                    <span className="font-mono text-xs tabular whitespace-nowrap text-ash">
                      {g.provenLevel.toFixed(1)} of {g.requiredLevel.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </SubCard>

          {/*
            The honest caveat, given equal weight to the list rather than set
            in small print under it. Every probe of these boards found the
            same thing, and a student who applies to a Staff Engineer posting
            and hears nothing back deserves to have been told why.
          */}
          <SubCard>
            <span className="t-micro">Read these as targets</span>
            <p className="mt-2 text-xs text-fog">
              {board.entryLevelCount === 0
                ? "None of these are entry level."
                : `${board.entryLevelCount} of these are entry level.`}{" "}
              Public hiring boards carry experienced roles almost exclusively
              &mdash; campus hiring in India runs through your placement cell,
              and off-campus fresher roles through job portals.
            </p>
            <p className="mt-2 text-xs text-fog">
              What they are good for is seeing the bar: this is the work the
              role actually involves, at companies that actually hire for it,
              written by the people who do the hiring.
            </p>
          </SubCard>

          <Button variant="ghost" size="sm" asChild className="self-start">
            <Link href="/app/map">Change target role</Link>
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
      <SectionHead eyebrow="The bar, in the market" title="Job targets">
        Real, current openings for the role you&rsquo;re measured against
        &mdash; pulled from each company&rsquo;s own hiring board. Not a list to
        apply to: it&rsquo;s what the role looks like when someone is actually
        paying for it, and how far you are from that.
      </SectionHead>

      <WorkspaceFrame
        current="/app/jobs"
        trail={["Workspace"]}
        crumb="Job targets"
        tools={tools}
      >
        {children}
      </WorkspaceFrame>
    </div>
  )
}
