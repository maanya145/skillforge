import { auth } from "@clerk/nextjs/server"
import { and, asc, desc, eq } from "drizzle-orm"
import { z } from "zod"

import { db, schema } from "@/db"
import { ensureStudent } from "@/lib/students"
import { createMentorAgent } from "@/mastra/agents/mentor"

export const runtime = "nodejs"
/** The free tier is slow; streaming means the user sees progress far sooner. */
export const maxDuration = 300

const MAX_CHARS = 4000
/** How much prior conversation the model sees. Server-side, so it can't drift. */
const HISTORY_TURNS = 12

const bodySchema = z.object({
  message: z.string().min(1).max(MAX_CHARS),
  threadId: z.string().uuid().nullable().optional(),
})

/**
 * The mentor endpoint.
 *
 * Streams tokens over SSE — the free models take 30–160s to finish, but first
 * tokens arrive in ~4s, which is the difference between a product and a
 * loading spinner. Transcript lives in Postgres, so a refresh, a tab close or
 * a walk to another screen no longer destroys the conversation.
 */
export async function POST(request: Request) {
  // Explicit auth check: ensureStudent throws, and an expired Clerk session is
  // a normal event that deserves a 401, not an opaque 500.
  const { userId } = await auth()
  if (!userId) {
    return Response.json(
      { error: "Your session expired — sign in again.", code: "unauthorized" },
      { status: 401 }
    )
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json(
      {
        error: `Keep your message under ${MAX_CHARS.toLocaleString()} characters.`,
        code: "bad_request",
      },
      { status: 400 }
    )
  }

  const student = await ensureStudent()
  const { message } = parsed.data

  // ── Resolve the thread, verifying ownership ────────────────────────────────
  let threadId = parsed.data.threadId ?? null
  if (threadId) {
    const [owned] = await db
      .select({ id: schema.chatThreads.id })
      .from(schema.chatThreads)
      .where(
        and(
          eq(schema.chatThreads.id, threadId),
          eq(schema.chatThreads.studentId, student.id)
        )
      )
    if (!owned) threadId = null
  }
  if (!threadId) {
    const [created] = await db
      .insert(schema.chatThreads)
      .values({
        studentId: student.id,
        // Title from the first message — TypeScript, not a model call.
        title: message.length > 48 ? `${message.slice(0, 47)}…` : message,
      })
      .returning()
    threadId = created.id
  }

  const history = await db
    .select({
      role: schema.chatMessages.role,
      content: schema.chatMessages.content,
    })
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.threadId, threadId))
    .orderBy(desc(schema.chatMessages.createdAt))
    .limit(HISTORY_TURNS)

  await db.insert(schema.chatMessages).values({
    threadId,
    role: "user",
    content: message,
  })

  const transcript = [
    ...history.reverse().map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.content }
        : { role: "assistant" as const, content: m.content }
    ),
    { role: "user" as const, content: message },
  ]

  const agent = createMentorAgent(student.id)
  const encoder = new TextEncoder()
  const resolvedThreadId = threadId

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )

      let answer = ""
      const toolsUsed: string[] = []

      try {
        send("meta", { threadId: resolvedThreadId })

        const result = await agent.stream(transcript, {
          // Room for tool calls plus the answer that follows them.
          maxSteps: 5,
        })

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

        if (!answer.trim()) {
          throw new Error("empty response")
        }

        await db.insert(schema.chatMessages).values({
          threadId: resolvedThreadId,
          role: "assistant",
          content: answer,
          toolsUsed,
        })
        await db
          .update(schema.chatThreads)
          .set({ updatedAt: new Date() })
          .where(eq(schema.chatThreads.id, resolvedThreadId))

        send("done", { toolsUsed })
      } catch (err) {
        // Log the real cause; show the student something they can act on.
        console.error("[chat] stream failed:", err)
        const raw = err instanceof Error ? err.message : ""
        const rateLimited = /429|rate.?limit|FreeUsageLimit/i.test(raw)
        send("error", {
          error: rateLimited
            ? "The mentor is rate-limited right now. Wait a minute and send it again."
            : "The mentor couldn't respond. Send your message again.",
          code: rateLimited ? "rate_limited" : "model_error",
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
      // Proxies that buffer would defeat the whole point of streaming.
      "x-accel-buffering": "no",
    },
  })
}

/** Thread list, or one thread's messages when `?threadId=` is given. */
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: "Not signed in." }, { status: 401 })
  }
  const student = await ensureStudent()
  const threadId = new URL(request.url).searchParams.get("threadId")

  if (!threadId) {
    const threads = await db
      .select({
        id: schema.chatThreads.id,
        title: schema.chatThreads.title,
        updatedAt: schema.chatThreads.updatedAt,
      })
      .from(schema.chatThreads)
      .where(eq(schema.chatThreads.studentId, student.id))
      .orderBy(desc(schema.chatThreads.updatedAt))
      .limit(20)
    return Response.json({ threads }, { headers: { "cache-control": "no-store" } })
  }

  const [owned] = await db
    .select({ id: schema.chatThreads.id })
    .from(schema.chatThreads)
    .where(
      and(
        eq(schema.chatThreads.id, threadId),
        eq(schema.chatThreads.studentId, student.id)
      )
    )
  if (!owned) return Response.json({ error: "No such conversation." }, { status: 404 })

  const messages = await db
    .select({
      id: schema.chatMessages.id,
      role: schema.chatMessages.role,
      content: schema.chatMessages.content,
      toolsUsed: schema.chatMessages.toolsUsed,
    })
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.threadId, threadId))
    .orderBy(asc(schema.chatMessages.createdAt))

  return Response.json(
    { messages },
    { headers: { "cache-control": "no-store" } }
  )
}
