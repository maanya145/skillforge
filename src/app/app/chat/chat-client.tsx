"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, RotateCcw, Square, ArrowUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SubCard } from "@/components/shell/frame"
import { Markdown } from "@/components/chat/markdown"
import { TOOL_LABELS } from "@/mastra/tools/tool-labels"
import { cn } from "@/lib/utils"

type Status = "sending" | "streaming" | "sent" | "failed"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  status: Status
  toolsUsed?: string[]
}

type Thread = { id: string; title: string | null; updatedAt: string }

const MAX_CHARS = 4000

const OPENERS = [
  "What should I do this week?",
  "Why is my system design number so low?",
  "Where do I actually learn Docker properly?",
  "Would I be better off targeting a different role?",
]

export function ChatClient({ initialThreads }: { initialThreads: Thread[] }) {
  const [threads, setThreads] = useState<Thread[]>(initialThreads)
  const [threadId, setThreadId] = useState<string | null>(
    initialThreads[0]?.id ?? null
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [pending, setPending] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [loadingThread, setLoadingThread] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Load a thread's transcript ─────────────────────────────────────────────
  useEffect(() => {
    if (!threadId) {
      setMessages([])
      return
    }
    let cancelled = false
    setLoadingThread(true)
    fetch(`/api/chat?threadId=${threadId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => {
        if (cancelled) return
        setMessages(
          (data.messages ?? []).map(
            (m: { id: string; role: string; content: string; toolsUsed: string[] }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              status: "sent" as const,
              toolsUsed: m.toolsUsed,
            })
          )
        )
      })
      .finally(() => !cancelled && setLoadingThread(false))
    return () => {
      cancelled = true
    }
  }, [threadId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, pending])

  useEffect(() => {
    if (!pending) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [pending])

  const autosize = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  // ── Send, streaming the reply ──────────────────────────────────────────────
  const send = useCallback(
    async (text: string, replacingId?: string) => {
      const content = text.trim()
      if (!content || pending) return
      if (content.length > MAX_CHARS) return

      const userId = replacingId ?? crypto.randomUUID()
      const assistantId = crypto.randomUUID()

      setMessages((prev) => {
        const base = replacingId
          ? prev.filter((m) => m.id !== replacingId)
          : prev
        return [
          ...base,
          { id: userId, role: "user", content, status: "sent" },
          {
            id: assistantId,
            role: "assistant",
            content: "",
            status: "streaming",
            toolsUsed: [],
          },
        ]
      })
      setInput("")
      requestAnimationFrame(autosize)
      setPending(true)

      const controller = new AbortController()
      abortRef.current = controller

      const fail = (message: string) =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: message, status: "failed" as const }
              : m.id === userId
                ? { ...m, status: "failed" as const }
                : m
          )
        )

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: content, threadId }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          const data = res.headers.get("content-type")?.includes("json")
            ? await res.json().catch(() => null)
            : null
          fail(
            data?.error ??
              (res.status === 401
                ? "Your session expired — sign in again."
                : "The mentor couldn't respond. Send your message again.")
          )
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let newThreadId: string | null = null

        // Parse SSE frames; a frame is complete on a blank line.
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const frames = buffer.split("\n\n")
          buffer = frames.pop() ?? ""

          for (const frame of frames) {
            const eventLine = frame.split("\n").find((l) => l.startsWith("event: "))
            const dataLine = frame.split("\n").find((l) => l.startsWith("data: "))
            if (!eventLine || !dataLine) continue
            const event = eventLine.slice(7).trim()
            let payload: Record<string, unknown> = {}
            try {
              payload = JSON.parse(dataLine.slice(6))
            } catch {
              continue
            }

            if (event === "meta" && typeof payload.threadId === "string") {
              newThreadId = payload.threadId
            } else if (event === "delta" && typeof payload.text === "string") {
              const delta = payload.text
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + delta } : m
                )
              )
            } else if (event === "tool" && typeof payload.name === "string") {
              const name = payload.name
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolsUsed: [...new Set([...(m.toolsUsed ?? []), name])],
                      }
                    : m
                )
              )
            } else if (event === "error") {
              fail(
                (payload.error as string) ??
                  "The mentor couldn't respond. Send your message again."
              )
              return
            } else if (event === "done") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, status: "sent" as const } : m
                )
              )
            }
          }
        }

        // A brand-new conversation: adopt its id and show it in the switcher.
        if (newThreadId && newThreadId !== threadId) {
          setThreadId(newThreadId)
          setThreads((prev) =>
            prev.some((t) => t.id === newThreadId)
              ? prev
              : [
                  {
                    id: newThreadId,
                    title:
                      content.length > 48 ? `${content.slice(0, 47)}…` : content,
                    updatedAt: new Date().toISOString(),
                  },
                  ...prev,
                ]
          )
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // Cancelling is a choice, not a failure — keep whatever streamed.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    status: "sent" as const,
                    content: m.content || "(stopped)",
                  }
                : m
            )
          )
        } else {
          fail("Could not reach the server. Check your connection and retry.")
        }
      } finally {
        setPending(false)
        abortRef.current = null
        inputRef.current?.focus()
      }
    },
    [pending, threadId, autosize]
  )

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
  const showRetry =
    !pending && messages[messages.length - 1]?.status === "failed" && lastUserMessage

  return (
    <div className="flex flex-col gap-3">
      {/* Conversations */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setThreadId(null)
            setMessages([])
            inputRef.current?.focus()
          }}
        >
          <Plus aria-hidden />
          New chat
        </Button>
        {threads.slice(0, 6).map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={pending}
            onClick={() => setThreadId(t.id)}
            className={cn(
              "max-w-[180px] shrink-0 truncate rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-50",
              t.id === threadId
                ? "bg-white/[0.08] text-mist"
                : "bg-white/[0.03] text-ash hover:text-fog"
            )}
          >
            {t.title ?? "Conversation"}
          </button>
        ))}
      </div>

      {/* Transcript */}
      <div className="flex max-h-[52vh] min-h-[280px] flex-col gap-3 overflow-y-auto pr-1">
        {loadingThread ? (
          <p className="px-1 font-mono text-xs text-ash">Loading…</p>
        ) : null}

        {!loadingThread && messages.length === 0 ? (
          <SubCard>
            <p className="text-caption text-mist">
              The mentor can read your skill map, roadmap and recommendations,
              and search the web for real material. Ask it anything about your
              plan.
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

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-md px-3 py-2 text-body-sm",
              m.role === "user"
                ? "self-end bg-white/[0.06] text-mist"
                : "self-start bg-white/[0.02] text-fog shadow-subtle",
              m.status === "failed" && "text-coral-red"
            )}
          >
            {m.toolsUsed?.length ? (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {m.toolsUsed.map((t) => (
                  <span
                    key={t}
                    className="rounded-sm bg-white/5 px-1.5 py-px font-mono text-xs text-ash"
                  >
                    {TOOL_LABELS[t] ?? t}
                  </span>
                ))}
              </div>
            ) : null}

            {m.role === "assistant" && m.status !== "failed" ? (
              <Markdown content={m.content} />
            ) : (
              <span className="whitespace-pre-wrap">{m.content}</span>
            )}

            {m.status === "streaming" && !m.content ? (
              <span className="font-mono text-xs text-ash">
                <span className="animate-pulse">•</span> Thinking — this can take
                a minute or two ({elapsed}s)
              </span>
            ) : null}
          </div>
        ))}

        {showRetry && lastUserMessage ? (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => send(lastUserMessage.content, lastUserMessage.id)}
          >
            <RotateCcw aria-hidden />
            Retry
          </Button>
        ) : null}

        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="flex flex-col gap-1.5 border-t border-graphite pt-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            maxLength={MAX_CHARS}
            onChange={(e) => {
              setInput(e.target.value)
              autosize()
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter is a newline — the convention people
              // already have in their fingers.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder="Ask about your plan…"
            aria-label="Message the mentor"
            className="max-h-40 min-h-9 flex-1 resize-none rounded-md border border-graphite bg-white/[0.02] px-3 py-2 text-sm text-mist placeholder:text-ash focus-visible:border-mist focus-visible:outline-none"
          />
          {pending ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Stop generating"
              onClick={() => abortRef.current?.abort()}
            >
              <Square aria-hidden />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              aria-label="Send message"
              disabled={!input.trim()}
            >
              <ArrowUp aria-hidden />
            </Button>
          )}
        </div>
        {input.length > MAX_CHARS * 0.8 ? (
          <span className="self-end font-mono text-xs text-ash">
            {input.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        ) : null}
      </form>
    </div>
  )
}
