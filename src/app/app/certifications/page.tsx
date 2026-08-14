import Link from "next/link"

import { requireAuth } from "@/lib/auth"
import { ensureStudent } from "@/lib/students"
import { getLatestRun } from "@/lib/analysis"
import { getCertInputs } from "@/lib/cert-artifact"
import { Button } from "@/components/ui/button"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame, EmptyState } from "@/components/shell/workspace"

import { Certifications } from "./artifact"

export const metadata = { title: "Certifications · SkillForge" }

/**
 * The certification decision, on its own surface.
 *
 * Split out of Practice deliberately. Inline generative UI is for when the UI
 * *is* the reply; an artifact is a durable thing you return to and change your
 * mind in — and a spending decision is exactly that. Practice keeps a summary
 * card that links here.
 */
export default async function CertificationsPage() {
  await requireAuth()
  const student = await ensureStudent()
  const run = await getLatestRun(student.id)
  const inputs = run ? await getCertInputs(run.id) : null

  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="Decision" title="Are these worth it?">
        Certifications cost money students mostly don&rsquo;t have, and most of
        them buy less readiness than a weekend project. Set what you can
        actually spend and every verdict re-decides &mdash; in your browser,
        with the same function the analysis ran.
      </SectionHead>

      <WorkspaceFrame
        current="/app/certifications"
        trail={["Workspace", "Practice"]}
        crumb="Certifications"
      >
        {!inputs ? (
          <EmptyState
            title="Nothing to weigh up yet"
            action={
              <Button asChild>
                <Link href="/app/intake">Upload a resume</Link>
              </Button>
            }
          >
            Verdicts are scored against your open gaps, so they need a skill map
            first.
          </EmptyState>
        ) : (
          <Certifications
            catalog={inputs.catalog}
            gaps={inputs.gaps}
            coveredTrackIds={inputs.coveredTrackIds}
            trackNames={inputs.trackNames}
          />
        )}
      </WorkspaceFrame>
    </div>
  )
}
