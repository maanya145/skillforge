import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Linear buttons: 6px radius, weight 510, tight tracking, elevation from
 * hairline borders rather than shadows.
 *
 * `lime` is the single chromatic action in the system — at most ONE per view.
 * `default` is deliberately the neutral hairline button, so anything that
 * renders a Button without choosing a variant still lands inside the system.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-clip-padding text-sm font-[510] tracking-[-0.011em] whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** Neutral hairline — secondary actions, and the safe fallback */
        default: "border-graphite text-mist hover:border-smoke hover:text-paper",
        /** The one primary action. Never more than one per view. */
        lime: "bg-acid-lime text-void shadow-lime hover:bg-[#eef84a]",
        /** High-emphasis neutral — nav sign-up, closing CTA */
        pill: "rounded-full bg-paper text-void hover:bg-bone",
        /** Explicit alias of default, for readability at call sites */
        outline:
          "border-graphite text-mist hover:border-smoke hover:text-paper",
        /** Chromeless */
        ghost: "text-mist hover:bg-white/5 hover:text-paper",
        /** Top-nav item — pure typographic, 13px */
        nav: "px-3 text-[13px] font-normal text-mist hover:text-paper",
        /** Tinted neutral surface */
        secondary: "bg-white/5 text-mist hover:bg-white/[0.08] hover:text-paper",
        /** Rare; kept so Radix-driven components can opt in */
        destructive: "bg-coral-red/10 text-coral-red hover:bg-coral-red/20",
        link: "text-mist underline-offset-4 hover:text-paper hover:underline",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-10 px-5",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
