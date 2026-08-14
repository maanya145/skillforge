"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import { ChevronRight } from "lucide-react"

import { rankCerts, type CatalogCert } from "@/lib/ranking/rank"
import type { GapResult } from "@/lib/scoring/gap"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { AppHeading, SubCard } from "@/components/shell/frame"
import { cn } from "@/lib/utils"

const VERDICT = {
  worth_it: { label: "worth it", variant: "ok" as const },
  later: { label: "later", variant: "alt" as const },
  skip: { label: "skip", variant: "err" as const },
}

/** Slider stops, in rupees. Coarse on purpose — this is a decision, not a form. */
const BUDGETS = [0, 2000, 5000, 10000, 20000, 40000, Infinity]

const STORAGE_KEY = "skillforge.certBudget"
const NO_LIMIT = BUDGETS.length - 1

/**
 * The saved budget, read the hydration-safe way.
 *
 * localStorage does not exist during SSR, so an effect that setStates on mount
 * would both flash the wrong verdicts and trip the lint rule against cascading
 * renders. `useSyncExternalStore` with a server snapshot is the supported
 * shape, and subscribing to `storage` means a second tab stays in step.
 */
function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange)
  return () => window.removeEventListener("storage", onChange)
}

function readStoredBudget() {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = Number(raw)
  return raw !== null && Number.isInteger(parsed) && parsed >= 0 && parsed < BUDGETS.length
    ? parsed
    : NO_LIMIT
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`

/**
 * The certification decision, as a live artifact.
 *
 * This used to be a static list of verdicts. The problem with that is the
 * single most important input — what the student can actually spend — was
 * baked in at analysis time and invisible. A cert that reads "worth it" at
 * ₹18,000 is not worth it to someone with ₹5,000.
 *
 * So the scorer runs HERE, in the browser, on every change. It is the exact
 * `rankCerts` the analysis used, imported rather than reimplemented — the
 * function is pure TypeScript with no server-only dependency, which is what
 * makes this honest. A slider that ran a second, approximate formula would be
 * a demo; this cannot disagree with the server because it is the same code.
 */
export function Certifications({
  catalog,
  gaps,
  coveredTrackIds,
  trackNames,
}: {
  catalog: CatalogCert[]
  gaps: GapResult[]
  /** Tracks a scheduled project already proves — makes a cert redundant. */
  coveredTrackIds: string[]
  trackNames: Record<string, string>
}) {
  // An artifact is something you come back to, so it has to remember what you
  // set. Device-local rather than a column: the budget is a thinking tool, and
  // a round trip on every slider tick would make it feel like a form.
  const saved = useSyncExternalStore(
    subscribeToStorage,
    readStoredBudget,
    () => NO_LIMIT
  )
  // Once the student touches the slider their choice wins, so the control does
  // not fight the stored value it is about to overwrite.
  const [chosen, setChosen] = useState<number | null>(null)
  const budgetIndex = chosen ?? saved

  const [countProjects, setCountProjects] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  function chooseBudget(index: number) {
    setChosen(index)
    window.localStorage.setItem(STORAGE_KEY, String(index))
  }

  const budget = BUDGETS[budgetIndex]

  const ranked = useMemo(
    () =>
      rankCerts(
        catalog,
        gaps,
        new Set(countProjects ? coveredTrackIds : []),
        trackNames,
        { budgetInr: Number.isFinite(budget) ? budget : null }
      ),
    [catalog, gaps, coveredTrackIds, trackNames, countProjects, budget]
  )

  const worthIt = ranked.filter((c) => c.verdict === "worth_it").length
  const skipped = ranked.filter((c) => c.verdict === "skip").length

  return (
    <SubCard>
      <AppHeading
        className="px-0"
        aside={`${worthIt} of ${ranked.length} worth it`}
      >
        Certifications
      </AppHeading>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-b border-graphite pb-3">
        <label className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-3">
            <span className="t-micro">Budget</span>
            <span className="font-mono text-xs tabular text-mist">
              {Number.isFinite(budget) ? rupees(budget) : "no limit"}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={BUDGETS.length - 1}
            step={1}
            value={budgetIndex}
            onChange={(e) => chooseBudget(Number(e.target.value))}
            aria-label="Certification budget"
            className="w-full accent-paper"
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={countProjects}
            onChange={(e) => setCountProjects(e.target.checked)}
            className="size-3.5 accent-paper"
          />
          <span className="text-xs text-fog">
            Count the projects on my roadmap as already proving their tracks
          </span>
        </label>
      </div>

      {/* ── Verdicts ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col">
        {ranked.map((c) => {
          const v = VERDICT[c.verdict]
          const open = expanded === c.id
          return (
            <div
              key={c.id}
              className="border-t border-graphite/70 py-2.5 first:border-t-0"
            >
              <button
                type="button"
                onClick={() => setExpanded(open ? null : c.id)}
                aria-expanded={open}
                className="flex w-full items-baseline justify-between gap-3 text-left"
              >
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <ChevronRight
                    className={cn(
                      "size-3 shrink-0 text-ash transition-transform",
                      open && "rotate-90"
                    )}
                    aria-hidden
                  />
                  <span className="truncate text-caption text-mist">
                    {c.name}
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="font-mono text-xs tabular text-ash">
                    {c.score}
                  </span>
                  <Badge variant={v.variant}>
                    {c.verdict === "worth_it" ? <BadgeDot /> : null}
                    {v.label}
                  </Badge>
                </span>
              </button>

              <p className="mt-1 pl-4.5 text-xs text-ash">{c.rationale}</p>

              {open ? (
                <dl className="mt-2 ml-4.5 flex flex-col gap-1 border-l border-graphite pl-3">
                  <Term
                    label="Base value"
                    value={`+${c.breakdown.baseValue.toFixed(1)}`}
                    note="what the certificate is worth on its own"
                  />
                  <Term
                    label="Your open gaps it proves"
                    value={`+${c.breakdown.gapPoints.toFixed(1)}`}
                    note={
                      c.breakdown.closesTrackIds.length
                        ? c.breakdown.closesTrackIds
                            .map((id) => trackNames[id] ?? id)
                            .join(", ")
                        : "none — those tracks are already at the bar"
                    }
                  />
                  <Term
                    label="Cost"
                    value={`−${c.breakdown.costPenalty.toFixed(1)}`}
                    note={
                      c.costInr
                        ? `${rupees(c.costInr)} ÷ 4,000`
                        : "free"
                    }
                  />
                  {c.breakdown.redundancyPenalty > 0 ? (
                    <Term
                      label="Already covered"
                      value={`−${c.breakdown.redundancyPenalty.toFixed(1)}`}
                      note={c.cheaperAlternative ?? "a scheduled project proves this"}
                    />
                  ) : null}
                  <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-graphite pt-1">
                    <dt className="text-xs text-mist">Score</dt>
                    <dd className="font-mono text-xs tabular text-paper">
                      {c.score}
                    </dd>
                  </div>
                  <p className="mt-1 text-xs text-ash">
                    Worth it at 4.0 and above, later at 1.5, skip below that.
                    {c.breakdown.overBudget
                      ? " Overridden to skip because it is over budget."
                      : ""}
                  </p>
                </dl>
              ) : null}
            </div>
          )
        })}
      </div>

      <p className="mt-3 border-t border-graphite pt-3 text-xs text-ash">
        {skipped === ranked.length
          ? "Every certification here says don't bother at this budget."
          : `${skipped} of ${ranked.length} say don't bother.`}{" "}
        These verdicts are recomputed in your browser by the same function the
        analysis ran &mdash; move the slider and watch them change.
      </p>
    </SubCard>
  )
}

function Term({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-xs text-fog">
        {label}
        <span className="block text-xs text-ash">{note}</span>
      </dt>
      <dd className="font-mono text-xs tabular whitespace-nowrap text-mist">
        {value}
      </dd>
    </div>
  )
}
