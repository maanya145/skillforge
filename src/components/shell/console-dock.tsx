"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Gamepad2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { ConsoleDevice } from "@/components/shell/console-device"

/**
 * Docks the console in the bottom-right of every workspace screen.
 *
 * Collapsed by default. A navigation device that opens over your content
 * uninvited is a toy at the user's expense, so this ships as a small pill and
 * only becomes the handheld when asked. State is per-session rather than
 * persisted — the sidebar is the durable navigation; this is the one you reach
 * for deliberately.
 *
 * Hidden below `lg`, where the mobile tab strip already occupies the same job
 * and the device would cover a third of the viewport.
 */
export function ConsoleDock() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  // Escape closes it, matching every other transient surface in the app.
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div className="pointer-events-none fixed right-6 bottom-6 z-40 hidden lg:block">
      {open ? (
        // pr-10 reserves the gutter the crank sticks out into, so it cannot be
        // clipped against the viewport edge.
        <div className="pointer-events-auto flex flex-col items-end gap-3 pr-10">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close the console"
            className="grid size-8 place-items-center rounded-full border border-graphite bg-carbon text-fog transition-colors hover:text-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mist"
          >
            <X className="size-4" aria-hidden />
          </button>
          <ConsoleDevice current={pathname} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-full border border-graphite bg-carbon px-4 py-2 text-xs text-fog",
            "shadow-subtle transition-all hover:-translate-y-0.5 hover:text-mist",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mist"
          )}
        >
          <Gamepad2 className="size-4" aria-hidden strokeWidth={2} />
          Console
        </button>
      )}
    </div>
  )
}
