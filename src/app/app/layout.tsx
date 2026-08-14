import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { ClerkProvider, UserButton } from "@clerk/nextjs"

import { isClerkConfigured } from "@/lib/auth-config"
import { listRoles } from "@/lib/students"
import { Toaster } from "@/components/ui/sonner"
import { CommandPalette } from "@/components/shell/command-palette"
import { ConsoleDock } from "@/components/shell/console-dock"
import { Container } from "@/components/shell/section"
import { Wordmark } from "@/components/shell/logo"
import { SetupNotice } from "@/components/shell/setup-notice"

/**
 * Never prerender or cache anything behind auth. Clerk's `auth()` opts a route
 * into dynamic rendering on its own once configured, but before provisioning
 * these pages would otherwise be collected as static — and a statically cached
 * protected route is exactly the bug worth spending one line to prevent.
 */
export const dynamic = "force-dynamic"

/**
 * Every authenticated screen sits under this layout.
 *
 * `auth.protect()` is the resource-based check Clerk recommends in place of
 * middleware path matching: it redirects document requests to sign-in, returns
 * 401 for Server Actions and 404 for other non-document requests. Route
 * handlers and server actions call it again themselves — this layout does not
 * cover them.
 */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  if (!isClerkConfigured) {
    // Fail closed: render the setup notice and read nothing.
    return <SetupNotice />
  }

  await auth.protect()
  const roles = await listRoles()

  return (
    <ClerkProvider>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 border-b border-graphite bg-void/70 backdrop-blur-md">
          <Container className="flex h-14 items-center justify-between gap-6">
            <Link href="/app/map" aria-label="SkillForge">
              <Wordmark />
            </Link>
            <div className="flex items-center gap-4">
              <CommandPalette
                roles={roles.map((r) => ({ id: r.id, name: r.name }))}
              />
              <UserButton
                appearance={{
                  elements: { avatarBox: "size-7 rounded-full" },
                }}
              />
            </div>
          </Container>
        </header>

        <main className="flex-1 py-8">
          <Container>{children}</Container>
        </main>
        <ConsoleDock />
        {/* Toasts sit above the dock's corner; keep them clear of the device. */}
        <Toaster position="bottom-left" />
      </div>
    </ClerkProvider>
  )
}
