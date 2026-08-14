import "server-only"

/**
 * Open Graph preview for a URL.
 *
 * This exists so the model can render media without inventing it. Left to
 * itself a model will happily emit a plausible-looking image URL that 404s, or
 * worse, one that resolves to something unrelated. Here the image, title and
 * description all come from the page's own `<meta>` tags, fetched server-side —
 * so a rendered thumbnail is evidence the page really advertises it.
 */

const TIMEOUT_MS = 8_000
/** Enough for <head> on any sane page; avoids pulling whole documents. */
const MAX_BYTES = 200_000

export type LinkPreview = {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  /** YouTube/Vimeo id when the URL is a video, so it can be embedded. */
  video: { provider: "youtube" | "vimeo"; id: string } | null
}

/** Only these can become an iframe. An arbitrary embed is an XSS surface. */
function detectVideo(url: URL): LinkPreview["video"] {
  const host = url.hostname.replace(/^www\./, "").toLowerCase()

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v")
    if (id && /^[\w-]{11}$/.test(id)) return { provider: "youtube", id }
    const embed = url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})$/)
    if (embed) return { provider: "youtube", id: embed[1] }
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1)
    if (/^[\w-]{11}$/.test(id)) return { provider: "youtube", id }
  }
  if (host === "vimeo.com") {
    const id = url.pathname.match(/^\/(\d+)/)?.[1]
    if (id) return { provider: "vimeo", id }
  }
  return null
}

function meta(html: string, ...names: string[]): string | null {
  for (const name of names) {
    // Attribute order varies, so match either direction.
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`,
        "i"
      ),
    ]
    for (const re of patterns) {
      const found = html.match(re)?.[1]
      if (found) return decodeEntities(found).trim() || null
    }
  }
  return null
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

/**
 * Returns null on anything that isn't a readable public https page — a bad
 * URL, a non-HTML response, a timeout. The caller renders a plain link then,
 * which is a worse card but never a wrong one.
 */
export async function fetchLinkPreview(
  input: string
): Promise<LinkPreview | null> {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  // No http, no other schemes: this URL ends up in an <img> or <iframe>.
  if (url.protocol !== "https:") return null

  const video = detectVideo(url)

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "SkillForge/1.0 (link preview)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) return video ? bare(url, video) : null

    const type = response.headers.get("content-type") ?? ""
    if (!type.includes("html")) return video ? bare(url, video) : null

    const html = (await response.text()).slice(0, MAX_BYTES)

    const rawImage = meta(html, "og:image", "twitter:image", "twitter:image:src")
    let image: string | null = null
    if (rawImage) {
      try {
        const resolved = new URL(rawImage, url)
        // Same rule as the page itself — an http image on an https page is
        // blocked by the browser anyway, so drop it rather than render a hole.
        if (resolved.protocol === "https:") image = resolved.toString()
      } catch {
        image = null
      }
    }

    // YouTube serves a JavaScript shell to plain fetches, so the og tags are
    // often absent even on a 200. The thumbnail is derivable from the id, and
    // is the one image URL it is safe to construct because the id came from
    // the URL the caller supplied rather than from a model.
    if (!image && video?.provider === "youtube") {
      image = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`
    }

    return {
      url: url.toString(),
      title:
        meta(html, "og:title", "twitter:title") ??
        html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ??
        null,
      description: meta(html, "og:description", "description", "twitter:description"),
      image,
      siteName: meta(html, "og:site_name") ?? url.hostname.replace(/^www\./, ""),
      video,
    }
  } catch {
    return video ? bare(url, video) : null
  }
}

/** Concurrency cap: polite to the hosts, and bounds the worst-case latency. */
const MAX_BATCH = 6

/**
 * Previews for several URLs at once.
 *
 * A gallery of four tiles fetched serially would be four round trips deep;
 * done together it costs roughly one. Failures are per-URL — one dead host
 * drops its own tile and leaves the rest of the gallery intact.
 */
export async function fetchLinkPreviews(
  urls: string[]
): Promise<LinkPreview[]> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].slice(
    0,
    MAX_BATCH
  )
  const results = await Promise.all(unique.map((u) => fetchLinkPreview(u)))
  return results.filter((r): r is LinkPreview => r !== null)
}

/** A video we can embed even though the page itself would not load. */
function bare(url: URL, video: NonNullable<LinkPreview["video"]>): LinkPreview {
  return {
    url: url.toString(),
    title: null,
    description: null,
    image:
      video.provider === "youtube"
        ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`
        : null,
    siteName: url.hostname.replace(/^www\./, ""),
    video,
  }
}
