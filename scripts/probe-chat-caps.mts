/**
 * Decides the chat architecture: do the free Zen models support (a) streaming
 * text and (b) tool calling, through Mastra? Run before building UI on either.
 */
import { Agent } from "@mastra/core/agent"
import { createTool } from "@mastra/core/tools"
import { z } from "zod"

const MODEL = process.env.PROBE_MODEL ?? "hy3-free"
const model = [
  {
    model: { id: `opencode/${MODEL}` as const, url: "https://opencode.ai/zen/v1" },
    maxRetries: 0,
    modelSettings: { temperature: 0.2, maxOutputTokens: 4000 },
  },
]

// ── Probe 1: streaming ────────────────────────────────────────────────────────
{
  const agent = new Agent({
    id: "stream-probe",
    name: "Stream probe",
    instructions: "Answer in two short sentences.",
    model,
  })
  const t0 = Date.now()
  let chunks = 0
  let firstChunkAt = 0
  let text = ""
  try {
    const stream = await agent.stream("Why do students underestimate system design preparation?")
    for await (const chunk of stream.textStream) {
      chunks++
      if (chunks === 1) firstChunkAt = Date.now() - t0
      text += chunk
    }
    console.log(
      `STREAM  ${MODEL}: ${chunks} chunks · first at ${firstChunkAt}ms · total ${Date.now() - t0}ms · ${text.length} chars`
    )
  } catch (e) {
    console.log(`STREAM  ${MODEL}: FAILED — ${(e as Error).message.slice(0, 120)}`)
  }
}

// ── Probe 2: tool calling ─────────────────────────────────────────────────────
{
  let invoked: string | null = null
  const lookupTool = createTool({
    id: "lookup_definition",
    description:
      "Look up the definition of a technical term. Use whenever the user asks what something is.",
    inputSchema: z.object({ term: z.string() }),
    outputSchema: z.object({ definition: z.string() }),
    execute: async ({ term }) => {
      invoked = term
      return {
        definition: `${term}: a deliberate trade of freshness for speed by keeping a copy closer to the reader.`,
      }
    },
  })

  const agent = new Agent({
    id: "tool-probe",
    name: "Tool probe",
    instructions:
      "You answer questions about technical terms. You MUST use the lookup_definition tool to fetch definitions rather than answering from memory.",
    model,
    tools: { lookupTool },
  })

  const t0 = Date.now()
  try {
    const res = await agent.generate("What is cache invalidation?", { maxSteps: 3 })
    const calls = await Promise.resolve((res as { toolCalls?: unknown[] }).toolCalls ?? [])
    console.log(
      `TOOLS   ${MODEL}: invoked=${invoked ?? "NO"} · toolCalls=${Array.isArray(calls) ? calls.length : "?"} · ${Date.now() - t0}ms`
    )
    console.log(`        answer: ${res.text.slice(0, 140)}`)
  } catch (e) {
    console.log(`TOOLS   ${MODEL}: FAILED — ${(e as Error).message.slice(0, 160)}`)
  }
}
process.exit(0)
