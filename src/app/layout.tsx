import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"

import { cn } from "@/lib/utils"
import "./globals.css"

/**
 * Variable Inter — omitting `weight` gives the variable font, which is what
 * makes the 510 and 590 weights available. Static Inter has neither, and both
 * are load-bearing in this design (see docs/DESIGN.md).
 *
 * next/font self-hosts these at build time, so there is no runtime request to
 * a font CDN and no silent fallback.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-jetbrains",
  display: "swap",
})

export const metadata: Metadata = {
  title: "SkillForge",
  description:
    "SkillForge reads your resume, measures every skill against the role you're chasing, and returns the shortest honest path to ready.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Dark-only by design. The `dark` class plus color-scheme keeps shadcn's
    // `dark:` variants and native form controls consistent.
    <html
      lang="en"
      className={cn("dark", inter.variable, jetbrains.variable)}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  )
}
