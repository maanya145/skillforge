"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion"

import { cn } from "@/lib/utils"
import { WORKSPACE_NAV, type SidebarItem } from "@/components/shell/app-sidebar"

/**
 * The handheld — black edition.
 *
 * A pocket console that navigates the workspace: the D-pad moves the
 * selection, A opens it, B goes back, and the crank on the right edge scrolls
 * the menu the way the real thing does. Interaction model ported from the
 * `playdate` worktree's device; the body is re-cut for this design system —
 * obsidian shell, 1-bit void/bone screen, one green power LED — because a
 * sunbeam-yellow toy belongs to that branch's light theme, not this one.
 *
 * The 3D is honest about being CSS: a perspective container, spring-driven
 * rotateX/rotateY following the pointer, and depth built from translateZ
 * layers — body slab, recessed screen, raised controls, and a specular sheen
 * that tracks the tilt so the plastic reads as lit rather than painted.
 *
 * Two rules carried over unchanged:
 *
 *  1. It is never the only way to reach a screen. Sidebar, tab strip and ⌘K
 *     all still work, and every row on the screen is an ordinary tabbable
 *     <a>. The D-pad and crank drive a VISUAL cursor over those links — an
 *     affordance layered on top of working navigation, not a custom widget
 *     standing in for it. No listbox role: a contract this would not honour
 *     is worse than no contract.
 *  2. The screen is 1-bit on purpose — bone on void, inverted for the cursor
 *     row, no greys inside the glass. That constraint is what makes it read
 *     as a device screen rather than a styled dropdown.
 */

/** Degrees of crank rotation that advance the selection by one row. */
const DEGREES_PER_STEP = 40
/** Rows visible in the screen viewport at once. */
const WINDOW = 5
/** Max tilt, degrees. Enough to feel held; short of feeling seasick. */
const TILT = 9

export function ConsoleDevice({
  items = WORKSPACE_NAV,
  current,
  className,
}: {
  items?: SidebarItem[]
  /** Pathname of the active route: seeds the cursor and marks the current row. */
  current?: string
  className?: string
}) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()

  const initial = Math.max(
    0,
    items.findIndex((i) => current && current.startsWith(i.href))
  )
  const [index, setIndex] = React.useState(initial)
  const [angle, setAngle] = React.useState(0)
  const [pressed, setPressed] = React.useState<string | null>(null)

  const move = React.useCallback(
    (delta: number) =>
      setIndex((i) => (i + delta + items.length) % items.length),
    [items.length]
  )

  const open = React.useCallback(
    () => router.push(items[index].href),
    [router, items, index]
  )

  // ── Tilt ────────────────────────────────────────────────────────────────
  // Normalised pointer position over the device, sprung so the tilt lags the
  // hand slightly — that lag is most of what makes it feel like an object.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const spring = { stiffness: 160, damping: 18, mass: 0.6 }
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-TILT, TILT]), spring)
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [TILT, -TILT]), spring)
  // The sheen slides opposite the tilt, like a light source staying put.
  const sheenX = useTransform(rotateY, [-TILT, TILT], ["68%", "32%"])
  const sheenY = useTransform(rotateX, [-TILT, TILT], ["30%", "62%"])

  function onTiltMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduceMotion || cranking.current) return
    const box = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - box.left) / box.width - 0.5)
    py.set((e.clientY - box.top) / box.height - 0.5)
  }

  function onTiltLeave() {
    px.set(0)
    py.set(0)
  }

  // ── Crank ───────────────────────────────────────────────────────────────
  // Pointer angle around the pivot, accumulated so a sweep across the
  // -180°/180° seam does not jump the menu by half the list. `residual` holds
  // the sub-step remainder, so slow cranking still advances instead of being
  // rounded away to nothing.
  const cranking = React.useRef<{
    pivot: { x: number; y: number }
    last: number
    residual: number
  } | null>(null)

  const angleFrom = (pivot: { x: number; y: number }, e: React.PointerEvent) =>
    (Math.atan2(e.clientY - pivot.y, e.clientX - pivot.x) * 180) / Math.PI

  function onCrankDown(e: React.PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const pivot = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    cranking.current = { pivot, last: angleFrom(pivot, e), residual: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onCrankMove(e: React.PointerEvent<HTMLDivElement>) {
    const state = cranking.current
    if (!state) return
    const now = angleFrom(state.pivot, e)
    // Unwrap across the seam: a jump larger than half a turn is the seam, not
    // a genuine 300° flick of the wrist.
    let delta = now - state.last
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    state.last = now

    setAngle((a) => a + delta)
    state.residual += delta
    while (Math.abs(state.residual) >= DEGREES_PER_STEP) {
      const dir = state.residual > 0 ? 1 : -1
      state.residual -= dir * DEGREES_PER_STEP
      move(dir)
    }
  }

  function onCrankUp(e: React.PointerEvent<HTMLDivElement>) {
    cranking.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  /** Arrow-key parity with the D-pad, for anyone focused inside the device. */
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      move(1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      move(-1)
    } else if (e.key === "Home") {
      e.preventDefault()
      setIndex(0)
    } else if (e.key === "End") {
      e.preventDefault()
      setIndex(items.length - 1)
    }
  }

  // Window the list so the cursor stays visible without the menu paging
  // wholesale at either end.
  const start = Math.max(0, Math.min(index - 2, items.length - WINDOW))
  const visible = items.slice(start, start + WINDOW)

  return (
    <div
      className={cn("relative w-[264px] select-none", className)}
      style={{ perspective: "900px" }}
      onPointerMove={onTiltMove}
      onPointerLeave={onTiltLeave}
      onKeyDown={onKeyDown}
    >
      <motion.div
        style={{
          rotateX: reduceMotion ? 0 : rotateX,
          rotateY: reduceMotion ? 0 : rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative"
      >
        {/* Thickness: a darker slab offset behind the face. Cheap, but at
            ±9° it is exactly what an edge-on plastic shell looks like. */}
        <span
          aria-hidden
          // Physical device body: 16px is its moulded corner, deliberately
          // outside the UI radius vocabulary.
          className="absolute inset-0 rounded-[16px] bg-void" // check-design-ignore
          style={{ transform: "translateZ(-14px) scale(1.015)" }}
        />

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "relative rounded-[16px] p-4", // check-design-ignore -- moulded corner
            "bg-[linear-gradient(172deg,#1d1f22_0%,#141517_52%,#0c0d0e_100%)]",
            "shadow-[0_1px_0_rgba(255,255,255,0.09)_inset,0_-2px_0_rgba(0,0,0,0.5)_inset,0_18px_40px_rgba(0,0,0,0.55)]"
          )}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Specular sheen tracking the tilt. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[16px] opacity-70" // check-design-ignore
            style={{
              background: useTransform(
                [sheenX, sheenY],
                ([x, y]) =>
                  `radial-gradient(340px circle at ${x} ${y}, rgba(255,255,255,0.08), transparent 62%)`
              ),
            }}
          />

          {/* Power LED — lit because the screen is. */}
          <span
            aria-hidden
            className="absolute top-3 right-3.5 size-1.5 rounded-full bg-pulse-green shadow-[0_0_6px_rgba(39,166,68,0.9)]"
          />

          {/* ── Screen, recessed into the shell ──────────────────────────── */}
          <div
            className="rounded-sm bg-black p-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.7)_inset]"
            style={{ transform: "translateZ(-6px)" }}
          >
            <div className="relative overflow-hidden rounded-[2px] bg-void">
              {/* Glass: a fixed diagonal glare so the surface reads as glazed. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.05)_0%,transparent_38%)]"
              />

              <div className="flex items-center justify-between border-b border-bone/20 px-2.5 py-1.5">
                <span className="text-[10px] font-[590] tracking-[0.14em] text-bone uppercase">
                  skillforge
                </span>
                <span className="font-mono text-[10px] tabular text-bone/60">
                  {index + 1}/{items.length}
                </span>
              </div>

              <nav aria-label="Console menu">
                <ul className="px-1 py-1 text-[11px]">
                  {visible.map((item, row) => {
                    const i = start + row
                    const cursor = i === index
                    const here = current?.startsWith(item.href)
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={here ? "page" : undefined}
                          onMouseEnter={() => setIndex(i)}
                          onFocus={() => setIndex(i)}
                          className={cn(
                            "flex items-center gap-2 rounded-[2px] px-1.5 py-1 font-[590] outline-none",
                            // 1-bit: the cursor row inverts. No tint, no ring.
                            cursor
                              ? "bg-bone text-void"
                              : "text-bone/75 hover:text-bone"
                          )}
                        >
                          <item.icon
                            aria-hidden
                            className="size-3"
                            strokeWidth={2.25}
                          />
                          <span className="truncate">{item.label}</span>
                          {cursor ? (
                            <span aria-hidden className="ml-auto">
                              ▸
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>

              <div className="flex items-center justify-between border-t border-bone/20 px-2.5 py-1 text-[9px] font-[590] text-bone/60 uppercase">
                <span>↑↓ move</span>
                <span>Ⓐ open · Ⓑ back</span>
              </div>
            </div>
          </div>

          {/* ── Controls, standing proud of the face ─────────────────────── */}
          <div
            className="mt-4 flex items-center justify-between px-0.5"
            style={{ transform: "translateZ(12px)", transformStyle: "preserve-3d" }}
          >
            <DPad
              onStep={move}
              onEnd={(edge) => setIndex(edge === "first" ? 0 : items.length - 1)}
              pressed={pressed}
              setPressed={setPressed}
            />

            <div className="flex items-end gap-2.5">
              <FaceButton
                label="B"
                title="Back"
                onPress={() => router.back()}
              />
              <FaceButton
                label="A"
                title={`Open ${items[index].label}`}
                onPress={open}
              />
            </div>
          </div>

          {/* ── Crank ────────────────────────────────────────────────────── */}
          {/* The dock nub: carries the shell's gradient past the right edge so
              the crank reads as MOUNTED, not floating beside the device. */}
          <span
            aria-hidden
            className="absolute top-1/2 -right-2.5 h-12 w-3 -translate-y-1/2 rounded-r-[5px] bg-[linear-gradient(180deg,#1d1f22_0%,#141517_55%,#0c0d0e_100%)] shadow-[2px_0_4px_rgba(0,0,0,0.5)]"
          />
          <div
            onPointerDown={onCrankDown}
            onPointerMove={onCrankMove}
            onPointerUp={onCrankUp}
            onPointerCancel={onCrankUp}
            role="slider"
            tabIndex={0}
            aria-label="Crank to scroll the menu"
            aria-valuemin={1}
            aria-valuemax={items.length}
            aria-valuenow={index + 1}
            aria-valuetext={items[index].label}
            className="absolute top-1/2 -right-8 size-14 cursor-grab touch-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mist active:cursor-grabbing"
            style={{ transform: "translateY(-50%) translateZ(18px)" }}
          >
            <div
              className="relative size-full"
              style={{
                transform: `rotate(${angle}deg)`,
                transition: reduceMotion ? undefined : "transform 60ms linear",
              }}
            >
              {/* Arm, handle at its far end, pivot cap on top. Bone against
                  the dark shell — the one bright mechanical part. */}
              <span className="absolute top-1/2 left-1/2 h-1 w-1/2 origin-left -translate-y-1/2 rounded-full bg-bone shadow-[0_2px_3px_rgba(0,0,0,0.6)]" />
              <span className="absolute top-1/2 right-0 h-5 w-1.5 -translate-y-1/2 rounded-full bg-bone shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
              <span className="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-smoke shadow-[0_1px_0_rgba(255,255,255,0.15)_inset]" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/** One D-pad hit target. Hoisted so it is not remounted on every cursor move. */
function DPadButton({
  label,
  dir,
  onPress,
  pressed,
  setPressed,
  className,
}: {
  label: string
  dir: string
  onPress: () => void
  pressed: string | null
  setPressed: (d: string | null) => void
  className: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      onPointerDown={() => setPressed(dir)}
      onPointerUp={() => setPressed(null)}
      onPointerLeave={() => setPressed(null)}
      className={cn(
        "absolute rounded-[3px]",
        pressed === dir && "bg-white/10",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-mist",
        className
      )}
    />
  )
}

/**
 * The D-pad: one cross clipped out of a raised slab, with four hit targets
 * over it. Up and down step the cursor; left and right jump to the ends, the
 * closest useful meaning for a horizontal axis in a vertical list. The cross
 * tips toward whichever arm is pressed — the rocking a real pad does.
 */
function DPad({
  onStep,
  onEnd,
  pressed,
  setPressed,
}: {
  onStep: (delta: number) => void
  onEnd: (edge: "first" | "last") => void
  pressed: string | null
  setPressed: (d: string | null) => void
}) {
  const arm = "17px"
  const rock =
    pressed === "up"
      ? "rotateX(8deg)"
      : pressed === "down"
        ? "rotateX(-8deg)"
        : pressed === "left"
          ? "rotateY(-8deg)"
          : pressed === "right"
            ? "rotateY(8deg)"
            : ""

  return (
    <div className="relative size-[52px]" style={{ perspective: "300px" }}>
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,#33363b_0%,#232529_60%,#191b1e_100%)] transition-transform duration-75"
        style={{
          transform: rock || undefined,
          filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.55))",
          clipPath: `polygon(
            ${arm} 0, calc(100% - ${arm}) 0, calc(100% - ${arm}) ${arm},
            100% ${arm}, 100% calc(100% - ${arm}), calc(100% - ${arm}) calc(100% - ${arm}),
            calc(100% - ${arm}) 100%, ${arm} 100%, ${arm} calc(100% - ${arm}),
            0 calc(100% - ${arm}), 0 ${arm}, ${arm} ${arm}
          )`,
        }}
      />
      <DPadButton
        label="Previous menu item"
        dir="up"
        onPress={() => onStep(-1)}
        pressed={pressed}
        setPressed={setPressed}
        className="top-0 left-1/3 h-1/3 w-1/3"
      />
      <DPadButton
        label="Next menu item"
        dir="down"
        onPress={() => onStep(1)}
        pressed={pressed}
        setPressed={setPressed}
        className="bottom-0 left-1/3 h-1/3 w-1/3"
      />
      <DPadButton
        label="First menu item"
        dir="left"
        onPress={() => onEnd("first")}
        pressed={pressed}
        setPressed={setPressed}
        className="top-1/3 left-0 h-1/3 w-1/3"
      />
      <DPadButton
        label="Last menu item"
        dir="right"
        onPress={() => onEnd("last")}
        pressed={pressed}
        setPressed={setPressed}
        className="top-1/3 right-0 h-1/3 w-1/3"
      />
    </div>
  )
}

/**
 * A face button: a moulded dome that travels DOWN in z when pressed, losing
 * its drop shadow as it bottoms out — depth doing the work a color change
 * would otherwise fake.
 */
function FaceButton({
  label,
  title,
  onPress,
}: {
  label: string
  title: string
  onPress: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onPress}
      className={cn(
        "grid size-9 place-items-center rounded-full text-xs font-[590] text-mist",
        "bg-[radial-gradient(circle_at_35%_30%,#3a3d42_0%,#232529_55%,#17181b_100%)]",
        "shadow-[0_3px_0_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.12)_inset]",
        "transition-transform duration-75 active:translate-y-[3px] active:shadow-[0_0_0_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.08)_inset]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mist"
      )}
    >
      {label}
    </button>
  )
}
