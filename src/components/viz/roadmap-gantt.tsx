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

/** The fixed label column. Shared by the grid template and the week marker. */
const LABEL_WIDTH = 168
/** Below this span a bar is too narrow to hold any readable text. */
const MIN_WEEKS_FOR_LABEL = 3

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
  const cols = { gridTemplateColumns: `${LABEL_WIDTH}px repeat(${totalWeeks}, 1fr)` }
  // The faint per-week tick grid behind every lane
  const ticks = {
    backgroundImage:
      "linear-gradient(90deg, rgba(35,37,42,0.55) 0 1px, transparent 1px)",
    backgroundSize: `calc(100% / ${totalWeeks}) 100%`,
  }

  const marked = currentWeek && currentWeek <= totalWeeks ? currentWeek : null

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="min-w-[880px]">
        {/*
          The chart body is its own positioning context so the "this week" line
          spans the header and every lane as ONE mark, and stops before the
          legend. It used to be drawn once per row, which broke it into
          disconnected segments wherever a lane's padding or heading fell
          between rows — it read as a rendering artefact rather than a marker.
        */}
        <div className="relative">
          {marked ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-10 w-px bg-acid-lime/40"
              style={{
                // The offset has to clear the fixed label column, so this is a
                // calc rather than a plain percentage of the row.
                left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px) * ${(marked - 1) / totalWeeks})`,
              }}
            />
          ) : null}
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
                    {row.map((item) => {
                      const span = item.endWeek - item.startWeek + 1
                      return (
                        <span
                          key={item.id}
                          className={cn(
                            "flex h-5 items-center rounded-sm px-2 text-xs",
                            // `truncate` rather than bare overflow-hidden: a
                            // clipped word with no ellipsis reads as a broken
                            // label, not a shortened one.
                            "truncate",
                            BAR[item.kind],
                            item.status === "done" && "opacity-45 line-through"
                          )}
                          style={{
                            gridColumn: `${item.startWeek} / ${item.endWeek + 1}`,
                          }}
                          title={`${item.label}: weeks ${item.startWeek}–${item.endWeek}${item.detail ? ` · ${item.detail}` : ""}`}
                        >
                          {/*
                            A one- or two-week bar is ~50–100px wide, which fits
                            nothing but a fragment. Showing a sliver of a word is
                            worse than showing none — the row label and the
                            tooltip already carry the meaning.
                          */}
                          {span >= MIN_WEEKS_FOR_LABEL ? item.detail : null}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        </div>

        <div className="flex flex-wrap items-center gap-6 px-4 py-3">
          <Key swatch="bg-iris-violet/40">Gap work</Key>
          <Key swatch="bg-pulse-green/40">Portfolio build</Key>
          <Key swatch="hatch bg-white/[0.06] shadow-subtle">Recurring drill</Key>
          <Key swatch="bg-coral-red/45">Checkpoint</Key>
          {marked ? (
            // Taller and narrower than the block swatches, so the key looks
            // like the vertical rule it stands for.
            <Key swatch="h-3.5 w-0.5 bg-acid-lime/60">This week</Key>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * Items sharing a label (the two mocks) share a row — but only where their
 * weeks do not overlap.
 *
 * Grouping on the label alone put two overlapping items in the same grid
 * cells, where they stacked on top of each other and the one underneath simply
 * vanished. Splitting on collision costs a row and keeps every item visible.
 */
export function groupRows(items: GanttItem[]): GanttItem[][] {
  const rows: GanttItem[][] = []

  for (const label of new Set(items.map((i) => i.label))) {
    const group = items
      .filter((i) => i.label === label)
      .sort((a, b) => a.startWeek - b.startWeek)

    for (const item of group) {
      const row = rows.find(
        (r) =>
          r[0].label === label &&
          r.every((o) => item.startWeek > o.endWeek || item.endWeek < o.startWeek)
      )
      if (row) row.push(item)
      else rows.push([item])
    }
  }

  return rows
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
