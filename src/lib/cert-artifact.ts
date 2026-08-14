import "server-only"

import { eq } from "drizzle-orm"

import { db, schema } from "@/db"
import type { CatalogCert } from "@/lib/ranking/rank"
import type { GapResult } from "@/lib/scoring/gap"

/**
 * The raw inputs the certifications artifact re-scores in the browser.
 *
 * It deliberately does NOT return the pre-ranked `recommended_certs` rows. The
 * artifact needs the catalog and the gaps so it can re-run `rankCerts` itself
 * when the student changes their budget — sending the already-ranked output
 * would mean shipping verdicts that cannot respond to anything.
 */
export type CertInputs = {
  catalog: CatalogCert[]
  gaps: GapResult[]
  coveredTrackIds: string[]
  trackNames: Record<string, string>
}

export async function getCertInputs(
  runId: string
): Promise<CertInputs | null> {
  const [certs, assessments, tracks, scheduledProjects] = await Promise.all([
    db.select().from(schema.certCatalog),
    db
      .select()
      .from(schema.skillAssessments)
      .where(eq(schema.skillAssessments.runId, runId)),
    db
      .select({
        id: schema.skillTracks.id,
        name: schema.skillTracks.name,
      })
      .from(schema.skillTracks),
    db
      .select({ projectId: schema.recommendedProjects.projectId })
      .from(schema.recommendedProjects)
      .where(eq(schema.recommendedProjects.runId, runId)),
  ])

  if (certs.length === 0 || assessments.length === 0) return null

  // Which tracks a scheduled project already proves — the "the CI retrofit
  // does this for free" case that turns a good certificate into a redundant one.
  const projectIds = scheduledProjects.map((p) => p.projectId)
  const covered = new Set<string>()
  if (projectIds.length > 0) {
    const rows = await db
      .select({
        id: schema.projectCatalog.id,
        closes: schema.projectCatalog.closesTrackIds,
      })
      .from(schema.projectCatalog)
    for (const row of rows) {
      if (projectIds.includes(row.id)) {
        for (const t of row.closes) covered.add(t)
      }
    }
  }

  return {
    catalog: certs.map((c) => ({
      id: c.id,
      name: c.name,
      provider: c.provider,
      costInr: c.costInr,
      examWindow: c.examWindow,
      baseValue: c.baseValue,
      provesTrackIds: c.provesTrackIds,
      cheaperAlternative: c.cheaperAlternative,
    })),
    gaps: assessments.map((a) => ({
      trackId: a.trackId,
      provenLevel: a.provenLevel,
      requiredLevel: a.requiredLevel,
      gap: a.gap,
      weight: a.weight,
      weeksToClose: a.weeksToClose,
      status: a.status,
      isBlocking: false,
    })),
    coveredTrackIds: [...covered],
    trackNames: Object.fromEntries(tracks.map((t) => [t.id, t.name])),
  }
}
