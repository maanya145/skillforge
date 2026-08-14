import { after } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { ensureStudent } from "@/lib/students"
import { getLatestRun } from "@/lib/analysis"
import { discoverForRun } from "@/lib/discovery/discover"

export const runtime = "nodejs"
/**
 * Discovery runs several web searches plus a classification pass — measured at
 * ~124s on the free model tier. That is why it gets its OWN request rather than
 * riding along in the analysis's `after()`: the analysis already spends most of
 * Hobby's 300s budget, and chaining them guarantees the second one is killed.
 */
export const maxDuration = 300

/**
 * Fire-and-forget discovery for the caller's latest analysis.
 *
 * Returns 202 immediately and does the work in `after()`. The client never
 * waits on this: results simply appear on Practice, and the "Find more" button
 * covers the case where this request was cut short.
 */
export async function POST() {
  // ensureStudent throws on no session, which would surface as an opaque 500.
  // An expired session is a normal client event and deserves a 401.
  const { userId } = await auth()
  if (!userId) {
    return Response.json(
      { error: "Your session expired — sign in again.", code: "unauthorized" },
      { status: 401 }
    )
  }

  const student = await ensureStudent()
  const run = await getLatestRun(student.id)
  if (!run) {
    return Response.json({ error: "No analysis to discover against." }, { status: 409 })
  }

  after(async () => {
    try {
      const outcome = await discoverForRun({ studentId: student.id, runId: run.id })
      console.log(`[discovery] ${outcome.message}`)
    } catch (err) {
      // A failed discovery must never surface as a failed analysis. The student
      // still has their full curated catalog; this is additive.
      console.error("[discovery] background run failed:", err)
    }
  })

  return Response.json({ started: true, runId: run.id }, { status: 202 })
}
