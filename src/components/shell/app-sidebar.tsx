import Link from "next/link"

import { cn } from "@/lib/utils"

export type SidebarItem = {
  href: string
  label: string
  /** Mono suffix — a count, a duration, a score */
  count?: string
}

export const WORKSPACE_NAV: SidebarItem[] = [
  { href: "/app/intake", label: "Intake" },
  { href: "/app/map", label: "Skill map" },
  { href: "/app/roadmap", label: "Roadmap" },
  { href: "/app/practice", label: "Practice" },
  { href: "/app/progress", label: "Progress" },
  { href: "/app/chat", label: "Mentor" },
  { href: "/app/settings", label: "Settings" },
]

/**
 * Sidebar inside the app frame. The active item carries a 2px acid-lime
 * indicator — sanctioned by the token's stated role ("primary action buttons,
 * active nav indicators"). Because the accent is limited to one element per
 * view, screens that show a lime CTA must not also show this sidebar.
 */
export function AppSidebar({
  items = WORKSPACE_NAV,
  current,
  label = "Workspace",
  className,
}: {
  items?: SidebarItem[]
  /** Pathname of the active route */
  current: string
  label?: string
  className?: string
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex flex-col gap-0.5 border-r border-graphite px-2 py-3",
        className
      )}
    >
      <span className="t-micro px-3 pt-2 pb-1">{label}</span>
      {items.map((item) => {
        const active = current === item.href || current.startsWith(item.href + "/")
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2 rounded-md px-3 py-1.5 text-caption transition-colors",
              active
                ? "bg-white/5 text-paper"
                : "text-fog hover:bg-white/[0.03] hover:text-mist"
            )}
          >
            {active ? (
              <span
                aria-hidden
                className="absolute top-1/2 left-0 h-3.5 w-0.5 -translate-y-1/2 rounded-sm bg-acid-lime"
              />
            ) : null}
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-sm border border-current opacity-60"
            />
            {item.label}
            {item.count ? (
              <span className="ml-auto font-mono text-xs tabular text-ash">
                {item.count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}


/**
 * Horizontally scrolling tab strip for narrow viewports, where the sidebar is
 * hidden. Same destinations, same active-state vocabulary.
 */
export function MobileNav({
  items = WORKSPACE_NAV,
  current,
  className,
}: {
  items?: SidebarItem[]
  current: string
  className?: string
}) {
  return (
    <nav
      aria-label="Workspace"
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-graphite px-2 py-2",
        className
      )}
    >
      {items.map((item) => {
        const active = current === item.href || current.startsWith(item.href + "/")
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors",
              active
                ? "bg-white/[0.08] text-paper"
                : "text-fog hover:text-mist"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
