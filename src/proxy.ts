import { NextResponse } from "next/server"
import { clerkMiddleware } from "@clerk/nextjs/server"

/**
 * Next 16 renamed `middleware.ts` to `proxy.ts`; the export must be the
 * default export or named `proxy`.
 *
 * This file deliberately contains NO auth checks. Clerk deprecated
 * `createRouteMatcher` because middleware path matching can diverge from how
 * Next.js actually routes a request, leaving protected resources reachable.
 * Protection lives on the resource instead — `await auth.protect()` in
 * src/app/(app)/layout.tsx and in every route handler and server action.
 *
 * `clerkMiddleware()` is still required: it populates the auth context that
 * `auth()` reads downstream. Keep the matcher.
 */
// Inlined rather than imported from @/lib/auth-config: the proxy runs in a
// constrained runtime where the `@/` path alias is not resolved.
const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
)

export default clerkConfigured ? clerkMiddleware() : () => NextResponse.next()

export const config = {
  matcher: [
    // Everything except Next internals and static assets
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Required, or auth() returns null inside route handlers
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
}
