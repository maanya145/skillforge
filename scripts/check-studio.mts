/**
 * Does the studio agent emit parseable OpenUI Lang, grounded in real numbers?
 *
 *   npm run check:studio
 *
 * Two failure modes matter and neither shows up in a build:
 *   1. The model writes prose, or markdown-fenced code, instead of openui-lang.
 *      The renderer then shows nothing at all.
 *   2. It writes a Gauge with numbers it invented rather than ones a tool
 *      returned — which is the one thing this whole product refuses to do.
 */
import { desc, eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { createStudioAgent } from "@/mastra/agents/studio"

const [student] = await db
  .select({ id: schema.students.id, fullName: schema.students.fullName })
  .from(schema.students)
  .orderBy(desc(schema.students.createdAt))
  .limit(1)

if (!student) {
  console.log("No student. Run `npm run db:demo` first.")
  process.exit(0)
}

const question =
  process.argv.slice(2).join(" ") ||
  "Where am I weakest, and how long would it take to fix?"
console.log(`student  ${student.fullName ?? student.id.slice(0, 8)}`)
console.log(`question ${question}\n`)

const agent = createStudioAgent(student.id)
const started = performance.now()

let answer = ""
const tools: string[] = []
const result = await agent.stream(question, { maxSteps: 5 })

for await (const chunk of result.fullStream) {
  if (chunk.type === "text-delta") {
    answer += (chunk as { payload?: { text?: string } }).payload?.text ?? ""
  } else if (chunk.type === "tool-call") {
    const name = (chunk as { payload?: { toolName?: string } }).payload?.toolName
    if (name && !tools.includes(name)) tools.push(name)
  }
}

const elapsed = Math.round(performance.now() - started)
console.log(answer)
console.log(`\n─────\ntools    ${tools.join(", ") || "NONE"}`)
console.log(`timing   ${elapsed}ms · ${answer.length} chars`)

// ── Assertions ──────────────────────────────────────────────────────────────
const problems: string[] = []

if (!/\broot\s*=\s*Answer\(/.test(answer)) {
  problems.push("no `root = Answer(...)` — the renderer will show nothing")
}
if (/```/.test(answer)) {
  problems.push("wrapped in a markdown fence — the parser will choke")
}
if (tools.length === 0) {
  problems.push("called no tools, so any number it rendered was invented")
}

// Colon-style named arguments are the documented silent-failure mode.
if (/\b(Gauge|Stat|Text|Resource|Steps)\([a-zA-Z_]+\s*:/.test(answer)) {
  problems.push("used named `arg:` syntax — positional only, this breaks silently")
}

// Media must be grounded: an Image or Embed without a preview_link call means
// the URL was invented, which is exactly what this component set exists to stop.
const usesMedia = /\b(Image|Embed)\(/.test(answer)
if (usesMedia && !tools.includes("preview_link")) {
  problems.push("rendered Image/Embed without calling preview_link — invented media")
}

const components = [
  ...answer.matchAll(/\b(Text|Gauge|Stat|Resource|Steps|Image|Embed)\(/g),
]
console.log(`blocks   ${components.length} component calls${usesMedia ? " (incl. media)" : ""}`)

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):`)
  for (const p of problems) console.error(`  · ${p}`)
  process.exit(1)
}

console.log("\n✓ Valid openui-lang, grounded in tool results.")
