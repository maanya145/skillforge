import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The product-screenshot frame: carbon surface, hairline inner border, 12px
 * radius. Elevation comes from the inset border, not a drop shadow — the one
 * exception is the hero frame, which opts into `shadow-card` to float above
 * the gradient floor.
 */
function AppFrame({
  className,
  floating = false,
  ...props
}: React.ComponentProps<"div"> & { floating?: boolean }) {
  return (
    <div
      data-slot="app-frame"
      className={cn(
        "relative overflow-hidden rounded-xl bg-card shadow-subtle",
        floating && "shadow-[inset_0_0_0_1px_#23252a,rgba(8,9,10,0.6)_0_4px_32px_0]",
        className
      )}
      {...props}
    />
  )
}

/** The frame's top chrome: breadcrumb on the left, tools on the right. */
function AppBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="app-bar"
      className={cn(
        "flex items-center justify-between gap-4 border-b border-graphite px-4 py-3",
        className
      )}
      {...props}
    />
  )
}

function Crumb({
  trail,
  children,
}: {
  /** Dimmed ancestors, e.g. ["Aarav Menon"] */
  trail?: string[]
  /** The current, full-contrast segment */
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 text-caption text-mist">
      {trail?.map((t) => (
        <React.Fragment key={t}>
          <span className="text-fog">{t}</span>
          <span className="text-smoke">/</span>
        </React.Fragment>
      ))}
      <span>{children}</span>
    </div>
  )
}

/** Compact pill used for read-only context in the app bar. */
function ToolPill({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-mist",
        className
      )}
      {...props}
    />
  )
}

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "rounded-sm border border-graphite px-1.5 font-mono text-xs text-fog",
        className
      )}
      {...props}
    />
  )
}

/** Padded body region inside a frame. */
function AppBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />
}

/**
 * Row heading inside a frame body — a label on the left, a mono readout on the
 * right. Used above every list and chart.
 */
function AppHeading({
  children,
  aside,
  className,
}: {
  children: React.ReactNode
  aside?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 px-2 pb-3",
        className
      )}
    >
      <span className="text-caption text-paper">{children}</span>
      {aside ? (
        <span className="font-mono text-xs tabular text-ash">{aside}</span>
      ) : null}
    </div>
  )
}

/** Nested panel: nearly invisible, separated by a whisper of tint. */
function SubCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="subcard"
      className={cn("rounded-md bg-white/[0.02] p-3 shadow-subtle", className)}
      {...props}
    />
  )
}

export { AppFrame, AppBar, AppBody, AppHeading, Crumb, ToolPill, Kbd, SubCard }
