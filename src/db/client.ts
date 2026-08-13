import { setDefaultResultOrder } from "node:dns"
import {
  setDefaultAutoSelectFamily,
  setDefaultAutoSelectFamilyAttemptTimeout,
} from "node:net"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import * as schema from "./schema"

/**
 * The database client, usable from anywhere on the server.
 *
 * Deliberately NOT marked `server-only`: Mastra Studio and the seed scripts run
 * outside a Next request, where `server-only` throws. App code imports
 * `./index` instead, which adds that guard.
 */

/**
 * ── Connection reliability ───────────────────────────────────────────────────
 *
 * Neon's hostnames publish both A and AAAA records, and two Node defaults
 * interact badly with that on a network without IPv6 egress:
 *
 *  1. DNS returns the IPv6 address first, so a connect dies with EHOSTUNREACH
 *     before reaching Neon.
 *  2. Node 20+ enables Happy Eyeballs (`autoSelectFamily`) by default, racing
 *     the IPv4 and IPv6 addresses with a 250ms per-attempt timeout. When IPv6
 *     is black-holed rather than refused, that race reports ETIMEDOUT for the
 *     whole connection even though IPv4 was reachable — which is why curl
 *     succeeded against every address while Node failed against all of them.
 *
 * Measured here: 1 of 8 connections succeeded with the defaults, 8 of 8 with
 * these three lines. Not a local-only workaround — the same shape appears on
 * any IPv6-degraded network, campus wifi very much included.
 */
setDefaultResultOrder("ipv4first")
setDefaultAutoSelectFamily(false)
setDefaultAutoSelectFamilyAttemptTimeout(5_000)

/**
 * ── Why the HTTP driver and not a connection pool ────────────────────────────
 *
 * Both pooled drivers failed here for the same underlying reason: they hold a
 * socket open, and on this network sockets to Neon die. The WebSocket driver
 * then emits an unhandled `error` on the client and takes the whole process
 * down with "Connection terminated unexpectedly" — an error bearing no
 * relationship to the code that trips over it.
 *
 * `neon()` is stateless: every query is one independent HTTPS request. There
 * is no long-lived connection to terminate, nothing to go stale across the
 * ~100s an analysis spends waiting on a model, and no pool to exhaust. Plain
 * HTTPS to this host was the one thing that never failed in testing.
 *
 * The trade-off is real: no interactive transactions. `db.transaction()` is
 * unavailable, so multi-table writes run sequentially rather than atomically.
 * For an analysis that writes only after every value is already computed, a
 * partial write is recoverable — the run is marked failed and re-running
 * overwrites it. That is a fair price for a connection that cannot break.
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Run `vercel install neon` and `vercel env pull .env.local`."
    )
  }
  return neon(connectionString)
}

// Next's dev HMR re-evaluates this module on every edit; caching keeps one
// client rather than accumulating them.
const globalForDb = globalThis as unknown as {
  __skillforgeSql?: ReturnType<typeof createClient>
}

export const sql = globalForDb.__skillforgeSql ?? createClient()

if (process.env.NODE_ENV !== "production") {
  globalForDb.__skillforgeSql = sql
}

export const db = drizzle(sql, { schema })
export { schema }
