import "server-only"

/**
 * App-facing database entry point. The `server-only` import makes an
 * accidental client-component import a build error rather than a leaked
 * connection string.
 *
 * Mastra workflows and the seed scripts import `./client` directly, because
 * they run outside a Next request where `server-only` throws.
 */
export { db, sql, schema } from "./client"
