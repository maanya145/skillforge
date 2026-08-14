import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { ensureStudent } from "@/lib/students"
import { createStudioAgent } from "@/mastra/agents/studio"

export const runtime = "nodejs"
export const maxDuration = 300

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
})

/**
 * Streams an OpenUI Lang answer.
 *
 * Deliberately stateless — no threads, no persistence. The studio is a
 * single-question surface: you ask, it renders. Conversation lives on
 * /app/chat, which already owns transcripts and is better at prose.
 *
 * The stream is raw openui-lang text, and the client feeds it straight to the
 * renderer as it arrives — the parser re-runs per chunk and resolves forward
 * references when their statements land, which is what makes the UI assemble
 * progressively rather than appearing all at once.
 */
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json(
      { error: "Your session expired — sign in again.", code: "unauthorized" },
      { status: 401 }
    )
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: "Ask a question first." }, { status: 400 })
  }

  const student = await ensureStudent()
  const agent = createStudioAgent(student.id)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )

      let answer = ""
      const toolsUsed: string[] = []

      try {
        const result = await agent.stream(parsed.data.message, { maxSteps: 5 })

        for await (const chunk of result.fullStream) {
          if (chunk.type === "text-delta") {
            const delta =
              (chunk as { payload?: { text?: string } }).payload?.text ?? ""
            if (delta) {
              answer += delta
              send("delta", { text: delta })
            }
          } else if (chunk.type === "tool-call") {
            const name =
              (chunk as { payload?: { toolName?: string } }).payload?.toolName ?? ""
            if (name && !toolsUsed.includes(name)) {
              toolsUsed.push(name)
              send("tool", { name })
            }
          }
        }

        if (!answer.trim()) throw new Error("empty response")
        send("done", { toolsUsed })
      } catch (err) {
        console.error("[studio] stream failed:", err)
        const raw = err instanceof Error ? err.message : ""
        const rateLimited = /429|rate.?limit|FreeUsageLimit/i.test(raw)
        send("error", {
          error: rateLimited
            ? "Rate-limited right now. Wait a minute and ask again."
            : "Couldn't build that answer. Try asking again.",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  })
}
