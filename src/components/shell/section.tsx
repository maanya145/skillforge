import * as React from "react"

import { cn } from "@/lib/utils"

/** Page container: 1200px, centred, 24px gutters. */
function Container({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1200px] px-6", className)}
      {...props}
    />
  )
}

/**
 * Section heading block: uppercase micro eyebrow, 48px heading, body copy
 * capped near 65 characters.
 */
function SectionHead({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string
  title: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex max-w-[640px] flex-col gap-4", className)}>
      {eyebrow ? <span className="t-micro">{eyebrow}</span> : null}
      <h2 className="text-heading">{title}</h2>
      {children ? <p className="text-base text-fog">{children}</p> : null}
    </div>
  )
}

/**
 * The rationale rail — a mono key beside a short explanation. Used for the
 * roadmap's week notes and the intake screen's flagged lines.
 */
function NoteRail({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-graphite pt-4",
        className
      )}
      {...props}
    />
  )
}

function Note({
  k,
  children,
}: {
  /** Short mono key, e.g. "W1" or "p.1 L7" */
  k: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-9 shrink-0 font-mono text-xs tabular text-ash">
        {k}
      </span>
      <p className="text-body-sm text-fog">{children}</p>
    </div>
  )
}

export { Container, SectionHead, NoteRail, Note }
