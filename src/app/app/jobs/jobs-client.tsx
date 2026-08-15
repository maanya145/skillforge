"use client"

import { useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ClipboardPaste, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { addJobTarget, removeJobTarget } from "@/app/app/actions"
import { Button } from "@/components/ui/button"

/**
 * Paste box for a job posting. The mapping takes one model call (~10–30 s on
 * the free tier), so the button narrates rather than spinning silently.
 */
export function PasteForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          const result = await addJobTarget(formData)
          if (result.ok) {
            toast.success(result.message)
            formRef.current?.reset()
            router.refresh()
          } else {
            toast.error(result.message)
          }
        })
      }
      className="flex flex-col gap-3"
    >
      <textarea
        name="posting"
        rows={7}
        required
        disabled={pending}
        placeholder="Paste the whole posting — responsibilities, requirements, nice-to-haves."
        aria-label="Job posting text"
        className="w-full resize-y rounded-md border border-graphite bg-white/[0.02] p-3 font-mono text-xs text-mist placeholder:text-ash focus-visible:border-mist focus-visible:outline-none"
      />
      <Button type="submit" disabled={pending} className="self-start">
        <ClipboardPaste aria-hidden />
        {pending ? "Mapping the posting…" : "Measure me against this job"}
      </Button>
    </form>
  )
}

export function DeleteTarget({ targetId }: { targetId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Remove this target"
      onClick={() =>
        startTransition(async () => {
          await removeJobTarget(targetId)
          router.refresh()
        })
      }
      className="text-ash transition-colors hover:text-coral-red disabled:opacity-50"
    >
      <Trash2 className="size-3.5" aria-hidden />
    </button>
  )
}
