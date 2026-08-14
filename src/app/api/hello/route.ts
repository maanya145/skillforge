import { z } from "zod"

import { greeterAgent } from "@/mastra/agents/greeter"

export const runtime = "nodejs"
export const maxDuration = 120

/**
 * The landing console's chat — deliberately unauthenticated.
 *
 * A visitor deciding whether to sign up cannot have an account yet, so this is
 * public by design. What keeps a public model endpoint from being a free proxy
 * is the shape of what it accepts and reaches:
 *   - the agent has no tools, no student and no memory — nothing to leak
 *   - transcripts are capped hard (turns, message length, total bytes)
 *   - nothing is persisted; each request is the whole conversation
 */
const MAX_TURNS = 12
const MAX_MESSAGE_CHARS = 400
const MAX_TOTAL_CHARS = 4_000

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MAX_MESSAGE_CHARS),
      })
    )
    .min(1)
    .max(MAX_TURNS)
    .refine(
      (m) => m.reduce((n, x) => n + x.content.length, 0) <= MAX_TOTAL_CHARS,
      { message: "transcript too long" }
    )
    // The last word must be the visitor's, or there is nothing to answer.
    .refine((m) => m[m.length - 1].role === "user", {
      message: "last message must be from the user",
    }),
})

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: "Ask a shorter question." }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )

      // Re-narrow per message: Mastra's input type discriminates on `role`,
      // and zod's inferred union-on-one-object shape does not match it.
      const transcript = parsed.data.messages.map((m) =>
        m.role === "user"
          ? { role: "user" as const, content: m.content }
          : { role: "assistant" as const, content: m.content }
      )

      let answer = ""
      try {
        const result = await greeterAgent.stream(transcript, {
          // No tools to call — one step is the whole conversation turn.
          maxSteps: 1,
        })

        for await (const chunk of result.fullStream) {
          if (chunk.type === "text-delta") {
            const delta =
              (chunk as { payload?: { text?: string } }).payload?.text ?? ""
            if (delta) {
              answer += delta
              send("delta", { text: delta })
            }
          }
        }

        if (!answer.trim()) throw new Error("empty response")
        send("done", {})
      } catch (err) {
        console.error("[hello] stream failed:", err)
        send("error", {
          error: "the mentor is busy — try again in a moment",
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
