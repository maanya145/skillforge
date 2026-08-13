"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { SubCard } from "@/components/shell/frame"
import { cn } from "@/lib/utils"

type Message = { role: "user" | "assistant"; content: string }

const OPENERS = [
  "What should I do this week?",
  "Why is my system design number so low?",
  "Which certification is actually worth it?",
]

export function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [pending, setPending] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, pending])

  // The free tier thinks for a long time; an honest counter beats a spinner.
  useEffect(() => {
    if (!pending) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [pending])

  async function send(text: string) {
    const content = text.trim()
    if (!content || pending) return

    const next: Message[] = [...messages, { role: "user", content }]
    setMessages(next)
    setInput("")
    setError(null)
    setPending(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "The mentor couldn't respond.")
      } else {
        setMessages([...next, { role: "assistant", content: data.text }])
      }
    } catch {
      setError("Could not reach the server.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-[52vh] min-h-[240px] flex-col gap-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <SubCard>
            <p className="text-caption text-mist">
              The mentor reads the same rows the dashboards render — your
              gauges, roadmap and rankings are in front of it before you type.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {OPENERS.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => send(o)}
                  className="rounded-full bg-white/5 px-3 py-1 text-xs text-fog transition-colors hover:text-mist"
                >
                  {o}
                </button>
              ))}
            </div>
          </SubCard>
        ) : null}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-md px-3 py-2 text-body-sm",
              m.role === "user"
                ? "self-end bg-white/[0.06] text-mist"
                : "self-start bg-white/[0.02] text-fog shadow-subtle"
            )}
          >
            {m.content}
          </div>
        ))}

        {pending ? (
          <div className="flex items-center gap-2 self-start px-3 py-2 font-mono text-xs text-ash">
            <span className="animate-pulse">•</span>
            thinking — free tier takes a while ({elapsed}s)
          </div>
        ) : null}
        {error ? (
          <p className="self-start px-3 text-xs text-coral-red">{error}</p>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="flex gap-2 border-t border-graphite pt-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your plan…"
          disabled={pending}
          className="h-9 min-w-0 flex-1 rounded-md border border-graphite bg-white/[0.02] px-3 text-sm text-mist placeholder:text-ash focus-visible:border-mist focus-visible:outline-none"
        />
        <Button type="submit" disabled={pending || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  )
}
