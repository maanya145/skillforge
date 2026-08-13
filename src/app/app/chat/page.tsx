import { requireAuth } from "@/lib/auth"
import { ensureStudent } from "@/lib/students"
import { getLatestRun } from "@/lib/analysis"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame } from "@/components/shell/workspace"

import { ChatClient } from "./chat-client"

export default async function ChatPage() {
  await requireAuth()
  const student = await ensureStudent()
  const run = await getLatestRun(student.id)

  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="Step 06" title="Mentor">
        The mentor reads the same rows the dashboards render. It can explain
        your numbers and turn them into next actions — it cannot invent a
        score, a course, or a plan the scheduler didn&rsquo;t produce.
      </SectionHead>

      <WorkspaceFrame
        current="/app/chat"
        trail={["Workspace"]}
        crumb="Mentor"
        tools={
          run ? (
            <Badge variant="ok">
              <BadgeDot />
              Grounded in your latest analysis
            </Badge>
          ) : (
            <Badge variant="err">
              <BadgeDot />
              No analysis yet
            </Badge>
          )
        }
      >
        <ChatClient />
      </WorkspaceFrame>
    </div>
  )
}
