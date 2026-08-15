/**
 * Wraps a CLI-generated OpenUI system prompt into a TypeScript module.
 *
 *   node scripts/inline-genui-prompt.mjs <source.txt> <target.ts> <EXPORT_NAME>
 *
 * Run via `npm run genui:prompt`, which regenerates the .txt files first.
 * Inlined as modules because a serverless bundle does not reliably include
 * loose .txt files, and a prompt that silently failed to load would leave the
 * model emitting prose the renderer cannot parse — a blank answer, no error.
 */
import { readFileSync, writeFileSync } from "node:fs"

const [source, target, name] = process.argv.slice(2)
if (!source || !target || !name) {
  console.error("usage: inline-genui-prompt.mjs <source.txt> <target.ts> <EXPORT_NAME>")
  process.exit(1)
}

const text = readFileSync(source, "utf8")
writeFileSync(
  target,
  `/**
 * GENERATED — do not edit. Regenerate with \`npm run genui:prompt\`.
 */
export const ${name} = ${JSON.stringify(text)}
`
)
console.log(`${target} — ${text.length} chars`)
