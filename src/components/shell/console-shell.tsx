"use client"

import * as React from "react"
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion"

import { cn } from "@/lib/utils"

/**
 * The physical handheld, with no opinion about what its screen shows.
 *
 * Chassis only: tilt, body, glass, D-pad, A/B, crank. Consumers supply the
 * screen contents and receive the inputs as callbacks — the workspace device
 * renders a nav menu, the landing hero renders a boot menu and a chat. Split
 * out so "what the console does" can vary without ever re-deriving how the
 * plastic behaves.
 *
 * The 3D is honest about being CSS: a perspective container, spring-driven
 * rotateX/rotateY following the pointer, and depth built from translateZ
 * layers — body slab, recessed screen, raised controls, and a specular sheen
 * that tracks the tilt so the shell reads as lit rather than painted.
 */

/** Degrees of crank rotation that fire one step. */
const DEGREES_PER_STEP = 40
/** Max tilt, degrees. Enough to feel held; short of feeling seasick. */
const TILT = 9

export type DpadDir = "up" | "down" | "left" | "right"

export function ConsoleShell({
  screen,
  footer,
  headerRight,
  onDpad,
  onA,
  onB,
  aTitle,
  bTitle = "Back",
  onCrankStep,
  crankLabel = "Crank",
  crankValue,
  hero = false,
  className,
}: {
  /** What shows inside the glass. Keep it 1-bit: bone on void, nothing else. */
  screen: React.ReactNode
  /** Hint bar under the screen. */
  footer?: React.ReactNode
  /** Right slot of the screen's title bar. */
  headerRight?: React.ReactNode
  onDpad: (dir: DpadDir) => void
  onA: () => void
  onB: () => void
  aTitle: string
  bTitle?: string
  onCrankStep: (dir: 1 | -1) => void
  crankLabel?: string
  /** aria-valuetext for the crank, when it maps onto something nameable. */
  crankValue?: { min: number; max: number; now: number; text: string }
  /** Larger cut for the landing hero, where it stands in for product photography. */
  hero?: boolean
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const [angle, setAngle] = React.useState(0)
  const [pressed, setPressed] = React.useState<string | null>(null)

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
  const sheen = useTransform(
    [sheenX, sheenY],
    ([x, y]) =>
      `radial-gradient(340px circle at ${x} ${y}, rgba(255,255,255,0.08), transparent 62%)`
  )

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
  // -180°/180° seam does not jump by half a turn. `residual` keeps the
  // sub-step remainder, so slow cranking still advances instead of being
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
      onCrankStep(dir as 1 | -1)
    }
  }

  function onCrankUp(e: React.PointerEvent<HTMLDivElement>) {
    cranking.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  /** Arrow-key parity with the D-pad — except while typing in a field. */
  function onKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return
    const dir = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    }[e.key] as DpadDir | undefined
    if (dir) {
      e.preventDefault()
      onDpad(dir)
    }
  }

  return (
    <div
      className={cn(
        "relative select-none",
        hero ? "w-[300px] sm:w-[340px]" : "w-[264px]",
        className
      )}
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
            "relative rounded-[16px]", // check-design-ignore -- moulded corner
            hero ? "p-5" : "p-4",
            "bg-[linear-gradient(172deg,#1d1f22_0%,#141517_52%,#0c0d0e_100%)]",
            "shadow-[0_1px_0_rgba(255,255,255,0.09)_inset,0_-2px_0_rgba(0,0,0,0.5)_inset,0_18px_40px_rgba(0,0,0,0.55)]"
          )}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Specular sheen tracking the tilt. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[16px] opacity-70" // check-design-ignore
            style={{ background: sheen, transform: "translateZ(5px)" }}
          />

          {/* Power LED — lit because the screen is. */}
          <span
            aria-hidden
            className="absolute top-3 right-3.5 size-1.5 rounded-full bg-pulse-green shadow-[0_0_6px_rgba(39,166,68,0.9)]"
          />

          {/* ── Screen, recessed into the shell ─────────────────────────── */}
          <div
            className="rounded-sm bg-black p-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.7)_inset]"
            // The recessed look comes from the bezel and inset shadow, NOT a
            // negative z: behind the body's opaque face, a child does not
            // render at all. Slightly proud, below the controls.
            style={{ transform: "translateZ(4px)" }}
          >
            <div className="relative overflow-hidden rounded-[2px] bg-void">
              {/* Glass: a fixed diagonal glare so the surface reads as glazed. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(115deg,rgba(255,255,255,0.05)_0%,transparent_38%)]"
              />

              <div className="flex items-center justify-between border-b border-bone/20 px-2.5 py-1.5">
                <span className="text-[10px] font-[590] tracking-[0.14em] text-bone uppercase">
                  skillforge
                </span>
                {headerRight}
              </div>

              {screen}

              {footer ? (
                <div className="flex items-center justify-between border-t border-bone/20 px-2.5 py-1 text-[9px] font-[590] text-bone/60 uppercase">
                  {footer}
                </div>
              ) : null}
            </div>
          </div>

          {/* ── Controls, standing proud of the face ─────────────────────── */}
          <div
            className={cn(
              "flex items-center justify-between px-0.5",
              hero ? "mt-5" : "mt-4"
            )}
            style={{ transform: "translateZ(12px)", transformStyle: "preserve-3d" }}
          >
            <DPad onDpad={onDpad} pressed={pressed} setPressed={setPressed} hero={hero} />

            <div className={cn("flex items-end", hero ? "gap-3" : "gap-2.5")}>
              <FaceButton label="B" title={bTitle} onPress={onB} hero={hero} />
              <FaceButton label="A" title={aTitle} onPress={onA} hero={hero} />
            </div>
          </div>

          {/* ── Crank ───────────────────────────────────────────────────── */}
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
            aria-label={crankLabel}
            aria-valuemin={crankValue?.min}
            aria-valuemax={crankValue?.max}
            aria-valuenow={crankValue?.now}
            aria-valuetext={crankValue?.text}
            className={cn(
              "absolute top-1/2 cursor-grab touch-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mist active:cursor-grabbing",
              hero ? "-right-9 size-16" : "-right-8 size-14"
            )}
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

/** One D-pad hit target. Hoisted so it is not remounted on every state change. */
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
 * The D-pad: one cross clipped out of a raised slab, four hit targets over it.
 * The cross tips toward whichever arm is pressed — the rocking a real pad does.
 */
function DPad({
  onDpad,
  pressed,
  setPressed,
  hero,
}: {
  onDpad: (dir: DpadDir) => void
  pressed: string | null
  setPressed: (d: string | null) => void
  hero: boolean
}) {
  const arm = hero ? "21px" : "17px"
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
    <div
      className={cn("relative", hero ? "size-[64px]" : "size-[52px]")}
      style={{ perspective: "300px" }}
    >
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
      {(
        [
          ["up", "D-pad up", "top-0 left-1/3 h-1/3 w-1/3"],
          ["down", "D-pad down", "bottom-0 left-1/3 h-1/3 w-1/3"],
          ["left", "D-pad left", "top-1/3 left-0 h-1/3 w-1/3"],
          ["right", "D-pad right", "top-1/3 right-0 h-1/3 w-1/3"],
        ] as const
      ).map(([dir, label, pos]) => (
        <DPadButton
          key={dir}
          label={label}
          dir={dir}
          onPress={() => onDpad(dir)}
          pressed={pressed}
          setPressed={setPressed}
          className={pos}
        />
      ))}
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
  hero,
}: {
  label: string
  title: string
  onPress: () => void
  hero: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onPress}
      className={cn(
        "grid place-items-center rounded-full text-xs font-[590] text-mist",
        hero ? "size-11" : "size-9",
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
