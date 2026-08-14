import { requireAuth } from "@/lib/auth"
import { ensureStudent } from "@/lib/students"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame } from "@/components/shell/workspace"

import { StudioClient } from "./studio-client"

export const metadata = { title: "Studio · SkillForge" }

export default async function StudioPage() {
  await requireAuth()
  await ensureStudent()

  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="Generative UI" title="Studio">
        Ask a question and the mentor answers in interface rather than prose
        &mdash; a real gauge, not a sentence describing one. It reads your
        measured state through the same tools, and every number it renders came
        from one of them.
      </SectionHead>

      <WorkspaceFrame
        current="/app/studio"
        trail={["Workspace"]}
        crumb="Studio"
      >
        <StudioClient />
      </WorkspaceFrame>
    </div>
  )
}
