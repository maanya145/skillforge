"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { ConsoleShell, type DpadDir } from "@/components/shell/console-shell"
import { WORKSPACE_NAV, type SidebarItem } from "@/components/shell/app-sidebar"

/**
 * The workspace console: the shell showing a nav menu. D-pad and crank move a
 * VISUAL cursor, A opens, B goes back; left/right jump to the ends, the
 * closest useful meaning for a horizontal axis in a vertical list.
 *
 * Two rules, unchanged from the playdate original:
 *
 *  1. It is never the only way to reach a screen. Sidebar, tab strip and ⌘K
 *     all still work, and every row here is an ordinary tabbable <a>. No
 *     listbox role: a contract this would not honour is worse than none.
 *  2. The screen is 1-bit on purpose — bone on void, inverted for the cursor
 *     row. That constraint is what makes it read as a device screen rather
 *     than a styled dropdown.
 */

/** Rows visible in the screen viewport at once. */
const WINDOW = 5

export function ConsoleDevice({
  items = WORKSPACE_NAV,
  current,
  className,
}: {
  items?: SidebarItem[]
  /** Pathname of the active route: seeds the cursor and marks the current row. */
  current?: string
  className?: string
}) {
  const router = useRouter()

  const initial = Math.max(
    0,
    items.findIndex((i) => current && current.startsWith(i.href))
  )
  const [index, setIndex] = React.useState(initial)

  const move = (delta: number) =>
    setIndex((i) => (i + delta + items.length) % items.length)

  const onDpad = (dir: DpadDir) => {
    if (dir === "up") move(-1)
    else if (dir === "down") move(1)
    else if (dir === "left") setIndex(0)
    else setIndex(items.length - 1)
  }

  // Window the list so the cursor stays visible without the menu paging
  // wholesale at either end.
  const start = Math.max(0, Math.min(index - 2, items.length - WINDOW))
  const visible = items.slice(start, start + WINDOW)

  return (
    <ConsoleShell
      className={className}
      onDpad={onDpad}
      onA={() => router.push(items[index].href)}
      onB={() => router.back()}
      aTitle={`Open ${items[index].label}`}
      onCrankStep={move}
      crankLabel="Crank to scroll the menu"
      crankValue={{
        min: 1,
        max: items.length,
        now: index + 1,
        text: items[index].label,
      }}
      headerRight={
        <span className="font-mono text-[10px] tabular text-void/60">
          {index + 1}/{items.length}
        </span>
      }
      footer={
        <>
          <span>↑↓ move</span>
          <span>Ⓐ open · Ⓑ back</span>
        </>
      }
      screen={
        <nav aria-label="Console menu">
          <ul className="px-1 py-1 text-[11px]">
            {visible.map((item, row) => {
              const i = start + row
              const cursor = i === index
              const here = current?.startsWith(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={here ? "page" : undefined}
                    onMouseEnter={() => setIndex(i)}
                    onFocus={() => setIndex(i)}
                    className={cn(
                      "flex items-center gap-2 rounded-[2px] px-1.5 py-1 font-[590] outline-none",
                      // 1-bit: the cursor row inverts. No tint, no ring.
                      cursor ? "bg-void text-bone" : "text-void/75 hover:text-void"
                    )}
                  >
                    <item.icon aria-hidden className="size-3" strokeWidth={2.25} />
                    <span className="truncate">{item.label}</span>
                    {cursor ? (
                      <span aria-hidden className="ml-auto">
                        ▸
                      </span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      }
    />
  )
}
