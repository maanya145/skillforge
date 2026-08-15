"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckSquare, ExternalLink, Square } from "lucide-react"
import { toast } from "sonner"

import { toggleProblemSolved } from "@/app/app/actions"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ProblemRow = {
  id: string
  title: string
  url: string
  trackName: string
  difficulty: 1 | 2 | 3
  isGapTrack: boolean
  solvedAt: string | null
  pattern: string | null
  acRate: number | null
}

const DIFFICULTY = {
  1: { label: "easy", cls: "text-pulse-green" },
  2: { label: "medium", cls: "text-mist" },
  3: { label: "hard", cls: "text-coral-red" },
} as const

/** How many unsolved rows show before "all N". The list should invite, not loom. */
const VISIBLE = 8

/**
 * The drill list. The row links out to the real problem; the toggle is ours.
 * Solving is a habit-trail mark — readiness only moves when a gap closes,
 * and the footer says so rather than letting the checkmarks imply otherwise.
 */
export function ProblemList({ problems }: { problems: ProblemRow[] }) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [, startTransition] = useTransition()

  const visible = showAll ? problems : problems.slice(0, VISIBLE)
  const hidden = problems.length - visible.length

  function toggle(problem: ProblemRow) {
    setPendingId(problem.id)
    startTransition(async () => {
      const result = await toggleProblemSolved(problem.id, problem.title)
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
      setPendingId(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col">
      {visible.map((p) => {
        const d = DIFFICULTY[p.difficulty]
        const solved = p.solvedAt !== null
        const pending = pendingId === p.id
        return (
          <div
            key={p.id}
            className="flex items-start gap-2.5 border-t border-graphite/70 px-1 py-2.5 first:border-t-0"
          >
            <button
              type="button"
              role="switch"
              aria-checked={solved}
              aria-label={solved ? `Unmark ${p.title}` : `Mark ${p.title} solved`}
              disabled={pending}
              onClick={() => toggle(p)}
              className={cn("mt-0.5 shrink-0 transition-opacity", pending && "opacity-40")}
            >
              {solved ? (
                <CheckSquare className="size-3.5 text-pulse-green" aria-hidden />
              ) : (
                <Square className="size-3.5 text-ash transition-colors hover:text-fog" aria-hidden />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className={cn(
                    "group flex min-w-0 items-baseline gap-1.5",
                    solved && "opacity-60"
                  )}
                >
                  <span
                    className={cn(
                      "truncate text-caption text-mist group-hover:text-paper",
                      solved && "line-through"
                    )}
                  >
                    {p.title}
                  </span>
                  <ExternalLink
                    className="size-3 shrink-0 text-ash opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </a>
                <span className={cn("font-mono text-xs whitespace-nowrap", d.cls)}>
                  {d.label}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant={p.isGapTrack ? "err" : "tag"}>
                  {p.isGapTrack ? <BadgeDot /> : null}
                  {p.trackName}
                </Badge>
                <span className="truncate text-xs text-ash">
                  {p.pattern ?? (p.acRate !== null ? `${p.acRate}% accepted` : "")}
                </span>
              </div>
            </div>
          </div>
        )
      })}

      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="border-t border-graphite/70 px-1 py-2 text-left text-xs text-fog transition-colors hover:text-mist"
        >
          Show all {problems.length} problems
        </button>
      ) : null}
    </div>
  )
}
