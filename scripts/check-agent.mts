/**
 * End-to-end smoke test of the agent path: Mastra → OpenCode Zen → a
 * zod-validated object. Run it before blaming anything else.
 *
 *   npm run check:agent
 */
import { Agent } from "@mastra/core/agent"
import { z } from "zod"

import { MODEL_FAST, hasZenKey } from "../src/mastra/models"

console.log(`api key ${hasZenKey ? "set" : "none (free tier)"}`)
console.log(
  `chain   ${MODEL_FAST.map((m) => m.model.id).join(" → ")}\n`
)

const agent = new Agent({
  id: "probe",
  name: "Probe",
  instructions:
    "You extract facts from resumes. You never rate, never score, never encourage. If a claim has no supporting artefact, say so.",
  model: MODEL_FAST,
})

const started = Date.now()

try {
  const res = await agent.generate(
    "Resume line: 'Familiar with Docker'. Fill the schema from that line alone.",
    {
      structuredOutput: {
        schema: z.object({
          mentionedOnResume: z.boolean(),
          projectCount: z.number().int(),
          note: z.string().max(80),
        }),
      },
    }
  )

  console.log(`OK in ${Date.now() - started}ms ->`, JSON.stringify(res.object))

  // The whole product rests on the model NOT inventing evidence. One bare
  // claim, no artefact behind it, must come back as zero projects.
  if (res.object?.projectCount !== 0) {
    console.error(
      `\n  WARNING: model reported ${res.object?.projectCount} projects for a bare claim.\n` +
        `  Extraction quality is suspect on this model — check src/mastra/models.ts.`
    )
    process.exit(1)
  }
} catch (e) {
  console.error(`FAILED after ${Date.now() - started}ms:`, (e as Error).message.slice(0, 400))
  process.exit(1)
}
