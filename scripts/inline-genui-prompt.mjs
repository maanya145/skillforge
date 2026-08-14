/**
 * Wraps the CLI-generated OpenUI system prompt into a TypeScript module.
 *
 * Run via `npm run genui:prompt`, which regenerates the .txt first.
 *
 * The indirection exists because a serverless bundle does not reliably include
 * loose .txt files, and a prompt that silently failed to load would leave the
 * model emitting prose the OpenUI renderer cannot parse — a blank answer with
 * no error.
 */
import { readFileSync, writeFileSync } from "node:fs"

const SOURCE = "src/generated/openui-system-prompt.txt"
const TARGET = "src/generated/openui-system-prompt.ts"

const text = readFileSync(SOURCE, "utf8")

writeFileSync(
  TARGET,
  `/**
 * GENERATED — do not edit.
 *
 * Regenerate after any change to src/components/genui/library.tsx:
 *   npm run genui:prompt
 *
 * Inlined as a module rather than read from disk at runtime: a serverless
 * bundle does not reliably include loose .txt files, and a missing prompt
 * would degrade silently into the model emitting prose the renderer cannot
 * parse.
 */
export const OPENUI_SYSTEM_PROMPT = ${JSON.stringify(text)}
`
)

console.log(`${TARGET} — ${text.length} chars from the library spec`)
