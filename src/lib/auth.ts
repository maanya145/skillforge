import "server-only"

import { auth } from "@clerk/nextjs/server"

import { isClerkConfigured } from "@/lib/auth-config"

/**
 * Resource-based auth check. Call this at the top of every protected page,
 * route handler and server action — Clerk deprecated middleware path matching
 * because it can diverge from how Next.js routes a request.
 *
 * `auth.protect()` redirects document requests to sign-in, returns 401 for
 * Server Actions and 404 for other non-document requests.
 *
 * Before Clerk is provisioned it returns null instead of throwing. That is not
 * fail-open: src/app/app/layout.tsx renders the setup notice in place of the
 * whole subtree, and every data accessor goes through `requireUserId()` below,
 * which throws when there is no session.
 */
export async function requireAuth(): Promise<string | null> {
  if (!isClerkConfigured) return null
  const { userId } = await auth.protect()
  return userId
}

/**
 * The hard gate for anything that touches student data. Unlike `requireAuth`
 * this never degrades — no session or no Clerk means no data, ever.
 */
export async function requireUserId(): Promise<string> {
  if (!isClerkConfigured) {
    throw new Error(
      "Auth is not configured. Run `vercel install clerk` and `vercel env pull .env.local`."
    )
  }
  const { userId } = await auth()
  if (!userId) throw new Error("Not signed in.")
  return userId
}
