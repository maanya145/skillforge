"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useReducedMotion } from "framer-motion"
import { FileUp, MessageCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { ConsoleShell, type DpadDir } from "@/components/shell/console-shell"

/**
 * The landing-page console: boots, then offers two doors.
 *
 * On mount the screen runs a short boot — the wordmark types itself on, a
 * block gauge fills, the LED pulses — then lands on a menu with two choices.
 * "Upload a resume" routes to sign-up; "Ask the mentor" flips the screen into
 * a tiny 1-bit terminal talking to /api/hello, a toolless unauthenticated
 * mentor whose whole job is explaining the product. B backs out; the crank
 * scrolls the transcript, which is the most Playdate-correct job a crank
 * could have.
 *
 * The boot is theatre and is treated as such: any input skips it, and
 * reduced-motion users never see it at all.
 */

type Message = { role: "user" | "assistant"; content: string }
type Mode = "boot" | "menu" | "chat"

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

// ── Boot sequence ──────────────────────────────────────────────────────────

const BOOT_WORD = "skillforge"
const BOOT_BLOCKS = 8
/** One tick types a letter or fills a block. */
const BOOT_TICK_MS = 90
/** Total ticks: the word, a beat, the gauge. */
const BOOT_TOTAL = BOOT_WORD.length + 2 + BOOT_BLOCKS
/** Hold on the full gauge before the menu, so the finish reads as an event. */
const BOOT_HOLD_MS = 450

const BOOT_STATUS = [
  "waking the benchmark",
  "calibrating gauges",
  "ready",
] as const

function BootScreen({ step }: { step: number }) {
  const typed = BOOT_WORD.slice(0, Math.min(step, BOOT_WORD.length))
  const blocks = Math.max(0, step - BOOT_WORD.length - 2)
  const status =
    blocks >= BOOT_BLOCKS
      ? BOOT_STATUS[2]
      : blocks > BOOT_BLOCKS / 2
        ? BOOT_STATUS[1]
        : BOOT_STATUS[0]

  return (
    <div className="flex h-[170px] flex-col items-center justify-center gap-3 font-mono lg:h-[200px]">
      <p className="text-[15px] font-[590] tracking-[0.22em] text-bone uppercase lg:text-[18px]">
        {typed}
        <span aria-hidden className="animate-pulse">
          ▌
        </span>
      </p>
      {step > BOOT_WORD.length + 1 ? (
        <>
          <p aria-hidden className="text-[13px] tracking-[0.3em] text-bone/80 lg:text-[15px]">
            {"▓".repeat(Math.min(blocks, BOOT_BLOCKS))}
            <span className="text-bone/25">
              {"░".repeat(Math.max(0, BOOT_BLOCKS - blocks))}
            </span>
          </p>
          <p className="text-[10px] tracking-[0.14em] text-bone/50 uppercase">
            {status}
          </p>
        </>
      ) : null}
    </div>
  )
}

// ── The device ─────────────────────────────────────────────────────────────

export function ConsoleHero({ className }: { className?: string }) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [mode, setMode] = React.useState<Mode>("boot")
  const [bootStep, setBootStep] = React.useState(0)
  const [index, setIndex] = React.useState(0)

  const [messages, setMessages] = React.useState<Message[]>([GREETING])
  const [input, setInput] = React.useState("")
  const [streaming, setStreaming] = React.useState(false)
  const abortRef = React.useRef<AbortController | null>(null)
  const logRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Drive the boot from a timer — every state write happens inside async
  // callbacks, and the interval dies with the component or the first skip.
  React.useEffect(() => {
    if (mode !== "boot") return
    if (reduceMotion) {
      const id = setTimeout(() => setMode("menu"), 0)
      return () => clearTimeout(id)
    }
    let step = 0
    let hold: ReturnType<typeof setTimeout> | undefined
    const tick = setInterval(() => {
      step += 1
      setBootStep(step)
      if (step >= BOOT_TOTAL) {
        clearInterval(tick)
        hold = setTimeout(() => setMode("menu"), BOOT_HOLD_MS)
      }
    }, BOOT_TICK_MS)
    return () => {
      clearInterval(tick)
      if (hold) clearTimeout(hold)
    }
  }, [mode, reduceMotion])

  const skipBoot = React.useCallback(() => setMode("menu"), [])

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
              {
                role: "assistant",
                content: data.error ?? "something broke — try again",
              },
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
    logRef.current?.scrollBy({ top: dir * 32, behavior: "smooth" })

  const onDpad = (dir: DpadDir) => {
    if (mode === "boot") skipBoot()
    else if (mode === "menu") {
      if (dir === "up" || dir === "down")
        setIndex((i) => (i + 1) % MENU.length) // two rows: either arrow flips
    } else if (dir === "up") scrollLog(-1)
    else if (dir === "down") scrollLog(1)
  }

  return (
    <ConsoleShell
      hero
      ledPulse={mode === "boot"}
      className={className}
      onDpad={onDpad}
      onA={mode === "boot" ? skipBoot : mode === "menu" ? choose : send}
      onB={mode === "chat" ? leaveChat : mode === "boot" ? skipBoot : () => setIndex(0)}
      aTitle={
        mode === "boot" ? "Skip" : mode === "menu" ? MENU[index].label : "Send"
      }
      bTitle={mode === "chat" ? "Back to menu" : "Back"}
      onCrankStep={(dir) =>
        mode === "boot"
          ? skipBoot()
          : mode === "menu"
            ? onDpad(dir === 1 ? "down" : "up")
            : scrollLog(dir)
      }
      crankLabel={
        mode === "chat"
          ? "Crank to scroll the conversation"
          : "Crank to move the cursor"
      }
      headerRight={
        <span className="font-mono text-[11px] tabular text-bone/60">
          {mode === "boot" ? "bios" : mode === "menu" ? "boot" : "mentor"}
        </span>
      }
      footer={
        mode === "boot" ? (
          <>
            <span>starting up</span>
            <span>Ⓐ skip</span>
          </>
        ) : mode === "menu" ? (
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
        mode === "boot" ? (
          // The whole screen is a skip target — theatre must never gate.
          <button
            type="button"
            aria-label="Skip the boot animation"
            onClick={skipBoot}
            className="block w-full cursor-pointer outline-none"
          >
            <BootScreen step={bootStep} />
          </button>
        ) : mode === "menu" ? (
          <div className="px-1.5 py-2 text-[14px] lg:px-2 lg:py-2.5 lg:text-[16px]">
            <p className="px-2 pb-2.5 text-[11px] leading-snug text-bone/60 lg:text-[12px]">
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
                    "flex w-full items-center gap-2.5 rounded-[2px] px-2 py-2 text-left font-[590] outline-none",
                    cursor ? "bg-bone text-void" : "text-bone/75 hover:text-bone"
                  )}
                >
                  <item.icon aria-hidden className="size-4" strokeWidth={2.25} />
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    <span
                      className={cn(
                        "block truncate text-[10px] font-normal lg:text-[11px]",
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
          <div className="flex h-[230px] flex-col text-[13px] lg:h-[270px] lg:text-[14px]">
            <div
              ref={logRef}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 py-2"
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
                  {streaming &&
                  i === messages.length - 1 &&
                  m.role === "assistant" ? (
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
              className="flex items-center gap-2 border-t border-bone/20 px-2.5 py-2"
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
