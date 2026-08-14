import { desc, eq } from "drizzle-orm"

import { requireAuth } from "@/lib/auth"
import { ensureStudent } from "@/lib/students"
import { getLatestRun } from "@/lib/analysis"
import { db, schema } from "@/db"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame } from "@/components/shell/workspace"

import { ChatClient } from "./chat-client"

export const metadata = { title: "Mentor · SkillForge" }

export default async function ChatPage() {
  await requireAuth()
  const student = await ensureStudent()

  const [run, threads] = await Promise.all([
    getLatestRun(student.id),
    db
      .select({
        id: schema.chatThreads.id,
        title: schema.chatThreads.title,
        updatedAt: schema.chatThreads.updatedAt,
      })
      .from(schema.chatThreads)
      .where(eq(schema.chatThreads.studentId, student.id))
      .orderBy(desc(schema.chatThreads.updatedAt))
      .limit(20),
  ])

  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="Step 06" title="Mentor">
        The mentor sees the same numbers your dashboards show, and can search
        the web for real material. It explains your plan and turns it into next
        actions &mdash; it never invents a score.
      </SectionHead>

      <WorkspaceFrame
        current="/app/chat"
        trail={["Workspace"]}
        crumb="Mentor"
        tools={
          run ? (
            <Badge variant="ok">
              <BadgeDot />
              Grounded in your analysis
            </Badge>
          ) : (
            <Badge variant="err">
              <BadgeDot />
              No analysis yet
            </Badge>
          )
        }
      >
        <ChatClient
          initialThreads={threads.map((t) => ({
            id: t.id,
            title: t.title,
            updatedAt: t.updatedAt.toISOString(),
          }))}
        />
      </WorkspaceFrame>
    </div>
  )
}
