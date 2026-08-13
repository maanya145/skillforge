/**
 * Whether Clerk has been provisioned yet.
 *
 * Before `vercel install clerk` runs, the public marketing page must still
 * render. Everything behind auth fails CLOSED — the app layout renders a setup
 * notice and reads no data — so a missing key can never ship as an
 * unprotected route.
 *
 * Deliberately its own module with no imports: `proxy.ts` runs in a constrained
 * runtime and should not pull in the Clerk server SDK just to read two vars.
 */
export const isClerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
)
