"use client"

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  Search,
  FileText,
  Gauge,
  Crosshair,
  CalendarRange,
  Dumbbell,
  TrendingUp,
  MessageCircle,
  Settings,
  Target,
  BookOpen,
  BadgeCheck,
  Newspaper,
  Sparkles,
  Lightbulb,
  Gamepad2,
  CornerDownLeft,
} from "lucide-react"
import { toast } from "sonner"

import { switchTargetRole } from "@/app/app/actions"
import { CONSOLE_SUMMON_EVENT } from "@/components/shell/console-dock"
import { cn } from "@/lib/utils"

/**
 * The ⌘K palette. Animation structure adapted from Spectrum UI's command
 * palette (spring entrance, layoutId active pill, reduced-motion aware);
 * visuals and commands are ours — Linear tokens, the workspace screens, and
 * instant role switching through the same server action the map uses.
 */

type Command = {
  id: string
  title: string
  description: string
  category: "Go to" | "Target role"
  icon: React.ReactNode
  action: () => void
}

const SPRING_FLUID = { type: "spring", stiffness: 300, damping: 30 } as const
const SPRING_IN = { type: "spring", stiffness: 260, damping: 22 } as const

const SCREENS: [string, string, string, React.ReactNode][] = [
  ["/app/intake", "Intake", "Upload and analyse a resume", <FileText key="i" className="size-4" />],
  ["/app/map", "Skill map", "Gauges, gaps and the role comparison", <Gauge key="m" className="size-4" />],
  ["/app/jobs", "Job targets", "Measure yourself against a real job posting", <Crosshair key="j" className="size-4" />],
  ["/app/roadmap", "Roadmap", "The 14-week plan, three lanes", <CalendarRange key="r" className="size-4" />],
  ["/app/practice", "Practice", "Ranked projects, certs and questions", <Dumbbell key="p" className="size-4" />],
  ["/app/progress", "Progress", "Readiness trend and what moved it", <TrendingUp key="g" className="size-4" />],
  ["/app/chat", "Mentor", "Chat grounded in your numbers", <MessageCircle key="c" className="size-4" />],
  ["/app/feed", "Feed", "Engineering news ranked against your open gaps", <Newspaper key="n" className="size-4" />],
  ["/app/certifications", "Certifications", "Weigh certifications against your budget", <BadgeCheck key="v" className="size-4" />],
  ["/app/studio", "Studio", "Ask a question, get an interface back", <Sparkles key="u" className="size-4" />],
  ["/app/understand", "Understand", "Paste notes or code, get a visual explanation", <Lightbulb key="l" className="size-4" />],
  ["/app/settings", "Settings", "Role, hours and profile", <Settings key="s" className="size-4" />],
  ["/benchmarks", "Benchmarks", "The published rubric every level is scored against", <BookOpen key="b" className="size-4" />],
]

export function CommandPalette({
  roles,
}: {
  roles: { id: string; name: string }[]
}) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery("")
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "console",
        title: "Open the console",
        description: "Navigate with the D-pad, A/B and the crank",
        category: "Go to" as const,
        icon: <Gamepad2 className="size-4" />,
        action: () => {
          setOpen(false)
          window.dispatchEvent(new CustomEvent(CONSOLE_SUMMON_EVENT))
        },
      },
      ...SCREENS.map(([href, title, description, icon]) => ({
        id: href,
        title,
        description,
        category: "Go to" as const,
        icon,
        action: () => {
          router.push(href)
          setOpen(false)
        },
      })),
      ...roles.map((role) => ({
        id: `role-${role.id}`,
        title: `Target ${role.name}`,
        description: "Re-measure everything against this role — instant, no re-upload",
        category: "Target role" as const,
        icon: <Target className="size-4" />,
        action: () => {
          setOpen(false)
          startTransition(async () => {
            const result = await switchTargetRole(role.id)
            if (result.ok) {
              toast.success(result.message)
              router.refresh()
            } else {
              toast.error(result.message)
            }
          })
        },
      })),
    ],
    [roles, router]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) =>
      `${c.title} ${c.description} ${c.category}`.toLowerCase().includes(q)
    )
  }, [commands, query])

  useEffect(() => setActive(0), [query])

  // Keyboard navigation while open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setActive((p) => (filtered.length ? (p + 1) % filtered.length : 0))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActive((p) =>
          filtered.length ? (p - 1 + filtered.length) % filtered.length : 0
        )
      } else if (e.key === "Enter") {
        e.preventDefault()
        filtered[active]?.action()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, filtered, active])

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [active])

  const grouped = useMemo(() => {
    const groups = new Map<string, Command[]>()
    for (const c of filtered) {
      groups.set(c.category, [...(groups.get(c.category) ?? []), c])
    }
    return [...groups.entries()]
  }, [filtered])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-md border border-graphite px-2.5 py-1.5 text-xs text-fog transition-colors hover:border-smoke hover:text-mist sm:inline-flex"
        aria-label="Open command palette"
      >
        <Search className="size-3" aria-hidden />
        <kbd className="font-mono text-xs">⌘K</kbd>
      </button>

      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.15 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-void/60 backdrop-blur-[2px]"
            />

            <motion.div
              initial={{ opacity: 0, y: -14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={reduceMotion ? { duration: 0 } : SPRING_IN}
              className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-carbon shadow-[inset_0_0_0_1px_#23252a,rgba(8,9,10,0.6)_0_4px_32px_0]"
              role="dialog"
              aria-label="Command palette"
            >
              <div className="flex items-center gap-3 border-b border-graphite px-4 py-3">
                <Search className="size-4 shrink-0 text-ash" aria-hidden />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Where to, or which role…"
                  className="flex-1 bg-transparent text-sm text-mist outline-none placeholder:text-ash"
                />
                <kbd className="hidden rounded-sm border border-graphite px-1.5 font-mono text-xs text-ash sm:inline">
                  esc
                </kbd>
              </div>

              <div ref={listRef} className="max-h-[340px] overflow-y-auto p-2">
                {filtered.length === 0 ? (
                  <p className="py-10 text-center font-mono text-xs text-ash">
                    Nothing matches &ldquo;{query}&rdquo;
                  </p>
                ) : (
                  grouped.map(([category, items]) => (
                    <div key={category} className="mb-2 last:mb-0">
                      <h4 className="t-micro px-3 py-1.5">{category}</h4>
                      {items.map((item) => {
                        const index = filtered.indexOf(item)
                        const isActive = index === active
                        return (
                          <div
                            key={item.id}
                            data-index={index}
                            onClick={item.action}
                            onMouseEnter={() => setActive(index)}
                            className={cn(
                              "relative z-10 flex cursor-pointer items-center justify-between rounded-md px-3 py-2 select-none",
                              isActive ? "text-paper" : "text-fog"
                            )}
                          >
                            {isActive ? (
                              <motion.div
                                layoutId="palette-active"
                                className="absolute inset-0 -z-10 rounded-md bg-white/5"
                                transition={
                                  reduceMotion ? { duration: 0 } : SPRING_FLUID
                                }
                              />
                            ) : null}
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className={cn(
                                  "shrink-0",
                                  isActive ? "text-mist" : "text-ash"
                                )}
                              >
                                {item.icon}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm leading-tight">
                                  {item.title}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-ash">
                                  {item.description}
                                </span>
                              </span>
                            </div>
                            {isActive ? (
                              <CornerDownLeft
                                className="ml-3 size-3 shrink-0 text-ash"
                                aria-hidden
                              />
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between border-t border-graphite bg-white/[0.02] px-4 py-2 font-mono text-xs text-ash">
                <span>↑↓ navigate · enter select</span>
                <span>SkillForge</span>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
