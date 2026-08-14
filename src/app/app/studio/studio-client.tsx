"use client"

import { useRef, useState } from "react"
import { Renderer } from "@openuidev/react-lang"
import { ArrowUp, Square, Sparkles } from "lucide-react"

import { skillforgeLibrary } from "@/components/genui/library"
import { TOOL_LABELS } from "@/mastra/tools/tool-labels"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SubCard } from "@/components/shell/frame"
import { cn } from "@/lib/utils"

const STARTERS = [
  "Where am I weakest, and how long to fix it?",
  "Show me my Docker gap and what closes it",
  "What should I build next, and why that?",
  "How would I score as a data engineer instead?",
]

/**
 * The studio: ask a question, watch the answer assemble as real UI.
 *
 * The streamed text is openui-lang, fed to the renderer on every chunk. The
 * parser tolerates a partial program, so blocks appear as their statements
 * complete rather than the whole answer landing at once — which is also why
 * the raw source is worth showing: it makes the "the model wrote this UI"
 * claim checkable rather than asserted.
 */
export function StudioClient() {
  const [question, setQuestion] = useState("")
  const [response, setResponse] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [tools, setTools] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showSource, setShowSource] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  async function ask(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    setQuestion(trimmed)
    setResponse("")
    setTools([])
    setError(null)
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        setError(
          res.status === 401
            ? "Your session expired — sign in again."
            : "Couldn't reach the studio. Try again."
        )
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE frames are separated by a blank line; keep the partial tail.
        const frames = buffer.split("\n\n")
        buffer = frames.pop() ?? ""

        for (const frame of frames) {
          const event = frame.match(/^event: (.+)$/m)?.[1]
          const raw = frame.match(/^data: (.+)$/m)?.[1]
          if (!event || !raw) continue

          let data: { text?: string; name?: string; error?: string }
          try {
            data = JSON.parse(raw)
          } catch {
            continue
          }

          if (event === "delta" && data.text) {
            setResponse((r) => (r ?? "") + data.text)
          } else if (event === "tool" && data.name) {
            setTools((t) => (t.includes(data.name!) ? t : [...t, data.name!]))
          } else if (event === "error") {
            setError(data.error ?? "Something went wrong.")
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("The connection dropped. Try again.")
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
    setStreaming(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(question)
        }}
        className="flex items-center gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your gaps, your plan, or what to build next…"
          aria-label="Ask the studio"
          disabled={streaming}
          className="min-w-0 flex-1 rounded-md border border-graphite bg-white/[0.02] px-3 py-2 text-caption text-mist placeholder:text-ash focus-visible:border-mist focus-visible:outline-none disabled:opacity-60"
        />
        {streaming ? (
          <Button type="button" size="sm" variant="ghost" onClick={stop}>
            <Square className="size-3" aria-hidden />
            Stop
          </Button>
        ) : (
          <Button type="submit" size="sm" disabled={!question.trim()}>
            <ArrowUp aria-hidden />
            Ask
          </Button>
        )}
      </form>

      {/* Starters — only before the first question */}
      {response === null && !streaming ? (
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-full bg-white/5 px-3 py-1 text-xs text-fog transition-colors hover:text-mist"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {/* Tool provenance */}
      {tools.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {tools.map((t) => (
            <Badge key={t} variant="tag">
              {TOOL_LABELS[t] ?? t}
            </Badge>
          ))}
        </div>
      ) : null}

      {/* The generated interface */}
      {response !== null ? (
        <SubCard className="p-4">
          {response.trim() === "" && streaming ? (
            <span className="flex items-center gap-2 font-mono text-xs text-ash">
              <Sparkles className="size-3 animate-pulse" aria-hidden />
              Reading your numbers…
            </span>
          ) : (
            <Renderer
              library={skillforgeLibrary}
              response={response}
              isStreaming={streaming}
            />
          )}
        </SubCard>
      ) : null}

      {error ? (
        <SubCard className="border border-coral-red/30">
          <p className="text-xs text-coral-red">{error}</p>
        </SubCard>
      ) : null}

      {/* The receipt */}
      {response ? (
        <div>
          <button
            type="button"
            onClick={() => setShowSource((v) => !v)}
            className="text-xs text-ash transition-colors hover:text-fog"
          >
            {showSource ? "Hide" : "Show"} what the model actually wrote
          </button>
          {showSource ? (
            <pre
              className={cn(
                "mt-2 max-h-80 overflow-auto rounded-md bg-white/[0.02] p-3",
                "font-mono text-xs whitespace-pre-wrap text-ash shadow-subtle"
              )}
            >
              {response}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
