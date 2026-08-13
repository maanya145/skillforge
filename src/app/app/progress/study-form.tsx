"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { logStudySession } from "@/app/app/actions"

export function StudyForm() {
  const [pending, startTransition] = useTransition()

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await logStudySession(formData)
          if (result.ok) toast.success(result.message)
          else toast.error(result.message)
        })
      }
      className="mt-4 flex flex-wrap items-center gap-2 border-t border-graphite pt-3"
    >
      <label className="text-xs text-fog" htmlFor="minutes">
        Log today:
      </label>
      <select
        id="minutes"
        name="minutes"
        className="h-8 rounded-md border border-graphite bg-white/[0.02] px-2 text-xs text-mist"
        defaultValue="60"
        disabled={pending}
      >
        <option value="30">30 min</option>
        <option value="60">1 hour</option>
        <option value="120">2 hours</option>
        <option value="180">3 hours</option>
      </select>
      <Button size="sm" type="submit" disabled={pending}>
        Log session
      </Button>
      <span className="text-xs text-ash">
        Builds the habit trail. It does not move readiness — only closed gaps
        do.
      </span>
    </form>
  )
}
