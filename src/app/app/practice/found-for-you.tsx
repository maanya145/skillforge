"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, RefreshCw, Compass } from "lucide-react"
import { toast } from "sonner"

import { refreshDiscoveries } from "@/app/app/actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AppHeading } from "@/components/shell/frame"

export type Discovery = {
  id: string
  kind: "course" | "project"
  title: string
  url: string
  source: string
  summary: string
  closesTrackIds: string[]
  effortWeeks: number | null
  costNote: string | null
  score: number
  rank: number
  rationale: string
}

/**
 * Web-found resources, kept visibly separate from the curated catalog above.
 *
 * The separation is the honest part: everything in the seeded catalog was
 * hand-authored and its effort verified, while these were found by an agent
 * minutes ago. They are ranked by the same weighted-gap arithmetic, but the
 * source is always shown so a student can judge it themselves.
 */
export function FoundForYou({
  items,
  trackNames,
}: {
  items: Discovery[]
  trackNames: Record<string, string>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function refresh() {
    startTransition(async () => {
      const result = await refreshDiscoveries()
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
      router.refresh()
    })
  }

  return (
    <div>
      <AppHeading
        aside={
          <button
            type="button"
            onClick={refresh}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-fog transition-colors hover:text-mist disabled:opacity-60"
          >
            <RefreshCw
              className={pending ? "size-3 animate-spin" : "size-3"}
              aria-hidden
            />
            {pending ? "Searching the web…" : "Find more"}
          </button>
        }
      >
        Found for you{" "}
        <span className="text-fog">· from the open web</span>
      </AppHeading>

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 px-2 py-6">
          <Compass className="size-5 text-ash" aria-hidden />
          <p className="max-w-[52ch] text-xs text-fog">
            Nothing found yet. An agent searches for courses and buildable
            projects matching your three largest open gaps, then scores what it
            finds with the same weighted-gap arithmetic as everything else.
          </p>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={pending}>
            {pending ? "Searching…" : "Search now"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="group border-t border-graphite/70 px-2 py-3 first:border-t-0 hover:bg-white/[0.02]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="flex min-w-0 items-baseline gap-2 text-sm font-[510] tracking-[-0.01em] text-mist">
                  <span className="truncate">{item.title}</span>
                  <ExternalLink
                    className="size-3 shrink-0 text-ash opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </h4>
                <span className="font-mono text-xs tabular whitespace-nowrap text-ash">
                  {item.score}
                </span>
              </div>

              <p className="mt-1 text-xs text-ash">{item.summary}</p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant={item.kind === "course" ? "info" : "alt"}>
                  {item.kind}
                </Badge>
                {item.closesTrackIds.map((id) => (
                  <Badge key={id} variant="tag">
                    {trackNames[id] ?? id}
                  </Badge>
                ))}
                <span className="ml-auto font-mono text-xs text-ash">
                  {item.source}
                  {item.costNote ? ` · ${item.costNote}` : ""}
                  {item.effortWeeks ? ` · ~${item.effortWeeks}wk` : ""}
                </span>
              </div>
            </a>
          ))}

          <p className="mt-3 border-t border-graphite px-2 pt-3 text-xs text-ash">
            Scored by the same arithmetic as the catalog above, but found on the
            open web minutes ago rather than hand-checked. The source is shown
            so you can judge it — and none of these are scheduled on your
            roadmap.
          </p>
        </div>
      )}
    </div>
  )
}
