"use client"

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react"
import { Check, Copy, Link2, EyeOff, Eye } from "lucide-react"
import { toast } from "sonner"

import {
  createShareLink,
  revokeShareLink,
  setShareShowName,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** The origin never changes within a page's life, so there is nothing to watch. */
const subscribeToNothing = () => () => {}
const readOrigin = () => window.location.origin

/**
 * Mint, copy and revoke the read-only report link.
 *
 * The absolute URL is assembled on the client rather than server-side: the
 * origin a student is actually looking at is the one they need to paste, and on
 * Vercel that is not always the deployment's canonical host.
 */
export function SharePanel({
  initialToken,
  initialShowName,
  views,
}: {
  initialToken: string | null
  initialShowName: boolean
  views: number
}) {
  const [token, setToken] = useState(initialToken)
  const [showName, setShowName] = useState(initialShowName)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  // The origin only exists in the browser. `useSyncExternalStore` with a
  // server snapshot is the hydration-safe way to read it — an effect that
  // setStates on mount would flash an empty field and trip the lint rule
  // against cascading renders.
  const origin = useSyncExternalStore(subscribeToNothing, readOrigin, () => "")

  // The tick is feedback, not state — it has to fade on its own or the button
  // reads as permanently "done" the next time someone looks at it.
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const url = token ? `${origin}/r/${token}` : ""

  function create() {
    startTransition(async () => {
      const result = await createShareLink()
      if (!result.ok) return void toast.error(result.message)
      setToken(result.token ?? null)
      setShowName(result.showName ?? true)
      toast.success(result.message)
    })
  }

  function revoke() {
    startTransition(async () => {
      const result = await revokeShareLink()
      if (!result.ok) return void toast.error(result.message)
      setToken(null)
      toast.success(result.message)
    })
  }

  function toggleName() {
    const next = !showName
    setShowName(next)
    startTransition(async () => {
      const result = await setShareShowName(next)
      if (!result.ok) {
        setShowName(!next)
        return void toast.error(result.message)
      }
      toast.success(result.message)
    })
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Clipboard access is denied over plain HTTP and in some embedded
      // browsers; the input below is selectable, so say so rather than fail.
      toast.error("Couldn't copy — select the link and copy it manually.")
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-fog">
          Create a read-only link to this report. It shows the gauges, the
          benchmark and the date — never your resume, evidence or chat.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={pending}
          onClick={create}
        >
          <Link2 aria-hidden />
          {pending ? "Creating…" : "Create a share link"}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <input
          readOnly
          value={url}
          aria-label="Shareable report link"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-sm border border-graphite bg-white/[0.02] px-2 py-1 font-mono text-xs text-mist focus-visible:border-mist focus-visible:outline-none"
        />
        <button
          type="button"
          onClick={copy}
          aria-label="Copy link"
          className={cn(
            "shrink-0 rounded-sm border border-graphite p-1.5 transition-colors",
            copied ? "text-pulse-green" : "text-fog hover:text-mist"
          )}
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={toggleName}
        disabled={pending}
        className="flex items-center gap-1.5 self-start text-xs text-fog transition-colors hover:text-mist disabled:opacity-60"
      >
        {showName ? (
          <Eye className="size-3.5" aria-hidden />
        ) : (
          <EyeOff className="size-3.5" aria-hidden />
        )}
        {showName ? "Showing your name" : "Name hidden"}
      </button>

      <div className="flex items-center justify-between gap-2 border-t border-graphite pt-2">
        <span className="font-mono text-xs text-ash">
          {views === 0
            ? "not opened yet"
            : `opened ${views} time${views === 1 ? "" : "s"}`}
        </span>
        <button
          type="button"
          onClick={revoke}
          disabled={pending}
          className="text-xs text-ash transition-colors hover:text-coral-red disabled:opacity-60"
        >
          Revoke
        </button>
      </div>
    </div>
  )
}
