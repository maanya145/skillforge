import * as React from "react"

import { cn } from "@/lib/utils"
import { AppFrame, AppBar, Crumb } from "@/components/shell/frame"
import { AppSidebar, MobileNav } from "@/components/shell/app-sidebar"

/**
 * The frame every workspace screen sits in: app bar, sidebar, content.
 * The sidebar carries the only acid-lime element on these screens, so
 * workspace screens must not also render a lime CTA.
 */
export function WorkspaceFrame({
  current,
  crumb,
  trail,
  tools,
  children,
  className,
}: {
  /** Pathname, used to mark the active sidebar item */
  current: string
  crumb: React.ReactNode
  trail?: string[]
  tools?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <AppFrame className={className}>
      <AppBar>
        <Crumb trail={trail}>{crumb}</Crumb>
        {tools ? (
          <div className="flex items-center gap-2">{tools}</div>
        ) : null}
      </AppBar>
      {/* Below lg the sidebar is hidden, so the workspace needs its own
          navigation or a phone user is stranded on whichever screen loaded. */}
      <MobileNav current={current} className="lg:hidden" />
      <div className="grid grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)]">
        <AppSidebar current={current} className="hidden lg:flex" />
        <div className="min-w-0 p-4">{children}</div>
      </div>
    </AppFrame>
  )
}

/**
 * Honest empty state. An empty screen is an invitation to act, so it names the
 * next action rather than apologising.
 */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-md bg-white/[0.02] px-6 py-12 shadow-subtle",
        className
      )}
    >
      <h3 className="text-subheading">{title}</h3>
      {children ? (
        <p className="max-w-[52ch] text-body-sm text-fog">{children}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
