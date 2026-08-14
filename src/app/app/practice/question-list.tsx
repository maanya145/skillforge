"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { markQuestionPractised } from "@/app/app/actions"

export type PracticeQuestion = {
  questionId: string
  prompt: string
  topic: string
  company: string | null
  round: string | null
  year: number | null
  isGapTrack: boolean
  coachNote: string | null
  outline: string | null
  status: string
}

/**
 * Question rows that open into a practice dialog. The outline is revealed
 * behind a click on purpose — the point of the drill is to attempt the answer
 * before reading one.
 */
export function QuestionList({ questions }: { questions: PracticeQuestion[] }) {
  return (
    <div className="flex flex-col">
      {questions.map((q) => (
        <QuestionRow key={q.questionId} question={q} />
      ))}
    </div>
  )
}

function QuestionRow({ question: q }: { question: PracticeQuestion }) {
  const router = useRouter()
  const [revealed, setRevealed] = useState(false)
  const [pending, startTransition] = useTransition()
  const practised = q.status === "attempted"

  function markPractised() {
    startTransition(async () => {
      const result = await markQuestionPractised(q.questionId, q.topic)
      if (result.ok) {
        toast.success(result.message)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Dialog onOpenChange={(open) => !open && setRevealed(false)}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="border-t border-graphite/70 px-2 py-3 text-left transition-colors first:border-t-0 hover:bg-white/[0.02]"
        >
          <p className="text-sm text-mist">{q.prompt}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {q.isGapTrack ? (
              <Badge variant="err">
                <BadgeDot />
                Gap track
              </Badge>
            ) : (
              <Badge>Covered</Badge>
            )}
            {practised ? (
              <Badge variant="ok">
                <BadgeDot />
                Practised
              </Badge>
            ) : null}
            <span className="font-mono text-xs text-ash">
              {q.topic}
              {q.company ? ` · ${q.company}-style` : ""}
            </span>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-body-lg font-[510] text-paper">
            {q.prompt}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-ash">
            {q.topic}
            {q.company ? ` · the kind ${q.company} asks` : ""}
          </DialogDescription>
        </DialogHeader>

        {q.coachNote ? (
          <p className="text-body-sm text-fog">{q.coachNote}</p>
        ) : null}

        <div className="rounded-md bg-white/[0.02] p-4 shadow-subtle">
          {revealed && q.outline ? (
            <>
              <span className="t-micro">The shape of a strong answer</span>
              <p className="mt-2 text-body-sm text-mist">{q.outline}</p>
            </>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-body-sm text-fog">
                Attempt it out loud first — set a five-minute timer and talk
                through your answer the way you would in the round.
              </p>
              {q.outline ? (
                <Button size="sm" onClick={() => setRevealed(true)}>
                  Reveal the answer shape
                </Button>
              ) : (
                <p className="text-xs text-ash">
                  No answer shape for this one yet.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ash">
            Attempts build the habit trail; only closed gaps move readiness.
          </p>
          <Button
            size="sm"
            variant={practised ? "ghost" : "default"}
            disabled={pending || practised}
            onClick={markPractised}
          >
            {practised ? "Practised" : "Mark practised"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
