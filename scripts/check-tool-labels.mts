/**
 * Guards the one mismatch that silently degrades the chat UI: Mastra reports a
 * tool by its OBJECT KEY, so every key must have a human label or the student
 * sees a raw identifier mid-conversation.
 *
 * Also checks key === id. Nothing enforces that pairing, and when it drifts the
 * symptom is a correct-looking tool whose name in the transcript matches
 * nothing in TOOL_LABELS.
 */
import { createMentorTools } from "../src/mastra/tools/mentor-tools"
import { portfolioTools } from "../src/mastra/tools/portfolio"
import { TOOL_LABELS } from "../src/mastra/tools/tool-labels"

const tools = {
  ...createMentorTools("00000000-0000-0000-0000-000000000000"),
  ...portfolioTools,
}

const keys = Object.keys(tools)
const missing = keys.filter((k) => !TOOL_LABELS[k])
const orphan = Object.keys(TOOL_LABELS).filter((k) => !keys.includes(k))
const mismatched = Object.entries(tools)
  .filter(([key, tool]) => (tool as { id?: string }).id !== key)
  .map(([key, tool]) => `${key} (id: ${(tool as { id?: string }).id})`)

console.log(`tools   ${keys.length}: ${keys.join(", ")}`)
if (missing.length) console.error(`MISSING labels: ${missing.join(", ")}`)
if (orphan.length) console.error(`ORPHAN labels:  ${orphan.join(", ")}`)
if (mismatched.length) console.error(`KEY != ID:      ${mismatched.join(", ")}`)

process.exit(missing.length || orphan.length || mismatched.length ? 1 : 0)
