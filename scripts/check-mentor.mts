/**
 * End-to-end mentor check: real tools, real database, real model, streaming.
 *
 *   npm run check:mentor ["your question"]
 *
 * Proves the agent actually CALLS its tools rather than answering from memory,
 * which is the whole difference between a grounded mentor and a chatbot.
 */
import { eq } from "drizzle-orm"

import { db, schema } from "../src/db/client"
import { createMentorAgent } from "../src/mastra/agents/mentor"
import { TOOL_LABELS } from "../src/mastra/tools/tool-labels"

const question =
  process.argv[2] ?? "What should I focus on this week, and where do I learn it?"

// Any seeded student will do; prefer a real account over the fixture rows.
const [student] = await db
  .select()
  .from(schema.students)
  .where(eq(schema.students.fullName, "Aarav Menon"))
  .limit(1)

if (!student) {
  console.error("No demo student. Run `npm run db:demo` first.")
  process.exit(1)
}

console.log(`student  ${student.fullName} (${student.id.slice(0, 8)})`)
console.log(`question ${question}\n`)

const agent = createMentorAgent(student.id)
const started = Date.now()
let firstToken = 0
let text = ""
const tools: string[] = []

const stream = await agent.stream([{ role: "user", content: question }], {
  maxSteps: 5,
})

for await (const chunk of stream.fullStream) {
  if (chunk.type === "text-delta") {
    const delta = (chunk as { payload?: { text?: string } }).payload?.text ?? ""
    if (delta && !firstToken) firstToken = Date.now() - started
    text += delta
    process.stdout.write(delta)
  } else if (chunk.type === "tool-call") {
    const name =
      (chunk as { payload?: { toolName?: string } }).payload?.toolName ?? "?"
    if (!tools.includes(name)) tools.push(name)
    process.stdout.write(`\n  [tool] ${TOOL_LABELS[name] ?? name}\n`)
  }
}

console.log(`\n\n─────`)
console.log(`tools    ${tools.length ? tools.join(", ") : "NONE — agent answered from memory"}`)
console.log(`timing   first token ${firstToken}ms · total ${Date.now() - started}ms`)
console.log(`length   ${text.length} chars`)

if (tools.length === 0) {
  console.error("\nFAIL: the mentor answered without reading the student's data.")
  process.exit(1)
}
process.exit(0)
