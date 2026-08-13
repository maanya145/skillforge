"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { toggleRoadmapItem } from "@/app/app/actions"
import { cn } from "@/lib/utils"

type Item = {
  id: string
  label: string
  status: string
  startWeek: number
  endWeek: number
}

/** The mark-done list. Toasts the readiness movement the action reports. */
export function DoneList({ items }: { items: Item[] }) {
  const [pending, startTransition] = useTransition()

  function toggle(item: Item) {
    startTransition(async () => {
      const result = await toggleRoadmapItem(item.id)
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
    })
  }

  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 border-t border-graphite/70 py-2 first:border-t-0"
        >
          <span className="min-w-0">
            <span
              className={cn(
                "text-caption",
                item.status === "done" ? "text-ash line-through" : "text-mist"
              )}
            >
              {item.label}
            </span>
            <span className="ml-2 font-mono text-xs tabular text-ash">
              W{item.startWeek}–{item.endWeek}
            </span>
          </span>
          <Button
            size="sm"
            variant={item.status === "done" ? "ghost" : "default"}
            disabled={pending}
            onClick={() => toggle(item)}
          >
            {item.status === "done" ? "Undo" : "Done"}
          </Button>
        </div>
      ))}
    </div>
  )
}
