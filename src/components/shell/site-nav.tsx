import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Container } from "@/components/shell/section"
import { Wordmark } from "@/components/shell/logo"

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#measure", label: "Skill map" },
  { href: "#plan", label: "Roadmap" },
  { href: "#colleges", label: "For colleges" },
]

/** Marketing top bar: wordmark left, typographic links right, white pill CTA. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-graphite bg-void/70 backdrop-blur-md">
      <Container className="flex h-14 items-center justify-between gap-6">
        <Link href="/" aria-label="SkillForge home">
          <Wordmark />
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Button key={l.href} variant="nav" size="sm" asChild>
              <Link href={l.href}>{l.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="nav" size="sm" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button variant="pill" size="sm" asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </Container>
    </header>
  )
}
