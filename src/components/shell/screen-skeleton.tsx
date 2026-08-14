import { cn } from "@/lib/utils"

/**
 * Route-level loading state. Mirrors the real layout — a section head, then a
 * framed body — so the page does not jump when content arrives.
 */
export function ScreenSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-3">
        <Bar className="h-2.5 w-20" />
        <Bar className="h-8 w-56" />
        <Bar className="h-4 w-full max-w-[60ch]" />
      </div>
      <div className="overflow-hidden rounded-xl bg-card shadow-subtle">
        <div className="flex items-center justify-between border-b border-graphite px-4 py-3">
          <Bar className="h-3 w-40" />
          <Bar className="h-3 w-24" />
        </div>
        <div className="flex flex-col gap-4 p-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex justify-between">
                <Bar className="h-3 w-32" />
                <Bar className="h-3 w-20" />
              </div>
              <Bar className="h-2 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Bar({ className }: { className?: string }) {
  return <div className={cn("rounded-sm bg-white/[0.06]", className)} />
}
