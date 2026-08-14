import Link from "next/link"
import type { Metadata } from "next"

import { listRoles, getRoleBenchmark } from "@/lib/benchmarks"
import { EVIDENCE_WEIGHTS } from "@/lib/scoring/level"
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
                    <ToolPill className="hidden sm:inline-flex">
                      {benchmark.sourceNote}
                    </ToolPill>
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

              <div id="arithmetic" className="grid scroll-mt-20 gap-4 lg:grid-cols-2">
                <Formulas />
                <EvidenceWeights />
              </div>

              <p className="text-xs text-ash">
                Benchmark {benchmark.version} · {benchmark.sourceNote}. These
                rows are seeded and version-controlled; a change to any of them
                is a change to the code, reviewable in the repository&rsquo;s
                history.
              </p>
            </>
          )}
        </Container>
      </main>
    </>
  )
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
    ["Named on the resume", `+${w.mentioned.toFixed(1)}`, "nothing behind it"],
    [
      "Each project using it",
      `+${w.perProject.toFixed(1)}`,
      `up to ${w.maxProjects}`,
    ],
    [
      "Each one that shipped",
      `+${w.perShippedProject.toFixed(1)}`,
      `up to ${w.maxShippedProjects}, on top`,
    ],
    [
      "A measured outcome",
      `+${w.quantifiedOutcome.toFixed(1)}`,
      "the strongest cheap signal",
    ],
    ["Tests exist", `+${w.tests.toFixed(1)}`, "rare in student work"],
    ["Public repository", `+${w.publicRepo.toFixed(1)}`, "readable by anyone"],
    [
      "Internship months",
      `+${w.perInternshipMonth.toFixed(2)}`,
      `each, up to ${w.maxInternshipMonths}`,
    ],
    [
      "Coursework grade",
      `+${w.coursework.A.toFixed(1)} / ${w.coursework.B.toFixed(1)} / ${w.coursework.C.toFixed(1)}`,
      "A / B / C — confirms, never establishes",
    ],
    ["Competition use", `+${w.competition.toFixed(1)}`, "under time pressure"],
    [
      "Years claimed",
      `+${w.perYearClaimed.toFixed(1)}`,
      `each, up to ${w.maxYearsClaimed} — self-reported, so light`,
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
