"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Gamepad2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { ConsoleDevice } from "@/components/shell/console-device"

/** Dispatch this on window to open the dock from anywhere (the ⌘K palette does). */
export const CONSOLE_SUMMON_EVENT = "skillforge:console"

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

  // The ⌘K palette can summon it — a loose event rather than lifted state,
  // because the palette and the dock live in unrelated corners of the layout
  // and this is the only message that ever passes between them.
  React.useEffect(() => {
    const onSummon = () => setOpen(true)
    window.addEventListener(CONSOLE_SUMMON_EVENT, onSummon)
    return () => window.removeEventListener(CONSOLE_SUMMON_EVENT, onSummon)
  }, [])

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
            // Carbon-on-void was invisible by construction — a launcher for a
            // toy has to promise the toy. Bone chassis, dark screen slot and
            // the powered LED make it read as the device it opens.
            "group pointer-events-auto flex items-center gap-2.5 rounded-full bg-bone py-2 pr-4 pl-2.5 text-xs font-[590] text-void",
            "shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_8px_20px_rgba(0,0,0,0.5)]",
            "animate-in slide-in-from-bottom-4 fade-in transition-transform duration-500 hover:-translate-y-0.5",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mist"
          )}
        >
          <span className="grid size-6 place-items-center rounded-full bg-void text-bone">
            <Gamepad2 className="size-3.5" aria-hidden strokeWidth={2} />
          </span>
          Console
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-pulse-green shadow-[0_0_5px_rgba(39,166,68,0.9)]"
          />
        </button>
      )}
    </div>
  )
}
