/**
 * Probes the model gateway that agents actually call.
 *
 *   npm run check:models
 *
 * This talks to the live endpoint rather than reading @mastra/core's bundled
 * registry, because the registry proved unreliable in two separate ways:
 *
 *  1. It lists ~25 free OpenCode Zen models, but most return
 *     "Model <id> is not supported" when you actually call them.
 *  2. Mastra can persist an EMPTY registry to ~/.cache/mastra after a failed
 *     refresh, which then shadows the good bundled copy and surfaces as
 *     "model not found" for an id you know is valid.
 *
 * Zen serves free models to unauthenticated requests. An INVALID key is worse
 * than no key — it 401s — so the header is omitted unless a real key exists.
 */
import { homedir } from "node:os"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const BASE_URL = process.env.SKILLFORGE_ZEN_URL ?? "https://opencode.ai/zen/v1"
const KEY = process.env.OPENCODE_API_KEY?.trim()

const CANDIDATES = [
  process.env.SKILLFORGE_MODEL_FAST,
  process.env.SKILLFORGE_MODEL_DEEP,
  process.env.SKILLFORGE_MODEL_CHAT,
  "hy3-free",
  "nemotron-3.5-lightning-free",
  "deepseek-v4-flash-free",
]
  .filter(Boolean)
  .map((m) => m.replace(/^opencode\//, ""))

const models = [...new Set(CANDIDATES)]

// The empty-cache landmine — cheap to check, expensive to debug.
const cachePath = join(homedir(), ".cache/mastra/provider-registry.json")
if (existsSync(cachePath)) {
  try {
    const cached = JSON.parse(readFileSync(cachePath, "utf8"))
    if (Object.keys(cached.providers ?? {}).length === 0) {
      console.error(
        `warning: ${cachePath} holds an EMPTY registry and will shadow the bundled one.\n` +
          `         mv "${cachePath}" "${cachePath}.bak"\n`
      )
    }
  } catch {
    /* unreadable cache is harmless */
  }
}

console.log(`gateway ${BASE_URL}`)
console.log(`api key ${KEY ? "set (paid tier, higher limits)" : "none (free tier, shared limits)"}\n`)

let anyUp = false

for (const model of models) {
  const started = Date.now()
  let line = `  ${model.padEnd(30)} `

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Only when a real key exists — Zen 401s an invalid bearer token
        // but serves a request carrying no token at all.
        ...(KEY ? { authorization: `Bearer ${KEY}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(60_000),
    })

    const ms = Date.now() - started
    const body = await res.json().catch(() => ({}))

    if (res.ok) {
      anyUp = true
      const text = (body.choices?.[0]?.message?.content ?? "").trim()
      line += `UP    ${String(ms).padStart(5)}ms  ${text.slice(0, 40) || "(empty)"}`
    } else {
      const kind = body?.error?.type ?? res.status
      line += `DOWN  ${String(ms).padStart(5)}ms  ${kind}`
    }
  } catch (err) {
    line += `DOWN         ${err.name === "TimeoutError" ? "timeout" : err.message.slice(0, 40)}`
  }

  console.log(line)
}

if (!anyUp) {
  console.error(
    "\nNo model responded. The shared free tier is rate limited by IP and " +
      "saturates in bursts — retry in a few minutes, or set OPENCODE_API_KEY " +
      "for dedicated limits."
  )
  process.exit(1)
}
