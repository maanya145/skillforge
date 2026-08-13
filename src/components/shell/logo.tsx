import { cn } from "@/lib/utils"

/**
 * The mark: a hairline square with a rising path breaking out of the top-right
 * corner — the gap being closed, which is the product's whole thesis.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <rect
        x="0.5"
        y="0.5"
        width="15"
        height="15"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.45"
      />
      <path
        d="M3.5 12 L6.8 6.6 L9.4 9.2 L12.5 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-base font-[510] tracking-[-0.011em] text-paper",
        className
      )}
    >
      <LogoMark />
      SkillForge
    </span>
  )
}
