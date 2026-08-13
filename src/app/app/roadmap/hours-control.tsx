"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { setWeeklyHours } from "@/app/app/actions"

const OPTIONS = [5, 9, 14, 20]

/**
 * The time-budget control. Changing it reschedules the whole roadmap and
 * recomputes every weeks-to-close — pure arithmetic, so it's instant.
 */
export function HoursControl({ current }: { current: number }) {
  const router = useRouter()
  const [hours, setHours] = useState(current)
  const [pending, startTransition] = useTransition()

  function apply(next: number) {
    setHours(next)
    if (next === current) return
    startTransition(async () => {
      const result = await setWeeklyHours(next)
      if (result.ok) {
        toast.success(result.message)
        router.refresh()
      } else {
        toast.error(result.message)
        setHours(current)
      }
    })
  }

  return (
    <div className="flex items-center gap-1 rounded-full bg-white/5 p-0.5">
      {OPTIONS.map((option) => (
        <Button
          key={option}
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => apply(option)}
          className={
            option === hours
              ? "h-6 rounded-full bg-paper px-2.5 text-xs text-void hover:bg-paper hover:text-void"
              : "h-6 rounded-full px-2.5 text-xs text-fog"
          }
        >
          {option}h
        </Button>
      ))}
      <span className="pr-2 pl-1 text-xs text-ash">/ week</span>
    </div>
  )
}
