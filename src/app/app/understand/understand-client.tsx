"use client"

import { useRef, useState } from "react"
import { Renderer } from "@openuidev/react-lang"
import { ArrowUp, Square, Sparkles } from "lucide-react"

import { explainLibrary } from "@/components/genui/explain-library"
import { Button } from "@/components/ui/button"
import { SubCard } from "@/components/shell/frame"

/** Example one-liners that show the range without filling the box. */
const HINTS = [
  "a function you don't fully get",
  "lecture notes that didn't land",
  "a stack trace",
  "a paragraph from a paper",
]

/**
 * Paste material → watch the explanation assemble as interface.
 *
 * Same streaming pattern as the studio: the SSE deltas are raw openui-lang
 * fed to the renderer on every chunk, so flows, tables and code blocks appear
 * as their statements complete rather than the whole answer landing at once.
 */
export function UnderstandClient() {
  const [material, setMaterial] = useState("")
  const [question, setQuestion] = useState("")
  const [response, setResponse] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function explain() {
    const text = material.trim()
    if (text.length < 20 || streaming) return

    setResponse("")
    setError(null)
    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          material: text,
          question: question.trim() || undefined,
        }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        setError(
          res.status === 401
            ? "Your session expired — sign in again."
            : "Couldn't reach the explainer. Try again."
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
        const frames = buffer.split("\n\n")
        buffer = frames.pop() ?? ""
        for (const frame of frames) {
          const event = frame.match(/^event: (.+)$/m)?.[1]
          const raw = frame.match(/^data: (.+)$/m)?.[1]
          if (!event || !raw) continue
          let data: { text?: string; error?: string }
          try {
            data = JSON.parse(raw)
          } catch {
            continue
          }
          if (event === "delta" && data.text) {
            setResponse((r) => (r ?? "") + data.text)
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
      <SubCard>
        <span className="t-micro">The material</span>
        <textarea
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          disabled={streaming}
          rows={9}
          maxLength={20_000}
          placeholder={`Paste anything you're trying to understand — ${HINTS.join(", ")}.`}
          aria-label="Material to explain"
          className="mt-3 w-full resize-y rounded-md border border-graphite bg-white/[0.02] p-3 font-mono text-xs text-mist placeholder:text-ash focus-visible:border-mist focus-visible:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={streaming}
            maxLength={300}
            placeholder="Optional: a specific question — “why does this deadlock?”"
            aria-label="Optional question about the material"
            className="min-w-0 flex-1 rounded-md border border-graphite bg-white/[0.02] px-3 py-2 text-xs text-mist placeholder:text-ash focus-visible:border-mist focus-visible:outline-none"
          />
          {streaming ? (
            <Button type="button" size="sm" variant="ghost" onClick={stop}>
              <Square className="size-3" aria-hidden />
              Stop
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={explain}
              disabled={material.trim().length < 20}
            >
              <ArrowUp aria-hidden />
              Explain it
            </Button>
          )}
          <span className="font-mono text-xs text-ash">
            {material.trim().length.toLocaleString()} chars
          </span>
        </div>
      </SubCard>

      {response !== null ? (
        <SubCard className="p-4">
          {response.trim() === "" && streaming ? (
            <span className="flex items-center gap-2 font-mono text-xs text-ash">
              <Sparkles className="size-3 animate-pulse" aria-hidden />
              Reading it…
            </span>
          ) : (
            <Renderer
              library={explainLibrary}
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
    </div>
  )
}
