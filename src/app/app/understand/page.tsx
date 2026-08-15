import { requireAuth } from "@/lib/auth"
import { ensureStudent } from "@/lib/students"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame } from "@/components/shell/workspace"

import { UnderstandClient } from "./understand-client"

export const metadata = { title: "Understand · SkillForge" }

/**
 * Paste material, get it back as interface.
 *
 * The studio answers questions about the student's own numbers; this screen
 * explains whatever they bring — code, notes, an error — using a separate
 * component grammar built for explanation: flows, tables, terms, callouts,
 * and deliberately no media blocks, because this agent has no tool to ground
 * them with.
 */
export default async function UnderstandPage() {
  await requireAuth()
  await ensureStudent()

  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="Study aid" title="Understand">
        Paste the thing that isn&rsquo;t clicking — a function, lecture notes,
        a stack trace — and get it back as interface: the control flow as a
        diagram, the trade-offs as a table, the jargon defined, the one
        pitfall called out. It explains only what you pasted.
      </SectionHead>

      <WorkspaceFrame
        current="/app/understand"
        trail={["Workspace"]}
        crumb="Understand"
      >
        <UnderstandClient />
      </WorkspaceFrame>
    </div>
  )
}
