import { requireAuth } from "@/lib/auth"
import { ensureStudent, listRoles } from "@/lib/students"
import { getActiveRun, getLatestRun } from "@/lib/analysis"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame } from "@/components/shell/workspace"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { ToolPill } from "@/components/shell/frame"

import { IntakeClient, type RunState } from "./intake-client"
import { IntakeResults } from "./intake-results"

export const metadata = { title: "Intake · SkillForge" }

export default async function IntakePage() {
  await requireAuth()

  const student = await ensureStudent()
  const [roles, lastRun, latestSucceeded] = await Promise.all([
    listRoles(),
    getActiveRun(student.id),
    getLatestRun(student.id),
  ])

  // Hand an in-flight run to the client so a refresh, or a walk to another
  // screen and back, rejoins the analysis instead of showing an idle form.
  const resumableRun: RunState | null =
    lastRun &&
    (lastRun.status === "queued" ||
      lastRun.status === "running" ||
      (lastRun.status === "failed" &&
        Date.now() - lastRun.startedAt.getTime() < 10 * 60 * 1000))
      ? {
          id: lastRun.id,
          status: lastRun.status,
          currentStep: lastRun.currentStep,
          progress: lastRun.progress,
          error: lastRun.error,
        }
      : null

  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="Step 01" title="Intake">
        Upload the resume you already send to recruiters. SkillForge separates
        claims from evidence, reads your coursework for corroboration, and cites
        the page and line of every sentence it flags.
      </SectionHead>

      <WorkspaceFrame
        current="/app/intake"
        trail={["Workspace"]}
        crumb="Intake"
        tools={
          <>
            <ToolPill className="hidden sm:inline-flex">
              {student.weeklyHours} hrs/week
            </ToolPill>
            {lastRun?.status === "succeeded" ? (
              <Badge variant="ok">
                <BadgeDot />
                Analysed
              </Badge>
            ) : null}
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <IntakeClient
            roles={roles.map((r) => ({ id: r.id, name: r.name }))}
            currentRoleId={student.targetRoleId}
            initialRun={resumableRun}
          />

          <div className="flex flex-col gap-3">
            <div className="rounded-md bg-white/[0.02] p-4 shadow-subtle">
              <span className="t-micro">What happens next</span>
              <ol className="mt-3 flex flex-col gap-2 text-xs text-fog">
                <Step n="01">
                  The PDF is read locally — every line keeps its page and line
                  number, which is what makes a flagged sentence citable.
                </Step>
                <Step n="02">
                  The model reports what your resume demonstrates: counts,
                  yes/no facts and locations. It is never asked for a score.
                </Step>
                <Step n="03">
                  Quotes are checked against the source. Anything that
                  doesn&rsquo;t appear where it claims to is discarded.
                </Step>
                <Step n="04">
                  Levels, gaps and readiness are computed in TypeScript from the
                  role&rsquo;s published benchmark.
                </Step>
              </ol>
            </div>

            <div className="rounded-md bg-white/[0.02] p-4 shadow-subtle">
              <span className="t-micro">Scanned resume?</span>
              <p className="mt-2 text-xs text-fog">
                Scans and image exports have no text to read. Switch to{" "}
                <strong className="font-[510] text-mist">Paste the text</strong>{" "}
                and the analysis works exactly the same — page and line
                citations included.
              </p>
            </div>
          </div>
        </div>

        {latestSucceeded ? <IntakeResults runId={latestSucceeded.id} /> : null}
      </WorkspaceFrame>
    </div>
  )
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="font-mono text-xs tabular text-ash">{n}</span>
      <span>{children}</span>
    </li>
  )
}
