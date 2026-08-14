"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { FileUp, MessageCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { ConsoleShell, type DpadDir } from "@/components/shell/console-shell"

/**
 * The landing-page console: a boot menu with two choices, and a mentor chat
 * that runs INSIDE the device's screen.
 *
 * The menu routes "Upload a resume" to sign-up; "Ask the mentor" flips the
 * screen into a tiny 1-bit terminal talking to /api/hello — a toolless,
 * unauthenticated version of the mentor whose whole job is explaining the
 * product. B backs out of the chat; the crank scrolls the transcript, which
 * is the most Playdate-correct thing a crank could do.
 */

type Message = { role: "user" | "assistant"; content: string }

const MENU = [
  {
    label: "Upload a resume",
    hint: "measure yourself against a real role bar",
    icon: FileUp,
  },
  {
    label: "Ask the mentor",
    hint: "what is this thing?",
    icon: MessageCircle,
  },
] as const

const GREETING: Message = {
  role: "assistant",
  content:
    "hi — i'm the mentor. ask me what skillforge does, how the scoring works, or why the numbers can be trusted.",
}

export function ConsoleHero({ className }: { className?: string }) {
  const router = useRouter()
  const [mode, setMode] = React.useState<"menu" | "chat">("menu")
  const [index, setIndex] = React.useState(0)

  const [messages, setMessages] = React.useState<Message[]>([GREETING])
  const [input, setInput] = React.useState("")
  const [streaming, setStreaming] = React.useState(false)
  const abortRef = React.useRef<AbortController | null>(null)
  const logRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Keep the newest line visible as the reply streams in. DOM scroll only —
  // no state writes, so it cannot cascade renders.
  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages])

  const choose = React.useCallback(() => {
    if (index === 0) router.push("/sign-up")
    else {
      setMode("chat")
      // Focus after the input exists; rAF beats a magic-number timeout.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [index, router])

  const leaveChat = React.useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
    setMode("menu")
  }, [])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return

    const outgoing: Message[] = [...messages, { role: "user", content: text }]
    // The endpoint caps turns; trim from the front so long chats keep working
    // instead of starting to 400. The greeting is cosmetic — droppable.
    const transcript = outgoing.slice(-12)

    setMessages(outgoing)
    setInput("")
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch("/api/hello", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: transcript }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(`http ${res.status}`)

      setMessages((m) => [...m, { role: "assistant", content: "" }])

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
            setMessages((m) => {
              const last = m[m.length - 1]
              return [
                ...m.slice(0, -1),
                { ...last, content: last.content + data.text },
              ]
            })
          } else if (event === "error") {
            setMessages((m) => [
              ...m.slice(0, -1),
              { role: "assistant", content: data.error ?? "something broke — try again" },
            ])
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "couldn't reach the mentor — try again" },
        ])
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const scrollLog = (dir: 1 | -1) =>
    logRef.current?.scrollBy({ top: dir * 28, behavior: "smooth" })

  const onDpad = (dir: DpadDir) => {
    if (mode === "menu") {
      if (dir === "up" || dir === "down")
        setIndex((i) => (i + 1) % MENU.length) // two rows: either arrow flips
    } else if (dir === "up") scrollLog(-1)
    else if (dir === "down") scrollLog(1)
  }

  return (
    <ConsoleShell
      hero
      className={className}
      onDpad={onDpad}
      onA={mode === "menu" ? choose : send}
      onB={mode === "menu" ? () => setIndex(0) : leaveChat}
      aTitle={mode === "menu" ? MENU[index].label : "Send"}
      bTitle={mode === "menu" ? "Back" : "Back to menu"}
      onCrankStep={(dir) => (mode === "menu" ? onDpad(dir === 1 ? "down" : "up") : scrollLog(dir))}
      crankLabel={mode === "menu" ? "Crank to move the cursor" : "Crank to scroll the conversation"}
      headerRight={
        <span className="font-mono text-[10px] tabular text-bone/60">
          {mode === "menu" ? "boot" : "mentor"}
        </span>
      }
      footer={
        mode === "menu" ? (
          <>
            <span>↑↓ move</span>
            <span>Ⓐ select</span>
          </>
        ) : (
          <>
            <span>crank scrolls</span>
            <span>Ⓑ menu</span>
          </>
        )
      }
      screen={
        mode === "menu" ? (
          <div className="px-1 py-1.5 text-[12px]">
            <p className="px-1.5 pb-2 text-[10px] leading-snug text-bone/60">
              your resume, measured against a published role bar. no invented
              numbers.
            </p>
            {MENU.map((item, i) => {
              const cursor = i === index
              return (
                <button
                  key={item.label}
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onFocus={() => setIndex(i)}
                  onClick={() => {
                    setIndex(i)
                    if (i === 0) router.push("/sign-up")
                    else choose()
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[2px] px-1.5 py-1.5 text-left font-[590] outline-none",
                    cursor ? "bg-bone text-void" : "text-bone/75 hover:text-bone"
                  )}
                >
                  <item.icon aria-hidden className="size-3.5" strokeWidth={2.25} />
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    <span
                      className={cn(
                        "block truncate text-[9px] font-normal",
                        cursor ? "text-void/70" : "text-bone/45"
                      )}
                    >
                      {item.hint}
                    </span>
                  </span>
                  {cursor ? (
                    <span aria-hidden className="ml-auto">
                      ▸
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex h-[190px] flex-col text-[11px]">
            <div
              ref={logRef}
              className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 py-1.5"
              aria-live="polite"
            >
              {messages.map((m, i) => (
                <p
                  key={i}
                  className={cn(
                    "leading-snug",
                    m.role === "user" ? "text-bone" : "text-bone/75"
                  )}
                >
                  <span className="font-[590]">
                    {m.role === "user" ? "› " : "mentor: "}
                  </span>
                  {m.content}
                  {streaming && i === messages.length - 1 && m.role === "assistant" ? (
                    <span aria-hidden className="animate-pulse">
                      ▌
                    </span>
                  ) : null}
                </p>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
              className="flex items-center gap-1.5 border-t border-bone/20 px-2 py-1.5"
            >
              <span aria-hidden className="font-[590] text-bone/60">
                ›
              </span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={400}
                placeholder={streaming ? "…" : "ask what this is"}
                aria-label="Ask the mentor about SkillForge"
                disabled={streaming}
                className="min-w-0 flex-1 bg-transparent font-[590] text-bone outline-none placeholder:text-bone/40"
              />
            </form>
          </div>
        )
      }
    />
  )
}
