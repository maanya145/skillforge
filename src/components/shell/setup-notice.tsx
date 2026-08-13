import { Container } from "@/components/shell/section"
import { AppFrame, AppBar, AppBody, Crumb } from "@/components/shell/frame"
import { Badge, BadgeDot } from "@/components/ui/badge"

const STEPS: [string, string][] = [
  ["vercel login", "Browser OAuth."],
  ["vercel link", "Pick the scope and confirm the project name."],
  [
    "vercel install neon --name skillforge-db --plan free",
    "Provisions Postgres and injects DATABASE_URL plus DATABASE_URL_UNPOOLED.",
  ],
  [
    "vercel install clerk --name skillforge-auth",
    "Hands off to Clerk's dashboard to pick sign-in methods. Email and Google is enough.",
  ],
  ["vercel env pull .env.local", "Writes every injected key locally."],
  [
    "npm run db:migrate",
    "Creates the 24 application tables. Then `npm run db:seed` for the benchmarks.",
  ],
  [
    "npm run check:models",
    "No model key needed — OpenCode Zen serves its free models unauthenticated. This just confirms one is reachable.",
  ],
]

/**
 * Shown in place of the app when Clerk has not been provisioned yet. Reads no
 * data and renders no app content — the point is that a missing key can never
 * become an accidentally-public route.
 */
export function SetupNotice() {
  return (
    <Container className="py-24">
      <div className="mb-8 flex max-w-[640px] flex-col gap-4">
        <span className="t-micro">Setup required</span>
        <h1 className="text-heading-sm">
          Connect a database and an auth provider.
        </h1>
        <p className="text-body-sm text-fog">
          The public page works without these. Everything behind sign-in is
          blocked until they exist, so nothing here is reachable in the
          meantime.
        </p>
      </div>

      <AppFrame>
        <AppBar>
          <Crumb trail={["Setup"]}>Provisioning</Crumb>
          <Badge variant="err">
            <BadgeDot />
            Not configured
          </Badge>
        </AppBar>
        <AppBody className="flex flex-col">
          {STEPS.map(([cmd, why], i) => (
            <div
              key={cmd}
              className="flex flex-col gap-1 border-t border-graphite/70 px-2 py-3 first:border-t-0 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <span className="w-6 shrink-0 font-mono text-xs tabular text-ash">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <code className="font-mono text-xs break-all text-mist">
                  {cmd}
                </code>
                <span className="text-xs text-ash">{why}</span>
              </div>
            </div>
          ))}
        </AppBody>
      </AppFrame>
    </Container>
  )
}
