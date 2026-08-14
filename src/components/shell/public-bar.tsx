import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Container } from "@/components/shell/section"
import { Wordmark } from "@/components/shell/logo"

/**
 * Top bar for pages a signed-out visitor can land on directly — a shared
 * report, the public benchmark. Deliberately not `SiteNav`: that one's links
 * are anchors into the landing page and would dead-end here.
 */
export function PublicBar({ cta }: { cta?: { href: string; label: string } }) {
  return (
    <header className="sticky top-0 z-50 border-b border-graphite bg-void/70 backdrop-blur-md">
      <Container className="flex h-14 items-center justify-between gap-6">
        <Link href="/" aria-label="SkillForge home">
          <Wordmark />
        </Link>
        <Button variant="pill" size="sm" asChild>
          <Link href={cta?.href ?? "/sign-up"}>
            {cta?.label ?? "Measure your own resume"}
          </Link>
        </Button>
      </Container>
    </header>
  )
}
