import { requireAuth } from "@/lib/auth"
import { ensureStudent, listRoles } from "@/lib/students"
import { getLatestRun } from "@/lib/analysis"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame } from "@/components/shell/workspace"

import { SettingsForm } from "./settings-form"

export const metadata = { title: "Settings · SkillForge" }

export default async function SettingsPage() {
  await requireAuth()
  const student = await ensureStudent()
  const [roles, run] = await Promise.all([
    listRoles(),
    getLatestRun(student.id),
  ])

  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="Account" title="Settings">
        The two settings that change your numbers — target role and weekly
        hours — take effect immediately, because re-measuring is arithmetic.
      </SectionHead>

      <WorkspaceFrame
        current="/app/settings"
        trail={["Workspace"]}
        crumb="Settings"
      >
        <SettingsForm
          fullName={student.fullName ?? ""}
          college={student.college ?? ""}
          gradYear={student.gradYear}
          weeklyHours={student.weeklyHours}
          targetRoleId={student.targetRoleId}
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
          hasAnalysis={Boolean(run)}
        />
      </WorkspaceFrame>
    </div>
  )
}
