"use client"

import { useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Link2, Unlink } from "lucide-react"
import { toast } from "sonner"

import { connectLeetcode, disconnectLeetcode } from "@/app/app/actions"
import { Button } from "@/components/ui/button"

/**
 * The LeetCode account strip. Connected, it shows the account's real solved
 * totals and quietly upgrades drill marks to verified on every visit;
 * disconnected, it is a one-field form. Verification is the whole point —
 * an accepted submission beats a ticked checkbox.
 */
export function LeetcodeConnect({
  connected,
}: {
  connected: {
    username: string
    totals: { all: number; easy: number; medium: number; hard: number } | null
  } | null
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()

  if (connected) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md bg-white/[0.02] px-3 py-2 shadow-subtle">
        <span className="font-mono text-xs text-mist">
          lc/{connected.username}
        </span>
        {connected.totals ? (
          <span className="font-mono text-xs tabular text-ash">
            {connected.totals.all} solved ·{" "}
            <span className="text-pulse-green">{connected.totals.easy}E</span>{" "}
            <span className="text-mist">{connected.totals.medium}M</span>{" "}
            <span className="text-coral-red">{connected.totals.hard}H</span>
          </span>
        ) : (
          <span className="font-mono text-xs text-ash">totals unavailable</span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await disconnectLeetcode()
              if (result.ok) toast.success(result.message)
              router.refresh()
            })
          }
          className="ml-auto inline-flex items-center gap-1 text-xs text-ash transition-colors hover:text-coral-red disabled:opacity-50"
        >
          <Unlink className="size-3" aria-hidden />
          disconnect
        </button>
      </div>
    )
  }

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          const result = await connectLeetcode(formData)
          if (result.ok) {
            toast.success(result.message)
            formRef.current?.reset()
            router.refresh()
          } else {
            toast.error(result.message)
          }
        })
      }
      className="flex flex-wrap items-center gap-2 rounded-md bg-white/[0.02] px-3 py-2 shadow-subtle"
    >
      <span className="text-xs text-fog">
        On LeetCode? Recent accepted submissions verify drills automatically.
      </span>
      <div className="ml-auto flex items-center gap-2">
        <input
          name="username"
          required
          maxLength={30}
          pattern="[A-Za-z0-9_\-]+"
          placeholder="leetcode username"
          aria-label="LeetCode username"
          disabled={pending}
          className="w-40 rounded-sm border border-graphite bg-white/[0.02] px-2 py-1 font-mono text-xs text-mist placeholder:text-ash focus-visible:border-mist focus-visible:outline-none"
        />
        <Button type="submit" size="sm" variant="ghost" disabled={pending}>
          <Link2 aria-hidden />
          {pending ? "Checking…" : "Connect"}
        </Button>
      </div>
    </form>
  )
}
