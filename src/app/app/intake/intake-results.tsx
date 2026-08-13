import { getIntakeDetail } from "@/lib/plan-queries"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { AppHeading, SubCard } from "@/components/shell/frame"
import { cn } from "@/lib/utils"

const KIND_LABEL: Record<string, string> = {
  project: "Project",
  internship: "Internship",
  award: "Award",
  coursework: "Coursework",
  publication: "Publication",
}

/** What the latest analysis found — chips, evidence, and the flagged lines. */
export async function IntakeResults({ runId }: { runId: string }) {
  const { skills, evidence, flags, resume } = await getIntakeDetail(runId)
  if (skills.length + evidence.length + flags.length === 0) return null

  return (
    <div className="flex flex-col gap-4 border-t border-graphite pt-4">
      <AppHeading
        className="px-0"
        aside={
          resume
            ? `${resume.fileName} · parsed in ${resume.parseMs}ms`
            : undefined
        }
      >
        What the analysis found
      </AppHeading>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <SubCard>
            <span className="t-micro">Skills found</span>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span
                  key={s.id}
                  className={cn(
                    "rounded-sm bg-white/5 px-1.5 py-px font-mono text-xs",
                    s.isNewSinceLast ? "text-iris-violet" : "text-fog"
                  )}
                  title={
                    s.trackId
                      ? `maps to ${s.trackId}`
                      : "no matching track — listed only"
                  }
                >
                  {s.rawLabel}
                </span>
              ))}
            </div>
            {skills.some((s) => s.isNewSinceLast) ? (
              <p className="mt-2 text-xs text-ash">
                Violet chips are new since your previous analysis.
              </p>
            ) : null}
          </SubCard>

          <SubCard>
            <span className="t-micro">Evidence on file</span>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {evidence.map((e) => (
                <li
                  key={e.id}
                  className="flex items-baseline gap-2 text-xs text-fog"
                >
                  <Badge className="shrink-0">
                    {KIND_LABEL[e.kind] ?? e.kind}
                  </Badge>
                  <span className="min-w-0">
                    <strong className="font-[510] text-mist">{e.title}</strong>{" "}
                    — {e.detail}
                  </span>
                  {e.metric ? (
                    <span className="ml-auto shrink-0 font-mono text-xs tabular text-ash">
                      {e.metric}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </SubCard>
        </div>

        <SubCard>
          <div className="flex items-baseline justify-between gap-3">
            <span className="t-micro">Flagged lines</span>
            <Badge variant="err">
              <BadgeDot />
              {flags.length} verified
            </Badge>
          </div>
          <div className="mt-2.5 flex flex-col">
            {flags.map((f) => (
              <div
                key={f.id}
                className="flex gap-3 border-t border-graphite/70 py-2.5 first:border-t-0"
              >
                <span className="w-13 shrink-0 font-mono text-xs tabular text-ash">
                  p.{f.page} L{f.line}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-mist">
                    &ldquo;{f.quote}&rdquo;
                  </p>
                  <p className="mt-1 text-xs text-fog">{f.critique}</p>
                  {f.suggestedFix ? (
                    <p className="mt-1 text-xs text-ash">
                      Fix: {f.suggestedFix}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 border-t border-graphite pt-2 text-xs text-ash">
            Every flag&rsquo;s quote was verified against the PDF before it was
            stored. Flags that failed verification were discarded.
          </p>
        </SubCard>
      </div>
    </div>
  )
}
