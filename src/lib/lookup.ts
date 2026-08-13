import "server-only"

/**
 * Keyless external lookup.
 *
 * Every source here answers without an API key, which is deliberate: a
 * reviewer can clone this repo and the mentor's research tools work
 * immediately. Wikipedia and MDN cover "what is X", GitHub covers "show me
 * real code", Hacker News covers "what do practitioners actually think".
 *
 * Every call is time-boxed and failure-tolerant — a lookup that times out
 * degrades to "no results" rather than failing the student's whole message.
 */

const UA = "SkillForge/1.0 (career-prep study tool)"
const TIMEOUT_MS = 8_000

async function fetchJson<T>(url: string, headers: Record<string, string> = {}) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, ...headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// ─── Concepts: Wikipedia, then MDN for web-specific terms ────────────────────

export interface ConceptResult {
  title: string
  summary: string
  url: string
  source: "Wikipedia" | "MDN"
}

export async function lookUpConcept(term: string): Promise<ConceptResult | null> {
  const slug = encodeURIComponent(term.trim().replace(/\s+/g, "_"))

  const wiki = await fetchJson<{
    title?: string
    extract?: string
    type?: string
    content_urls?: { desktop?: { page?: string } }
  }>(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`)

  // Disambiguation pages are noise — fall through to MDN rather than return them.
  if (wiki?.extract && wiki.type !== "disambiguation") {
    return {
      title: wiki.title ?? term,
      summary: wiki.extract,
      url: wiki.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${slug}`,
      source: "Wikipedia",
    }
  }

  const mdn = await fetchJson<{
    documents?: { mdn_url: string; title: string; summary: string }[]
  }>(`https://developer.mozilla.org/api/v1/search?q=${encodeURIComponent(term)}`)

  const doc = mdn?.documents?.[0]
  if (doc) {
    return {
      title: doc.title,
      summary: doc.summary,
      url: `https://developer.mozilla.org${doc.mdn_url}`,
      source: "MDN",
    }
  }

  return null
}

// ─── Repositories: real code to read ─────────────────────────────────────────

export interface RepoResult {
  name: string
  description: string
  url: string
  stars: number
  language: string | null
}

export async function searchRepositories(
  query: string,
  limit = 4
): Promise<RepoResult[]> {
  // Unauthenticated GitHub search allows ~10 req/min — ample for chat, and it
  // fails soft if a demo hits the ceiling.
  const data = await fetchJson<{
    items?: {
      full_name: string
      description: string | null
      html_url: string
      stargazers_count: number
      language: string | null
    }[]
  }>(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(
      query
    )}&sort=stars&order=desc&per_page=${limit}`,
    { accept: "application/vnd.github+json" }
  )

  return (data?.items ?? []).map((r) => ({
    name: r.full_name,
    description: r.description ?? "",
    url: r.html_url,
    stars: r.stargazers_count,
    language: r.language,
  }))
}

// ─── Discussions: what practitioners say ─────────────────────────────────────

export interface DiscussionResult {
  title: string
  url: string
  points: number
  comments: number
  year: number | null
}

export async function searchDiscussions(
  query: string,
  limit = 4
): Promise<DiscussionResult[]> {
  const data = await fetchJson<{
    hits?: {
      title: string | null
      url: string | null
      objectID: string
      points: number | null
      num_comments: number | null
      created_at: string | null
    }[]
  }>(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
      query
    )}&tags=story&hitsPerPage=${limit * 2}`
  )

  return (data?.hits ?? [])
    .filter((h) => h.title)
    .slice(0, limit)
    .map((h) => ({
      title: h.title as string,
      // Ask-HN threads have no external url; link the discussion itself.
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      points: h.points ?? 0,
      comments: h.num_comments ?? 0,
      year: h.created_at ? new Date(h.created_at).getFullYear() : null,
    }))
}
