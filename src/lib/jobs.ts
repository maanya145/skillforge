import "server-only"

/**
 * Real, current job postings for the role a student is targeting.
 *
 * Sourced from companies' own applicant-tracking boards — Greenhouse and Lever
 * both serve public JSON with no API key — so every posting here is the
 * employer's own listing with its own URL and timestamp, not an aggregator's
 * copy that may have gone stale.
 *
 * ── What this surface is NOT ────────────────────────────────────────────────
 *
 * It is not an application list, and the code must not drift into implying it
 * is. Probing thirteen boards across four providers found real India-located
 * engineering roles at these companies and essentially zero entry-level ones:
 * the junior-labelled postings are business and operations roles, while the
 * engineering postings are Senior, Staff, Architect and Director. That is
 * structural rather than a sampling accident — Indian campus placement runs
 * through college placement cells, and off-campus fresher hiring runs through
 * job portals that require keys and forbid scraping.
 *
 * So this screen shows a student what the role they are being measured against
 * looks like in the market right now, and how far they are from it. Presenting
 * these as jobs to apply to would be the honest-looking version of a lie.
 */

/**
 * Hand-authored, like the benchmark. A company earns a place here by using a
 * public ATS board AND hiring engineers in India — both verified by probe, not
 * assumed. Adding a company that fails either check silently contributes
 * nothing, so keep this list checked rather than long.
 */
const COMPANIES: { name: string; provider: "greenhouse" | "lever"; slug: string }[] = [
  { name: "Meesho", provider: "lever", slug: "meesho" },
  { name: "Zeta", provider: "lever", slug: "zeta" },
  { name: "CRED", provider: "lever", slug: "cred" },
  { name: "Razorpay", provider: "greenhouse", slug: "razorpaysoftwareprivatelimited" },
  { name: "Postman", provider: "greenhouse", slug: "postman" },
]

/** Shared across every reader of the same board; postings change daily at most. */
const REVALIDATE_SECONDS = 60 * 60 * 6
const TIMEOUT_MS = 10_000

/**
 * Boards keep postings long after they stop meaning anything — Lever returned
 * a Meesho listing created 54 months ago. The claim this screen makes is about
 * what the market asks for *now*, so anything older than a few months is
 * dropped rather than shown with a caveat.
 */
const MAX_AGE_DAYS = 120

export type Seniority = "entry" | "mid" | "senior"

export type JobPosting = {
  id: string
  title: string
  company: string
  location: string
  url: string
  postedAt: string | null
  seniority: Seniority
  /** Which SkillForge role this maps to, or null when it is not an eng role. */
  roleId: string | null
}

const INDIA = /\b(india|bengaluru|bangalore|hyderabad|pune|noida|gurgaon|gurugram|chennai|mumbai|delhi|kolkata|ahmedabad)\b/i

/**
 * Seniority from the title, deterministically.
 *
 * Titles are the only field every board agrees on, and the vocabulary is
 * small and stable enough that a keyword pass beats a model call: it is
 * instant, free, and a student can be told exactly why a posting was labelled
 * the way it was.
 */
function classifySeniority(title: string): Seniority {
  const t = title.toLowerCase()
  if (/\b(intern|graduate|new grad|campus|trainee|fresher|entry[- ]level|sde[- ]?1|sde[- ]?i)\b/.test(t)) {
    return "entry"
  }
  if (/\b(senior|sr\.?|staff|principal|lead|architect|director|head|vp|manager)\b/.test(t)) {
    return "senior"
  }
  return "mid"
}

/**
 * Title → one of our five target roles, or null.
 *
 * Null is the common and correct answer: most postings on these boards are
 * sales, finance or operations, and a role we do not benchmark cannot be
 * measured against. Guessing would put a student's readiness next to a job it
 * says nothing about.
 */
/**
 * Titles that are not the individual-contributor engineering roles our
 * benchmarks describe.
 *
 * Without this, greedy keywords swallowed "Product Manager I (Platform)",
 * "Senior Manager - Commerce Platform" and "Director – Enterprise Applications
 * & IT Infrastructure" into backend-engineer, because each contained
 * "platform" or "infrastructure". Putting a fresher's readiness next to a
 * director posting is not a small mislabel — it is the screen claiming a
 * comparison it cannot support.
 */
const NOT_IC_ENGINEERING =
  /\b(manager|director|head of|vp|vice president|president|chief|analyst|consultant|sales|account|partnership|finance|taxation|recruit|talent|people|marketing|counsel|legal|compliance|designer|writer|copywriter)\b/i

function classifyRole(title: string): string | null {
  if (NOT_IC_ENGINEERING.test(title)) return null

  const t = title.toLowerCase()
  if (/\b(ml|machine learning|ai|data scien|research engineer)\b/.test(t)) return "ml-engineer"
  if (/\b(data engineer|analytics engineer|data platform|etl|warehouse)\b/.test(t)) return "data-engineer"
  // "Engineer in Test" is the common long form and does not contain the
  // substring "test engineer", so it needs its own alternative or it falls
  // through to backend on the word "software".
  if (/\b(sdet|test engineer|engineer in test|quality engineer|automation engineer|qa)\b/.test(t)) {
    return "sdet"
  }
  if (/\b(full[- ]?stack|frontend|front[- ]end|web engineer|ui engineer)\b/.test(t)) return "full-stack"
  if (/\b(backend|back[- ]end|platform|infrastructure|systems?|software|server|api|devops|sre)\b/.test(t)) {
    return "backend-engineer"
  }
  return null
}

type GreenhouseJob = {
  id: number
  title: string
  absolute_url: string
  updated_at: string | null
  location: { name: string } | null
}

type LeverJob = {
  id: string
  text: string
  hostedUrl: string
  createdAt: number | null
  categories: { location?: string } | null
}

async function fetchBoard(
  company: (typeof COMPANIES)[number]
): Promise<JobPosting[]> {
  const url =
    company.provider === "greenhouse"
      ? `https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs`
      : `https://api.lever.co/v0/postings/${company.slug}?mode=json`

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!response.ok) return []
    const body = await response.json()

    const raw: JobPosting[] =
      company.provider === "greenhouse"
        ? ((body as { jobs?: GreenhouseJob[] }).jobs ?? []).map((j) => ({
            id: `gh-${j.id}`,
            title: j.title,
            company: company.name,
            location: j.location?.name ?? "",
            url: j.absolute_url,
            postedAt: j.updated_at,
            seniority: classifySeniority(j.title),
            roleId: classifyRole(j.title),
          }))
        : (Array.isArray(body) ? (body as LeverJob[]) : []).map((j) => ({
            id: `lv-${j.id}`,
            title: j.text,
            company: company.name,
            location: j.categories?.location ?? "",
            url: j.hostedUrl,
            postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
            seniority: classifySeniority(j.text),
            roleId: classifyRole(j.text),
          }))

    // India-located IC engineering roles, recent enough to still mean
    // something. A posting we cannot place against a benchmark is dropped
    // rather than shown without one.
    const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000
    return raw.filter(
      (j) =>
        INDIA.test(j.location) &&
        j.roleId !== null &&
        // Boards that give no date get the benefit of the doubt; the UI shows
        // "date not given" so the reader can weigh it.
        (j.postedAt === null || new Date(j.postedAt).getTime() >= cutoff)
    )
  } catch (err) {
    console.error(`[jobs] ${company.provider}/${company.slug} failed:`, err)
    return []
  }
}

export type JobBoard = {
  postings: JobPosting[]
  /** Every engineering posting found, before the role filter — for honesty. */
  totalEngineering: number
  entryLevelCount: number
  companiesReporting: number
  companiesAttempted: number
}

/**
 * Postings for one target role, most recent first.
 *
 * `entryLevelCount` is surfaced deliberately: it is almost always zero, and
 * saying so out loud is the difference between an honest screen and one that
 * quietly implies these roles are within reach today.
 */
export async function getJobBoard(roleId: string): Promise<JobBoard> {
  const boards = await Promise.all(COMPANIES.map(fetchBoard))
  const all = boards.flat()
  const postings = all
    .filter((j) => j.roleId === roleId)
    .sort((a, b) => {
      // Entry-level first when it exists at all, then most recently posted.
      const rank = { entry: 0, mid: 1, senior: 2 } as const
      const s = rank[a.seniority] - rank[b.seniority]
      if (s !== 0) return s
      return (b.postedAt ?? "").localeCompare(a.postedAt ?? "")
    })

  return {
    postings,
    totalEngineering: all.length,
    entryLevelCount: postings.filter((j) => j.seniority === "entry").length,
    companiesReporting: boards.filter((b) => b.length > 0).length,
    companiesAttempted: COMPANIES.length,
  }
}

/** "4d ago" — postings go stale fast and the age is part of the evidence. */
export function postedAge(iso: string | null): string {
  if (!iso) return "date not given"
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  return months === 1 ? "1mo ago" : `${months}mo ago`
}
