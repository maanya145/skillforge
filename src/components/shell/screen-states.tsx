"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Container } from "@/components/shell/section"

/**
 * Route-level error boundary body. Every workspace screen gets one so a failed
 * query shows a recovery path instead of Next's default error page — and so a
 * single broken screen never takes the whole workspace down.
 */
export function ScreenError({
  error,
  reset,
  screen,
}: {
  error: Error & { digest?: string }
  reset: () => void
  screen: string
}) {
  useEffect(() => {
    console.error(`[${screen}]`, error)
  }, [error, screen])

  return (
    <Container className="py-16">
      <div className="flex max-w-[52ch] flex-col items-start gap-4">
        <span className="t-micro">Something broke</span>
        <h1 className="text-heading-sm">This screen didn&rsquo;t load.</h1>
        <p className="text-body-sm text-fog">
          The rest of the app is fine — only {screen} failed. Try again, and if
          it keeps happening your analysis may need re-running from Intake.
        </p>
        <div className="flex gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="ghost" asChild>
            <a href="/app/map">Go to skill map</a>
          </Button>
        </div>
      </div>
    </Container>
  )
}
