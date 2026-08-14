/**
 * Guards the one mismatch that silently degrades the chat UI: Mastra reports a
 * tool by its OBJECT KEY, so every key must have a human label or the student
 * sees a raw identifier mid-conversation.
 */
import { createMentorTools } from "../src/mastra/tools/mentor-tools"
import { TOOL_LABELS } from "../src/mastra/tools/tool-labels"

const keys = Object.keys(createMentorTools("00000000-0000-0000-0000-000000000000"))
const missing = keys.filter((k) => !TOOL_LABELS[k])
const orphan = Object.keys(TOOL_LABELS).filter((k) => !keys.includes(k))

console.log(`tools   ${keys.length}: ${keys.join(", ")}`)
if (missing.length) console.error(`MISSING labels: ${missing.join(", ")}`)
if (orphan.length) console.error(`ORPHAN labels:  ${orphan.join(", ")}`)
process.exit(missing.length || orphan.length ? 1 : 0)
