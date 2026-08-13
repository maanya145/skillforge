/**
 * Every agent's model, in one place.
 *
 * ── Why this doesn't use Mastra's model router ───────────────────────────────
 *
 * OpenCode Zen serves its free models to UNAUTHENTICATED requests. Verified
 * against the live API:
 *
 *   no Authorization header        → 200
 *   Authorization: Bearer <junk>   → 401 AuthError "Invalid API key."
 *
 * Mastra's router (`model: "opencode/hy3-free"`) always resolves an API key
 * from OPENCODE_API_KEY and throws when it's missing, so it cannot reach the
 * free tier at all. Passing an OpenAICompatibleConfig instead lets us send no
 * Authorization header, which is the only thing Zen accepts without a key.
 *
 * `apiKey` is spread in ONLY when a non-empty key exists — an empty or
 * placeholder value is worse than none, because Zen 401s an invalid token but
 * happily serves a request that carries no token at all.
 */

/** Zen's OpenAI-compatible endpoint. */
export const ZEN_BASE_URL = "https://opencode.ai/zen/v1"

type ZenModel = {
  id: `${string}/${string}`
  url: string
  apiKey?: string
}

function zen(modelId: string): ZenModel {
  const apiKey = process.env.OPENCODE_API_KEY?.trim()
  return {
    id: `opencode/${modelId}`,
    url: ZEN_BASE_URL,
    ...(apiKey ? { apiKey } : {}),
  }
}

/**
 * Free models actually served by Zen, probed live. The registry in
 * @mastra/core lists ~25 free ids but most return "Model is not supported" —
 * re-probe with `npm run check:models` before trusting any of them.
 *
 *   hy3-free                     honours json_schema, no chain-of-thought waste
 *   nemotron-3.5-lightning-free  reasoning model; needs ~1500 output tokens
 *                                before it emits any JSON at all
 *   deepseek-v4-flash-free       frequently rate limited on the shared free tier
 */
export const FREE_MODELS = [
  "hy3-free",
  "nemotron-3.5-lightning-free",
  "deepseek-v4-flash-free",
] as const

/**
 * Workflow agents run at temperature 0. Determinism is a product requirement
 * here, not a preference — see the contract in README.md.
 */
export const WORKFLOW_TEMPERATURE = 0

/**
 * This number is load-bearing, and it is much larger than it looks like it
 * should be.
 *
 * Every free model on this gateway is a reasoning model: it spends output
 * tokens on internal chain-of-thought BEFORE emitting a single character of
 * JSON, and that reasoning is billed against the same budget. Measured on the
 * real 12-track extraction:
 *
 *   budget  4000 → 4000 reasoning, 0 text, finishReason "length", no object
 *   budget 16000 → 5585 reasoning, 3826 text, finishReason "stop", valid object
 *
 * A budget that merely fits the answer produces NOTHING, because the model
 * never reaches the answer. Cutting this to "save tokens" breaks extraction
 * outright rather than degrading it.
 */
export const MAX_OUTPUT_TOKENS = 16_000

/**
 * Builds a Mastra model fallback chain.
 *
 * The shared free tier is rate limited by IP and saturates in bursts, so a
 * single model id is a single point of failure for a three-call analysis.
 * Mastra walks this list on failure, which turns "the demo died because Zen
 * was busy" into "the demo used its second choice".
 *
 * Order is deliberate: hy3-free first because it honours json_schema without
 * spending output tokens on visible reasoning, then the two that do.
 */
function chain(primary: string, temperature: number) {
  const ordered = [primary, ...FREE_MODELS.filter((m) => m !== primary)]
  return ordered.map((modelId, i) => ({
    model: zen(modelId),
    // The primary gets a retry; fallbacks fail fast to the next option.
    maxRetries: i === 0 ? 2 : 1,
    modelSettings: { temperature, maxOutputTokens: MAX_OUTPUT_TOKENS },
  }))
}

/** Extraction: high volume, structured output, no prose. */
export const MODEL_FAST = chain(
  process.env.SKILLFORGE_MODEL_FAST ?? "hy3-free",
  WORKFLOW_TEMPERATURE
)

/** Narration: writes rationale prose over decisions already made. */
export const MODEL_DEEP = chain(
  process.env.SKILLFORGE_MODEL_DEEP ?? "hy3-free",
  WORKFLOW_TEMPERATURE
)

/** The conversational mentor. Warmer — it's writing to a person. */
export const MODEL_CHAT = chain(
  process.env.SKILLFORGE_MODEL_CHAT ?? "hy3-free",
  0.4
)

/**
 * How structured output is coerced. `auto` lets Mastra use a provider's native
 * JSON-schema mode where it exists and fall back to prompt injection where it
 * doesn't. Pin to `"inline"` if extraction starts returning malformed objects.
 */
export const JSON_PROMPT_INJECTION: "auto" | "inline" | true | false = "auto"

/** True when a paid key is configured, which lifts the shared rate limits. */
export const hasZenKey = Boolean(process.env.OPENCODE_API_KEY?.trim())
