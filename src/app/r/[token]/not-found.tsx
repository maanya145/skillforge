import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Container, SectionHead } from "@/components/shell/section"
import { PublicBar } from "@/components/shell/public-bar"

/**
 * Shown for unknown *and* revoked links alike — the page must not reveal that a
 * token was once valid.
 */
export default function SharedReportNotFound() {
  return (
    <>
      <PublicBar />
      <main className="py-24">
        <Container>
          <SectionHead eyebrow="404" title="This report isn't available">
            The link may have expired, been revoked by the person who shared it,
            or been copied incompletely. Ask them for a fresh one.
          </SectionHead>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="pill" size="sm" asChild>
              <Link href="/sign-up">Measure your own resume</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/benchmarks">See the benchmarks</Link>
            </Button>
          </div>
        </Container>
      </main>
    </>
  )
}
