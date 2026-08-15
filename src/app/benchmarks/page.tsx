import Link from "next/link"
import type { Metadata } from "next"

import { listRoles, getRoleBenchmark, type BenchmarkRow } from "@/lib/benchmarks"
import { EVIDENCE_WEIGHTS, provenLevel } from "@/lib/scoring/level"
import type { EvidenceSignals } from "@/lib/scoring/types"
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
import { EmptyState } from "@/components/shell/workspace"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Benchmarks · SkillForge",
  description:
    "The published rubric every SkillForge level is scored against — required levels, weights, hours per level and the evidence ladder for each track.",
}

/**
 * The benchmark, in public.
 *
 * The product's central claim is that no number on a student's screen was
 * invented by a language model. That claim is only checkable if the ruler is
 * readable, so this page publishes it in full: the required level for every
 * track, what it is weighted, how many study hours move it, the ladder the
 * model is shown, and the arithmetic applied on top.
 *
 * No auth — a judge, a recruiter or a student deciding whether to sign up all
 * need to be able to audit this before they have an account.
 */
export default async function BenchmarksPage({
  searchParams,
}: PageProps<"/benchmarks">) {
  const roles = await listRoles()
  const { role: requested } = await searchParams
  const activeId =
    (typeof requested === "string" &&
      roles.find((r) => r.id === requested)?.id) ||
    roles[0]?.id

  const benchmark = activeId ? await getRoleBenchmark(activeId) : null

  return (
    <>
      <PublicBar />
      <main className="py-12">
        <Container className="flex flex-col gap-8">
          <SectionHead eyebrow="The ruler" title="Benchmarks">
            Every level, gap and week in SkillForge is arithmetic over the rows
            below. The model reads a resume and reports what it found; it never
            picks a number. This is the ruler it is measured against &mdash;
            published so you can disagree with it specifically.
          </SectionHead>

          {!benchmark ? (
            <EmptyState title="No benchmarks seeded yet">
              Run <code className="font-mono text-mist">npm run db:seed</code> to
              load the roles, tracks and benchmark rows.
            </EmptyState>
          ) : (
            <>
              {/* Role selector — links, not state, so every role is a URL a
                  judge can be sent directly. */}
              <nav aria-label="Roles" className="flex flex-wrap gap-2">
                {roles.map((r) => {
                  const active = r.id === benchmark.role.id
                  return (
                    <Link
                      key={r.id}
                      href={`/benchmarks?role=${r.id}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs transition-colors",
                        active
                          ? "bg-paper text-void"
                          : "bg-white/5 text-fog hover:text-mist"
                      )}
                    >
                      {r.name}
                      <span
                        className={cn(
                          "pl-2 font-mono",
                          active ? "text-void/60" : "text-ash"
                        )}
                      >
                        {r.trackCount}
                      </span>
                    </Link>
                  )
                })}
              </nav>

              <AppFrame>
                <AppBar>
                  <Crumb trail={["Benchmarks"]}>{benchmark.role.name}</Crumb>
                  <div className="flex items-center gap-2">
                    <Badge variant="tag">
                      <BadgeDot />v{benchmark.version}
                    </Badge>
                  </div>
                </AppBar>

                <div className="p-4">
                  <AppHeading
                    aside={`${benchmark.rows.length} tracks · ${benchmark.rows.filter((r) => r.isBlocking).length} blocking`}
                  >
                    {benchmark.role.blurb}
                  </AppHeading>

                  <div className="flex flex-col">
                    {benchmark.rows.map((row) => (
                      <details
                        key={row.trackId}
                        className="group border-t border-graphite/70 px-2 py-3 first:border-t-0"
                      >
                        <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 [&::-webkit-details-marker]:hidden">
                          <span className="flex min-w-0 items-baseline gap-2">
                            <span className="text-caption text-mist">
                              {row.name}
                            </span>
                            {row.isBlocking ? (
                              <Badge variant="err">blocking</Badge>
                            ) : null}
                            <span className="truncate text-xs text-ash group-open:hidden">
                              {row.description}
                            </span>
                          </span>
                          <span className="font-mono text-xs tabular whitespace-nowrap text-ash">
                            needs{" "}
                            <span className="text-paper">
                              {row.requiredLevel.toFixed(1)}
                            </span>
                            <span className="px-1.5">·</span>×
                            {row.weight.toFixed(1)}
                            <span className="px-1.5">·</span>
                            {row.hoursPerLevel}h / level
                          </span>
                        </summary>

                        <div className="mt-3 grid gap-4 pl-1 lg:grid-cols-[minmax(0,1fr)_280px]">
                          <div>
                            <span className="t-micro">The ladder</span>
                            <ol className="mt-2 flex flex-col">
                              {row.rubric.map((rung) => (
                                <li
                                  key={rung.level}
                                  className={cn(
                                    "flex items-baseline gap-3 border-t border-graphite/50 py-1.5 first:border-t-0",
                                    rung.level >= row.requiredLevel &&
                                      "text-paper"
                                  )}
                                >
                                  <span className="w-6 shrink-0 font-mono text-xs tabular text-ash">
                                    {rung.level}
                                  </span>
                                  <span className="flex-1 text-body-sm text-mist">
                                    {rung.label}
                                    <span className="block text-xs text-ash">
                                      {rung.evidence}
                                    </span>
                                  </span>
                                </li>
                              ))}
                            </ol>
                          </div>

                          <aside className="flex flex-col gap-3">
                            <SubCard>
                              <span className="t-micro">
                                Why this level
                              </span>
                              <p className="mt-2 text-xs text-fog">
                                {row.rationale}
                              </p>
                            </SubCard>
                            {row.requires.length > 0 ? (
                              <SubCard>
                                <span className="t-micro">Comes after</span>
                                <p className="mt-2 text-xs text-fog">
                                  {row.requires.join(", ")} — the scheduler
                                  will not place this earlier.
                                </p>
                              </SubCard>
                            ) : null}
                          </aside>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              </AppFrame>

              <HowMeasured row={benchmark.rows[0]} />

              <div id="arithmetic" className="grid scroll-mt-20 gap-4 lg:grid-cols-2">
                <Formulas />
                <EvidenceWeights />
              </div>
            </>
          )}
        </Container>
      </main>
    </>
  )
}

/**
 * The measurement, walked through end to end — with a worked example that is
 * COMPUTED AT RENDER TIME by the same `provenLevel` function the analysis
 * runs. Not an illustration of the arithmetic; the arithmetic. Edit a weight
 * in `src/lib/scoring/level.ts` and this section changes with it.
 */
const EXAMPLE_SIGNALS: EvidenceSignals = {
  mentionedOnResume: true,
  projectCount: 2,
  shippedProjectCount: 0,
  hasQuantifiedOutcome: false,
  hasTests: false,
  hasPublicRepo: true,
  internshipMonths: 0,
  courseworkGrade: "B",
  competitionUse: false,
  yearsClaimed: 0,
}

/** The demo student's default weekly budget, used to turn a gap into weeks. */
const EXAMPLE_WEEKLY_HOURS = 9

function HowMeasured({ row }: { row: BenchmarkRow }) {
  const result = provenLevel(EXAMPLE_SIGNALS, row.rubric)
  const gap = Math.max(0, Math.round((row.requiredLevel - result.level) * 10) / 10)
  const weeks = gap === 0 ? 0 : Math.ceil((gap * row.hoursPerLevel) / EXAMPLE_WEEKLY_HOURS)
  const rung = row.rubric.find((r) => r.level === result.rungHit)

  const steps: [string, string][] = [
    [
      "Extract",
      "The model reads the resume once and reports evidence — booleans and counts like “two projects use this, neither shipped, no tests”. It is never asked for a score, and every flagged line must cite a page and line that really contains it.",
    ],
    [
      "Weigh",
      "Code sums what that evidence is worth using the fixed table below, then clamps to 0–10. The weights encode an opinion worth saying out loud: a shipped thing beats a built thing, a measured outcome beats both, and a bare claim is worth almost nothing.",
    ],
    [
      "Snap",
      "The number is anchored to the track's human-written ladder — the highest rung the evidence actually reaches. That is why a level can always be explained in words, not just digits.",
    ],
    [
      "Compare",
      "The role's benchmark sets the required level and its weight. gap = required − proven; weeks-to-close = gap × hours-per-level ÷ your weekly hours. Readiness is the weighted shortfall across all tracks, out of 100.",
    ],
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AppFrame>
        <AppBar>
          <Crumb>How a level is measured</Crumb>
        </AppBar>
        <div className="flex flex-col p-4">
          {steps.map(([name, body], i) => (
            <div
              key={name}
              className="flex gap-3 border-t border-graphite/70 py-3 first:border-t-0 first:pt-1 last:pb-1"
            >
              <span className="w-5 shrink-0 pt-px font-mono text-xs tabular text-ash">
                {i + 1}
              </span>
              <div className="min-w-0">
                <span className="text-caption text-mist">{name}</span>
                <p className="mt-1 text-xs leading-relaxed text-fog">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </AppFrame>

      <AppFrame>
        <AppBar>
          <Crumb trail={["Worked example"]}>{row.name}</Crumb>
          <ToolPill className="hidden sm:inline-flex">
            computed live by the real scorer
          </ToolPill>
        </AppBar>
        <div className="flex flex-col p-4">
          <p className="px-1 pb-2 text-xs text-fog">
            A student whose resume shows: the skill named, two projects using
            it (neither shipped), a public repository, and a B in the related
            coursework. `provenLevel()` scores that — at render time, on this
            page — as:
          </p>
          <dl className="flex flex-col">
            {result.breakdown.map((line) => (
              <div
                key={line.label}
                className="flex items-baseline justify-between gap-3 border-t border-graphite/70 px-1 py-1.5 first:border-t-0"
              >
                <dt className="text-xs text-mist">{line.label}</dt>
                <dd className="font-mono text-xs tabular text-paper">
                  +{line.points.toFixed(1)}
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 border-t border-graphite px-1 pt-2 pb-1">
              <dt className="text-xs text-mist">
                Proven level
                <span className="block text-xs text-ash">
                  {rung
                    ? `reaches the “${rung.label}” rung`
                    : "below the ladder's first rung"}
                </span>
              </dt>
              <dd className="font-mono text-sm tabular text-paper">
                {result.level.toFixed(1)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 px-1 py-1.5">
              <dt className="text-xs text-fog">
                {benchmarkLabel(row)}
              </dt>
              <dd className="font-mono text-xs tabular text-mist">
                {row.requiredLevel.toFixed(1)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-graphite/70 px-1 py-1.5">
              <dt className="text-xs text-fog">
                Gap, and weeks to close at {EXAMPLE_WEEKLY_HOURS} hrs/week
              </dt>
              <dd className="font-mono text-xs tabular text-mist">
                {gap.toFixed(1)} · {weeks} wk{weeks === 1 ? "" : "s"}
              </dd>
            </div>
          </dl>
          <p className="mt-2 border-t border-graphite px-1 pt-3 text-xs text-ash">
            Nothing above came from a template — this example runs through the
            same exported function the analysis uses, so it cannot drift from
            the real scoring.
          </p>
        </div>
      </AppFrame>
    </div>
  )
}

function benchmarkLabel(row: BenchmarkRow) {
  return `What ${row.name} requires for this role`
}

/** The four formulas that turn a benchmark row into what a student sees. */
function Formulas() {
  const rows: [string, string][] = [
    ["gap", "max(0, required − proven)"],
    ["weeksToClose", "ceil(gap × hoursPerLevel ÷ weeklyHours)"],
    ["readiness", "100 × (1 − Σ wᵢ·gapᵢ ÷ Σ wᵢ·requiredᵢ)"],
    ["status", "proven ≥ required ? met : open"],
  ]
  return (
    <AppFrame>
      <AppBar>
        <Crumb>The arithmetic</Crumb>
      </AppBar>
      <div className="flex flex-col p-4">
        {rows.map(([name, formula]) => (
          <div
            key={name}
            className="flex flex-col gap-1 border-t border-graphite/70 py-2.5 first:border-t-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <span className="font-mono text-xs text-mist">{name}</span>
            <span className="font-mono text-xs text-ash">{formula}</span>
          </div>
        ))}
        <p className="mt-3 border-t border-graphite pt-3 text-xs text-fog">
          Four lines of TypeScript, applied identically to every student and
          every role. Switching your target role re-runs only these — which is
          why it takes milliseconds and costs nothing.
        </p>
      </div>
    </AppFrame>
  )
}

/**
 * The evidence table. `EVIDENCE_WEIGHTS` is exported from the scorer precisely
 * so it can be rendered here rather than paraphrased.
 */
function EvidenceWeights() {
  const w = EVIDENCE_WEIGHTS
  const rows: [string, string, string][] = [
    [
      "Named on the resume",
      `+${w.mentioned.toFixed(1)}`,
      "a claim with no artefact behind it — deliberately worth one point of ten",
    ],
    [
      "Each project using it",
      `+${w.perProject.toFixed(1)}`,
      `something was actually built with the skill · counts up to ${w.maxProjects}`,
    ],
    [
      "Each one that shipped",
      `+${w.perShippedProject.toFixed(1)}`,
      `deployed where someone else could use it · up to ${w.maxShippedProjects}, on top of the project point`,
    ],
    [
      "A measured outcome",
      `+${w.quantifiedOutcome.toFixed(1)}`,
      "a before/after number — the strongest cheap signal that the work was real",
    ],
    [
      "Tests exist",
      `+${w.tests.toFixed(1)}`,
      "a test suite is rare enough in student work to earn nearly a full point",
    ],
    [
      "Public repository",
      `+${w.publicRepo.toFixed(1)}`,
      "the code is readable by anyone, so every other claim becomes auditable",
    ],
    [
      "Internship months",
      `+${w.perInternshipMonth.toFixed(2)}`,
      `professional use, per month · capped at ${w.maxInternshipMonths} so tenure can't outweigh built work`,
    ],
    [
      "Coursework grade",
      `+${w.coursework.A.toFixed(1)} / ${w.coursework.B.toFixed(1)} / ${w.coursework.C.toFixed(1)}`,
      "A / B / C — corroborates other evidence; can confirm a level, never establish one",
    ],
    [
      "Competition use",
      `+${w.competition.toFixed(1)}`,
      "used under time pressure, which filters familiarity from copy-paste",
    ],
    [
      "Years claimed",
      `+${w.perYearClaimed.toFixed(1)}`,
      `self-reported and unverifiable, so weighted lightly · up to ${w.maxYearsClaimed}`,
    ],
  ]

  return (
    <AppFrame>
      <AppBar>
        <Crumb>What evidence is worth</Crumb>
      </AppBar>
      <div className="flex flex-col p-4">
        {rows.map(([label, points, note]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 border-t border-graphite/70 py-2 first:border-t-0"
          >
            <span className="min-w-0">
              <span className="text-xs text-mist">{label}</span>
              <span className="block text-xs text-ash">{note}</span>
            </span>
            <span className="font-mono text-xs tabular whitespace-nowrap text-paper">
              {points}
            </span>
          </div>
        ))}
        <p className="mt-3 border-t border-graphite pt-3 text-xs text-fog">
          Summed, clamped to 0&ndash;10, then snapped to the nearest rung of the
          track&rsquo;s ladder. Adding evidence can never lower a level.
        </p>
      </div>
    </AppFrame>
  )
}
