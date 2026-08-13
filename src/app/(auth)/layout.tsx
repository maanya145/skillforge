import Link from "next/link"
import { ClerkProvider } from "@clerk/nextjs"

import { isClerkConfigured } from "@/lib/auth-config"
import { Wordmark } from "@/components/shell/logo"
import { SetupNotice } from "@/components/shell/setup-notice"

/**
 * Sign-in and sign-up share this shell. ClerkProvider is scoped here and to the
 * app layout rather than the root, so the public marketing page renders without
 * an auth context — and, before provisioning, renders at all.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  if (!isClerkConfigured) return <SetupNotice />

  return (
    <ClerkProvider>
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
        <Link href="/" aria-label="SkillForge home">
          <Wordmark />
        </Link>
        {children}
      </div>
    </ClerkProvider>
  )
}
