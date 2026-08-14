import Link from "next/link"
import { ExternalLink, MessageSquare } from "lucide-react"

import { requireAuth } from "@/lib/auth"
import { ensureStudent } from "@/lib/students"
import { getLatestRun } from "@/lib/analysis"
import { getFeed, relativeAge } from "@/lib/feed"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SectionHead } from "@/components/shell/section"
import { WorkspaceFrame, EmptyState } from "@/components/shell/workspace"
import { AppHeading } from "@/components/shell/frame"

export const metadata = { title: "Feed · SkillForge" }

/**
 * Ranked by the student's own gaps, not by what is trending.
 *
 * Server Component with no client JS: the ordering is computed once per
 * revalidation window and the same for everyone reading the same skill map,
 * so there is nothing to hydrate.
 */
export default async function FeedPage() {
  await requireAuth()
  const student = await ensureStudent()
  const run = await getLatestRun(student.id)
  const items = run ? await getFeed(run.id) : []

  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="Keeping current" title="Feed">
        Engineering news weighted by what you&rsquo;re actually short on. A
        Kubernetes thread matters if Docker is your widest gap and is noise if
        it isn&rsquo;t &mdash; so the ordering here is the same weight
        &times; gap the skill map uses, decayed by age.
      </SectionHead>

      <WorkspaceFrame current="/app/feed" trail={["Workspace"]} crumb="Feed">
        {items.length === 0 ? (
          <EmptyState
            title={run ? "Nothing worth surfacing right now" : "No skill map yet"}
            action={
              <Button asChild>
                <Link href={run ? "/app/map" : "/app/intake"}>
                  {run ? "See your skill map" : "Upload a resume"}
                </Link>
              </Button>
            }
          >
            {run
              ? "The feed reads Hacker News against your open tracks. Nothing recent cleared the bar — check back in a day."
              : "Stories are ranked against your open gaps, so the feed needs a skill map first."}
          </EmptyState>
        ) : (
          <>
            <AppHeading aside={`${items.length} stories · refreshed hourly`}>
              Ranked against your open gaps
            </AppHeading>

            <div className="flex flex-col">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="border-t border-graphite/70 px-2 py-3 first:border-t-0 hover:bg-white/[0.02]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="group flex min-w-0 items-baseline gap-1.5"
                    >
                      <span className="truncate text-caption text-mist group-hover:text-paper">
                        {item.title}
                      </span>
                      <ExternalLink
                        className="size-3 shrink-0 text-ash opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    </a>
                    <span className="font-mono text-xs tabular whitespace-nowrap text-ash">
                      {relativeAge(item.ageHours)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {item.trackNames.map((name) => (
                      <Badge key={name} variant="tag">
                        {name}
                      </Badge>
                    ))}
                    <span className="ml-auto flex items-center gap-3 font-mono text-xs text-ash">
                      <span>{item.source}</span>
                      <span>{item.points} pts</span>
                      <a
                        href={item.discussionUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="flex items-center gap-1 transition-colors hover:text-mist"
                      >
                        <MessageSquare className="size-3" aria-hidden />
                        {item.comments}
                      </a>
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <p className="mt-3 border-t border-graphite px-2 pt-3 text-xs text-ash">
              Stories come from Hacker News, filtered to your tracks and scored
              by relevance &times; popularity &times; freshness. No model chose
              any of this, and nothing here moves your readiness &mdash;
              reading is not evidence.
            </p>
          </>
        )}
      </WorkspaceFrame>
    </div>
  )
}
