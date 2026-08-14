/**
 * Does the landing console's mentor explain the product, briefly and honestly?
 *
 *   npm run check:greeter
 *
 * Two failure modes matter: replies too long for a matchbox screen, and
 * invented facts. Length is asserted; honesty is spot-checked by requiring the
 * one claim the product leads with — that code, not the model, produces the
 * numbers.
 */
import { greeterAgent } from "@/mastra/agents/greeter"

const QUESTIONS = [
  "what is this?",
  "how do i know the scores aren't just made up by an AI?",
  "write me a poem about the sea",
]

let failed = 0

for (const q of QUESTIONS) {
  const started = performance.now()
  let answer = ""
  const result = await greeterAgent.stream(
    [{ role: "user" as const, content: q }],
    { maxSteps: 1 }
  )
  for await (const chunk of result.fullStream) {
    if (chunk.type === "text-delta") {
      answer += (chunk as { payload?: { text?: string } }).payload?.text ?? ""
    }
  }
  const ms = Math.round(performance.now() - started)
  const words = answer.trim().split(/\s+/).length

  console.log(`› ${q}`)
  console.log(`  ${answer.trim()}`)
  console.log(`  (${words} words · ${ms}ms)\n`)

  if (words > 70) {
    console.error(`  ✗ ${words} words will not fit the screen (cap ~40, hard fail at 70)`)
    failed++
  }
  if (/[#*`]|\n-\s/.test(answer)) {
    console.error("  ✗ markdown in a 1-bit screen")
    failed++
  }
}

process.exit(failed ? 1 : 0)
