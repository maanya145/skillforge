import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { Container, SectionHead } from "@/components/shell/section"
import { SiteNav } from "@/components/shell/site-nav"
import { Wordmark } from "@/components/shell/logo"
import {
  AppFrame,
  AppBar,
  AppBody,
  AppHeading,
  Crumb,
  ToolPill,
  Kbd,
} from "@/components/shell/frame"
import { AppSidebar, WORKSPACE_NAV } from "@/components/shell/app-sidebar"
import { ConsoleHero } from "@/components/shell/console-hero"

/**
 * The hero screenshot's sidebar, derived from the real navigation so the
 * marketing page cannot drift from the product. Only the sample counts are
 * added here.
 */
const HERO_COUNTS: Record<string, string> = {
  "/app/intake": "3",
  "/app/map": "12",
  "/app/roadmap": "14 wks",
  "/app/practice": "9",
  "/app/progress": "71",
}

const HERO_NAV = WORKSPACE_NAV.filter((i) => i.href in HERO_COUNTS).map((i) => ({
  ...i,
  count: HERO_COUNTS[i.href],
}))
import { GapGauge, GaugeLegend } from "@/components/viz/gap-gauge"
import {
  SAMPLE_GAUGES,
  SAMPLE_OPEN_GAPS,
  SAMPLE_READINESS,
  SAMPLE_TOTAL_TRACKS,
} from "@/content/landing-sample"

/** What the benchmark actually covers — checkable, unlike a logo strip. */
const COVERAGE: [string, string][] = [
  ["5", "target roles"],
  ["12", "skill tracks"],
  ["60", "benchmarked requirements"],
  ["4", "rungs per rubric"],
]

const HOW = [
  {
    title: "It reads the resume you already send",
    body: "Not a questionnaire. SkillForge parses the PDF, separates claims from evidence, reads your coursework for corroboration, and cites the page and line of every weak sentence it flags.",
  },
  {
    title: "It measures against a published bar",
    body: "Each skill is scored against a versioned benchmark for the role you're chasing — not against other students, and not against a model's opinion. Ask why a number is what it is and there's a rubric rung and a resume line behind it.",
  },
  {
    title: "It plans backwards from the offer",
    body: "Fourteen weeks, three lanes. Gap work feeds the build; the build becomes what you talk about in the interview. Ordering falls out of which gap blocks which project, so the plan explains itself.",
  },
  {
    title: "It only moves when a gap closes",
    body: "Readiness is the weighted distance between your skills and the role's requirements. Hours logged on their own don't move it. When a track stalls, the dashboard names it.",
  },
]

export default function LandingPage() {
  return (
    <>
      <SiteNav />

      <main className="flex flex-col gap-24 pb-24">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="pt-16">
          <Container className="flex flex-col items-center gap-14">
            {/* The console leads. Its boot menu is the same two doors as the
                CTAs below — upload, or ask the mentor what this is. A faint
                radial glow stages it against the void; pr-10 balances the
                crank's overhang so the assembly reads centred. */}
            <div className="relative pr-10">
              <div
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(208,214,224,0.1)_0%,transparent_65%)] lg:size-[700px]"
              />
              <ConsoleHero />
            </div>

            <div className="flex max-w-[760px] flex-col items-center gap-6 text-center">
              <Badge variant="tag" className="rounded-full px-3 py-1">
                <BadgeDot />
                Built for campus placement season
              </Badge>

              <h1 className="text-heading">
                Measure the gap. Then close it.
              </h1>

              <p className="max-w-[56ch] text-base text-mist">
                SkillForge reads your resume, measures every skill against the
                role you&rsquo;re actually chasing, and returns the shortest
                honest path to ready.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button variant="lime" asChild>
                  <Link href="/sign-up">Analyse your resume</Link>
                </Button>
                <Link
                  href="#measure"
                  className="group inline-flex items-center gap-1.5 text-sm tracking-[-0.011em] text-mist transition-colors hover:text-paper"
                >
                  See what it produces
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </Container>

          {/* Product frame on the atmospheric floor */}
          <Container className="relative mt-28" id="measure">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-2 bottom-[-40px] h-[70%] rounded-xl bg-linear-to-b from-transparent from-10% to-mist/10"
            />
            <AppFrame floating>
              <AppBar>
                <Crumb trail={["Aarav Menon"]}>
                  Skill map
                  <Badge variant="tag" className="ml-2">
                    <BadgeDot />
                    Backend engineer
                  </Badge>
                </Crumb>
                <div className="flex items-center gap-2">
                  <ToolPill className="hidden sm:inline-flex">
                    Backend benchmark 2026.1
                  </ToolPill>
                  <ToolPill className="hidden lg:inline-flex">
                    Sample report
                  </ToolPill>
                  <Kbd>⌘K</Kbd>
                </div>
              </AppBar>

              <div className="grid grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)]">
                <AppSidebar
                  current="/app/map"
                  className="hidden lg:flex"
                  items={HERO_NAV}
                />

                <AppBody>
                  <AppHeading
                    aside={`readiness ${SAMPLE_READINESS} / 100`}
                  >
                    {SAMPLE_TOTAL_TRACKS} tracks measured{" "}
                    <span className="text-fog">
                      · {SAMPLE_OPEN_GAPS} gaps open
                    </span>
                  </AppHeading>

                  <div className="flex flex-col">
                    {SAMPLE_GAUGES.map((g, i) => (
                      <GapGauge key={g.trackId} gauge={g} index={i} />
                    ))}
                  </div>

                  <GaugeLegend />
                </AppBody>
              </div>
            </AppFrame>
          </Container>
        </section>

        {/* ── Coverage ─────────────────────────────────────────────────── */}
        <section id="colleges">
          <Container className="flex flex-col items-center gap-6 text-center">
            <p className="text-caption text-ash">
              Every number is measured against a published benchmark
            </p>
            <div className="flex flex-wrap justify-center gap-x-12 gap-y-4">
              {COVERAGE.map(([n, label]) => (
                <span key={label} className="flex items-baseline gap-2">
                  <span className="font-mono text-body-lg tabular text-mist">
                    {n}
                  </span>
                  <span className="text-body-sm text-fog">{label}</span>
                </span>
              ))}
            </div>
          </Container>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section id="how">
          <Container className="flex flex-col gap-12">
            <SectionHead
              eyebrow="How it works"
              title="Generic advice is the problem, not the product."
            >
              Most platforms recommend the same four courses to everyone.
              SkillForge measures one student against one role and shows its
              working — every number on screen is arithmetic over a published
              benchmark, not a model&rsquo;s guess.
            </SectionHead>

            <div className="grid gap-px overflow-hidden rounded-xl bg-graphite sm:grid-cols-2">
              {HOW.map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col gap-2 bg-card p-6"
                >
                  <h3 className="text-subheading">{item.title}</h3>
                  <p className="text-body-sm text-fog">{item.body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── Closing ──────────────────────────────────────────────────── */}
        <section id="plan">
          <Container>
            <div className="flex flex-col items-start gap-6 rounded-xl bg-card px-12 py-16 shadow-subtle">
              <h2 className="max-w-[16ch] text-heading">
                Find out where you actually stand.
              </h2>
              <p className="max-w-[52ch] text-body-lg text-fog">
                Upload a resume, pick a role, and get a cited, line-by-line
                report. Switching target roles afterwards is instant.
              </p>
              <Button variant="pill" size="lg" asChild>
                <Link href="/sign-up">Upload your resume</Link>
              </Button>
              <p className="text-caption text-ash">
                Free for students. No card, no placement-cell licence required.
              </p>
            </div>
          </Container>
        </section>
      </main>

      <footer className="border-t border-graphite py-8">
        <Container className="flex flex-wrap items-start justify-between gap-8">
          <div className="flex flex-col gap-2">
            <Wordmark className="text-sm" />
            <span className="text-caption text-ash">
              Skill gap analysis for campus placements
            </span>
          </div>
          <FooterCol
            label="Product"
            links={[
              ["Skill map", "#measure"],
              ["How it works", "#how"],
              ["For colleges", "#colleges"],
            ]}
          />
          <FooterCol
            label="Account"
            links={[
              ["Sign in", "/sign-in"],
              ["Get started", "/sign-up"],
            ]}
          />
          <FooterCol
            label="Benchmarks"
            links={[
              ["Read the rubric", "/benchmarks"],
              ["The arithmetic", "/benchmarks#arithmetic"],
            ]}
          />
        </Container>
      </footer>
    </>
  )
}

function FooterCol({
  label,
  links,
}: {
  label: string
  links: [string, string][]
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="t-micro">{label}</span>
      {links.map(([text, href]) => (
        <Link
          key={text}
          href={href}
          className="text-caption text-fog transition-colors hover:text-mist"
        >
          {text}
        </Link>
      ))}
    </div>
  )
}
