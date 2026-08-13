"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { switchTargetRole } from "@/app/app/actions"
import { cn } from "@/lib/utils"

export type RoleRow = {
  roleId: string
  name: string
  readiness: number
  openGaps: number
  totalWeeks: number
  isCurrent: boolean
}

/**
 * The mockup's "If you switched target" panel, live. Every row was computed
 * server-side from the same cached evidence — switching re-scores, re-ranks
 * and reschedules in one round trip with no model call.
 */
export function RoleSwitcher({ roles }: { roles: RoleRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function switchTo(role: RoleRow) {
    if (role.isCurrent || pending) return
    startTransition(async () => {
      const result = await switchTargetRole(role.roleId)
      if (result.ok) {
        toast.success(result.message)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <div className="flex flex-col">
      {roles.map((role) => (
        <button
          key={role.roleId}
          type="button"
          disabled={role.isCurrent || pending}
          onClick={() => switchTo(role)}
          aria-current={role.isCurrent ? "true" : undefined}
          className={cn(
            "flex items-center justify-between gap-3 border-t border-graphite/70 px-1 py-2.5 text-left transition-colors first:border-t-0",
            role.isCurrent
              ? "cursor-default"
              : "cursor-pointer hover:bg-white/[0.03]",
            pending && "opacity-60"
          )}
        >
          <span className="flex items-center gap-2">
            {role.isCurrent ? (
              <span
                aria-hidden
                className="h-3.5 w-0.5 rounded-sm bg-acid-lime"
              />
            ) : (
              <span aria-hidden className="w-0.5" />
            )}
            <span
              className={cn(
                "text-caption",
                role.isCurrent ? "text-paper" : "text-mist"
              )}
            >
              {role.name}
            </span>
          </span>
          <span className="font-mono text-xs tabular whitespace-nowrap text-ash">
            {role.readiness}
            <span className="px-1 text-smoke">·</span>
            {role.openGaps} gaps
            <span className="px-1 text-smoke">·</span>
            {role.totalWeeks} wks
          </span>
        </button>
      ))}
      <p className="mt-2 border-t border-graphite pt-2 text-xs text-ash">
        Same evidence, five different bars. Switching re-measures everything —
        instantly, because it&rsquo;s arithmetic, not another model call.
      </p>
    </div>
  )
}
