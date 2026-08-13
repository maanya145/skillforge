import { cn } from "@/lib/utils"

export type GaugeStatus = "open" | "met" | "above"

export type Gauge = {
  trackId: string
  name: string
  /** 0–10, what the evidence proves */
  provenLevel: number
  /** 0–10, what the role asks for */
  requiredLevel: number
  /** max(0, required - proven) */
  gap: number
  weeksToClose: number
  status: GaugeStatus
  /** One-line footer, e.g. "Claimed on the resume, no project behind it" */
  note: string
}

/** 0–10 maps to 0–100% of the track. */
const pct = (level: number) => Math.max(0, Math.min(10, level)) * 10

/**
 * The signature component.
 *
 *   ├────────────█──────────╱╱╱╱╱╱▲──────────────┤
 *     solid mist = proven      hatch = gap    notch = requirement
 *
 * Every value is computed by TypeScript from seeded role benchmarks — the
 * model never produces a number that lands here. See src/lib/scoring/.
 *
 * Server Component: no client JS, the entrance animation is pure CSS.
 */
export function GapGauge({
  gauge,
  index = 0,
  className,
}: {
  gauge: Gauge
  /** Stagger position for the entrance animation */
  index?: number
  className?: string
}) {
  const { name, provenLevel, requiredLevel, gap, weeksToClose, note, status } =
    gauge
  const isOpen = status === "open"
  const provenPct = pct(provenLevel)
  const gapPct = pct(requiredLevel) - provenPct
  const delay = `${index * 50}ms`

  return (
    <div
      className={cn(
        "border-t border-graphite/70 px-2 py-3 transition-colors first:border-t-0 hover:bg-white/[0.02]",
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-caption tracking-[-0.01em] text-mist">{name}</span>
        <span className="font-mono text-xs tabular whitespace-nowrap text-ash">
          you <span className="text-paper">{provenLevel.toFixed(1)}</span>
          <span className="px-1.5">·</span>
          role <span className="text-mist">{requiredLevel.toFixed(1)}</span>
        </span>
      </div>

      <div
        className="relative my-2 h-2 rounded-sm bg-white/[0.03] shadow-subtle"
        role="img"
        aria-label={`${name}: proven ${provenLevel.toFixed(1)} of a required ${requiredLevel.toFixed(1)}`}
      >
        {/* proven */}
        <span
          className="animate-in slide-in-from-left absolute inset-y-0 left-0 origin-left rounded-sm bg-mist fill-mode-both duration-700 ease-out"
          style={{ width: `${provenPct}%`, animationDelay: delay }}
        />
        {/* gap */}
        {isOpen && gapPct > 0 ? (
          <span
            className="hatch animate-in fade-in absolute inset-y-0 origin-left rounded-sm fill-mode-both duration-700 ease-out"
            style={{
              left: `${provenPct}%`,
              width: `${gapPct}%`,
              animationDelay: `${index * 50 + 180}ms`,
            }}
          />
        ) : null}
        {/* the role's requirement */}
        <span
          aria-hidden
          className="absolute -inset-y-1 w-px bg-paper"
          style={{ left: `calc(${pct(requiredLevel)}% - 0.5px)` }}
        >
          <span className="absolute -top-1 -left-[2px] size-0 border-x-[2.5px] border-t-[4px] border-x-transparent border-t-paper" />
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ash">{note}</span>
        <span className="font-mono text-xs tabular whitespace-nowrap text-fog">
          {isOpen ? `${formatWeeks(weeksToClose)} to close` : "no gap"}
        </span>
      </div>
    </div>
  )
}

function formatWeeks(w: number) {
  const n = Math.max(1, Math.round(w))
  return `${n} ${n === 1 ? "wk" : "wks"}`
}

/** Proven / gap / requirement key. Sits under any list of gauges. */
export function GaugeLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mt-2 flex flex-wrap items-center gap-6 border-t border-graphite px-2 pt-3",
        className
      )}
    >
      <LegendItem swatch={<span className="h-2 w-[18px] rounded-sm bg-mist" />}>
        Proven now
      </LegendItem>
      <LegendItem
        swatch={
          <span className="hatch h-2 w-[18px] rounded-sm shadow-subtle" />
        }
      >
        Gap to close
      </LegendItem>
      <LegendItem swatch={<span className="h-3 w-px bg-paper" />}>
        What the role asks for
      </LegendItem>
    </div>
  )
}

function LegendItem({
  swatch,
  children,
}: {
  swatch: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-2 text-xs text-ash">
      {swatch}
      {children}
    </span>
  )
}
