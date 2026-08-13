import { cn } from "@/lib/utils"

/**
 * Hand-built SVG charts — Server Components, zero client JS. Recharts was
 * rejected on purpose: its default aesthetic can't be brought to this system
 * cheaply, and none of these need interactivity.
 */

// ─── Readiness sparkline ─────────────────────────────────────────────────────

const W = 520
const H = 120

export function ReadinessSparkline({
  points,
  target,
  labels,
  className,
}: {
  /** Chronological readiness values, 0–100 */
  points: number[]
  /** Dashed target line, e.g. the median offer threshold */
  target?: number
  /** Sparse x-axis labels, first to last */
  labels?: string[]
  className?: string
}) {
  if (points.length === 0) return null
  const single = points.length === 1
  const xs = (i: number) => (single ? W : i * (W / (points.length - 1)))
  const ys = (v: number) => H - (v / 100) * H

  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`)
    .join(" ")
  const area = `${path} L${W},${H} L0,${H} Z`
  const last = points[points.length - 1]

  return (
    <div className={className}>
      <svg
        viewBox={`-8 -10 ${W + 26} ${H + 20}`}
        role="img"
        aria-label={`Readiness moved from ${points[0]} to ${last}`}
        className="block w-full overflow-visible"
      >
        {target != null ? (
          <>
            <line
              x1={0}
              y1={ys(target)}
              x2={W}
              y2={ys(target)}
              stroke="#383b3f"
              strokeWidth={1}
              strokeDasharray="2 5"
            />
            <text
              x={W + 6}
              y={ys(target) + 3}
              style={{ font: "11px var(--font-jetbrains)", fill: "#62666d" }}
            >
              {target}
            </text>
          </>
        ) : null}
        <line x1={0} y1={H} x2={W} y2={H} stroke="#23252a" strokeWidth={1} />
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d0d6e0" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#d0d6e0" stopOpacity={0} />
          </linearGradient>
        </defs>
        {!single ? <path d={area} fill="url(#spark-fill)" /> : null}
        <path
          d={path}
          fill="none"
          stroke="#d0d6e0"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={xs(points.length - 1)} cy={ys(last)} r={3.5} fill="#ffffff" />
      </svg>
      {labels && labels.length > 1 ? (
        <div className="mt-2 flex justify-between font-mono text-xs tabular text-ash">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ─── Study heatmap ───────────────────────────────────────────────────────────

const HEAT = [
  "bg-white/[0.035]",
  "bg-mist/20",
  "bg-mist/40",
  "bg-mist/60",
  "bg-mist",
]

/**
 * 26 weeks × 7 days, column-major like every contribution graph. `days` is
 * chronological; levels are 0–4 buckets computed at write time.
 */
export function StudyHeatmap({
  days,
  className,
}: {
  days: { day: string; level: number }[]
  className?: string
}) {
  const byDay = new Map(days.map((d) => [d.day, d.level]))
  const today = new Date()
  const cells: { key: string; level: number }[][] = []

  // Build 26 columns of 7 rows, ending today.
  for (let w = 25; w >= 0; w--) {
    const col: { key: string; level: number }[] = []
    for (let d = 6; d >= 0; d--) {
      const date = new Date(today)
      date.setDate(today.getDate() - (w * 7 + d))
      const key = date.toISOString().slice(0, 10)
      col.push({ key, level: byDay.get(key) ?? 0 })
    }
    cells.push(col)
  }

  return (
    <div className={cn("grid grid-flow-col gap-[3px]", className)}>
      {cells.map((col, i) => (
        <div key={i} className="grid grid-rows-7 gap-[3px]">
          {col.map((c) => (
            <i
              key={c.key}
              title={c.key}
              className={cn(
                "block aspect-square w-full rounded-sm",
                HEAT[Math.max(0, Math.min(4, c.level))]
              )}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Per-track closure bar ───────────────────────────────────────────────────

/** The `.mini` bar: solid progress, a notch at the requirement. */
export function MiniGapBar({
  proven,
  required,
  className,
}: {
  proven: number
  required: number
  className?: string
}) {
  const pct = (v: number) => `${Math.max(0, Math.min(10, v)) * 10}%`
  return (
    <span
      className={cn(
        "relative mt-1.5 block h-1.5 rounded-sm bg-white/[0.03] shadow-subtle",
        className
      )}
    >
      <i
        className="absolute inset-y-0 left-0 rounded-sm bg-mist"
        style={{ width: pct(proven) }}
      />
      <u
        className="absolute -inset-y-0.5 w-px bg-paper no-underline"
        style={{ left: pct(required) }}
      />
    </span>
  )
}
