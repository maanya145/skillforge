import { cn } from "@/lib/utils"

export type GanttItem = {
  id: string
  lane: "close_gaps" | "build_proof" | "drill"
  kind: "gap" | "project" | "drill" | "milestone"
  label: string
  detail: string
  startWeek: number
  endWeek: number
  status?: "planned" | "in_progress" | "done" | "skipped"
}

const LANES: { key: GanttItem["lane"]; title: string }[] = [
  { key: "close_gaps", title: "Close gaps" },
  { key: "build_proof", title: "Build proof" },
  { key: "drill", title: "Drill" },
]

/** Bar treatments per kind — chromatic, but never the accent. */
const BAR: Record<GanttItem["kind"], string> = {
  gap: "bg-iris-violet/20 text-[#a5a7f7] shadow-[inset_0_0_0_1px_rgba(99,102,241,0.35)]",
  project:
    "bg-pulse-green/15 text-[#5cc97a] shadow-[inset_0_0_0_1px_rgba(39,166,68,0.32)]",
  drill: "hatch bg-white/[0.04] text-fog shadow-subtle",
  milestone:
    "justify-center bg-coral-red/20 text-[#f08585] shadow-[inset_0_0_0_1px_rgba(235,87,87,0.38)]",
}

/**
 * The 14-column gantt. Server Component, pure CSS grid — `grid-column:
 * startWeek / endWeek + 1` is the whole trick, which is why `roadmapItems`
 * stores 1-based inclusive weeks.
 */
export function RoadmapGantt({
  items,
  totalWeeks,
  currentWeek,
  className,
}: {
  items: GanttItem[]
  totalWeeks: number
  /** 1-based; marks "you are here" on the timeline. */
  currentWeek?: number
  className?: string
}) {
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1)
  const cols = { gridTemplateColumns: `168px repeat(${totalWeeks}, 1fr)` }
  // The faint per-week tick grid behind every lane
  const ticks = {
    backgroundImage:
      "linear-gradient(90deg, rgba(35,37,42,0.55) 0 1px, transparent 1px)",
    backgroundSize: `calc(100% / ${totalWeeks}) 100%`,
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="min-w-[880px]">
        <div className="grid border-b border-graphite" style={cols}>
          <span className="py-2 pl-4 font-mono text-xs text-fog">Week</span>
          {weeks.map((w) => (
            <span
              key={w}
              className={cn(
                "py-2 text-center font-mono text-xs tabular",
                w === currentWeek
                  ? "font-[510] text-paper"
                  : w < (currentWeek ?? 0)
                    ? "text-smoke"
                    : "text-ash"
              )}
            >
              {w}
            </span>
          ))}
        </div>

        {LANES.map((lane) => {
          const laneItems = items.filter((i) => i.lane === lane.key)
          if (laneItems.length === 0) return null
          return (
            <div
              key={lane.key}
              className="border-b border-graphite/70 py-3 last:border-b-0"
            >
              <div className="t-micro px-4 pb-2">{lane.title}</div>
              {groupRows(laneItems).map((row, r) => (
                <div
                  key={r}
                  className="grid min-h-7 items-center"
                  style={cols}
                >
                  <span className="truncate pr-3 pl-4 text-caption text-fog">
                    {row[0].label}
                  </span>
                  <div
                    className="relative col-[2/-1] grid h-full items-center"
                    style={{
                      gridTemplateColumns: `repeat(${totalWeeks}, 1fr)`,
                      ...ticks,
                    }}
                  >
                    {currentWeek && currentWeek <= totalWeeks ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 z-10 w-px bg-acid-lime/40"
                        style={{
                          left: `calc(${((currentWeek - 1) / totalWeeks) * 100}% - 0.5px)`,
                        }}
                      />
                    ) : null}
                    {row.map((item) => (
                      <span
                        key={item.id}
                        className={cn(
                          "flex h-5 items-center overflow-hidden rounded-sm px-2 text-xs whitespace-nowrap",
                          BAR[item.kind],
                          item.status === "done" && "opacity-45 line-through"
                        )}
                        style={{
                          gridColumn: `${item.startWeek} / ${item.endWeek + 1}`,
                        }}
                        title={`${item.label}: weeks ${item.startWeek}–${item.endWeek}`}
                      >
                        {item.detail}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        <div className="flex flex-wrap items-center gap-6 px-4 py-3">
          <Key swatch="bg-iris-violet/40">Gap work</Key>
          <Key swatch="bg-pulse-green/40">Portfolio build</Key>
          <Key swatch="hatch bg-white/[0.06] shadow-subtle">Recurring drill</Key>
          <Key swatch="bg-coral-red/45">Checkpoint</Key>
          {currentWeek ? (
            <Key swatch="w-px bg-acid-lime/60">This week</Key>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Items sharing a label (the two mocks) render on one row. */
function groupRows(items: GanttItem[]): GanttItem[][] {
  const rows = new Map<string, GanttItem[]>()
  for (const item of items) {
    const row = rows.get(item.label) ?? []
    row.push(item)
    rows.set(item.label, row)
  }
  return [...rows.values()]
}

function Key({
  swatch,
  children,
}: {
  swatch: string
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-2 text-xs text-ash">
      <i className={cn("block h-2 w-[18px] shrink-0 rounded-sm", swatch)} />
      {children}
    </span>
  )
}
