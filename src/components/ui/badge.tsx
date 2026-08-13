import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Linear badge: 4px radius, 12px text, weight 400, a 5px status dot when the
 * variant carries meaning. Chromatic fills are reserved for status — they are
 * NOT the accent, and acid lime never appears here except on `lime`, which
 * marks a recommendation the system is actively endorsing.
 */
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-sm border border-transparent px-1.5 py-px text-xs leading-[1.7] font-normal whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        /** Neutral metadata — the default and by far the most common */
        default: "bg-white/5 text-fog",
        /** Structural outline, no fill */
        outline: "border-graphite text-fog",
        /** On track / met / done */
        ok: "bg-white/5 text-pulse-green",
        /** Blocking / gap track / at risk */
        err: "bg-white/5 text-coral-red",
        /** Category or track label */
        tag: "bg-white/5 text-iris-violet",
        /** Secondary category */
        alt: "bg-white/5 text-lavender",
        /** Informational */
        info: "bg-white/5 text-signal-teal",
        /** Endorsed — the one place the accent is allowed inside data */
        lime: "bg-white/5 text-acid-lime",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

/** The 5px status dot used inside meaningful badges. */
function BadgeDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-[5px] shrink-0 rounded-full bg-current", className)}
    />
  )
}

export { Badge, BadgeDot, badgeVariants }
