import "server-only"

import { pseudoPages, type ExtractedResume } from "./extract"

/**
 * OCR fallback for PDFs with no text layer.
 *
 * This runs *only* where `unpdf` has already failed — a scan, a photo, a Canva
 * export, or LaTeX with outlined glyphs. It deliberately does not replace the
 * primary path: Firecrawl returns one markdown blob with no page boundaries,
 * whereas `unpdf` gives real `string[]` pages, and those page indices are what
 * make `p.1 L7` a checkable citation rather than decoration. Downgrading every
 * resume to synthesised pages to rescue the minority that need it would be a
 * bad trade.
 *
 * It is also the only point in the product where a student's resume leaves our
 * infrastructure, so it stays off unless FIRECRAWL_API_KEY is explicitly set.
 */

const ENDPOINT = "https://api.firecrawl.dev/v2/parse"

/** Comfortably inside the upload route's budget, and well past Fire-PDF's
 *  ~400ms/page even for a slow scan. */
const TIMEOUT_MS = 60_000

/** Resumes are one or two pages. A cap bounds both latency and credit spend. */
const MAX_PAGES = 8

export const ocrConfigured = Boolean(process.env.FIRECRAWL_API_KEY)

type ParseResponse = {
  success?: boolean
  data?: {
    markdown?: string
    metadata?: { numPages?: number; totalPages?: number }
  }
  error?: string
}

/**
 * PDF bytes → text, via Firecrawl's `/v2/parse`.
 *
 * Returns null rather than throwing on every failure mode — a missing key, a
 * dead endpoint, an empty result. The caller already holds a perfectly good
 * error message telling the student to paste their text, and a third-party
 * outage must degrade to that rather than turn into a 500.
 */
export async function ocrResume(
  bytes: Uint8Array,
  fileName: string
): Promise<ExtractedResume | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return null

  const started = performance.now()

  try {
    const form = new FormData()
    form.append(
      "file",
      new Blob([bytes as BlobPart], { type: "application/pdf" }),
      fileName || "resume.pdf"
    )
    // `mode: "ocr"` rather than "auto": we only get here because there is
    // demonstrably no text layer, so paying for classification first is waste.
    form.append(
      "options",
      JSON.stringify({
        formats: ["markdown"],
        parsers: [{ type: "pdf", mode: "ocr", maxPages: MAX_PAGES }],
        timeout: TIMEOUT_MS,
      })
    )

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      console.error(
        `[ocr] firecrawl returned ${response.status}:`,
        (await response.text().catch(() => "")).slice(0, 300)
      )
      return null
    }

    const body = (await response.json()) as ParseResponse
    const markdown = body.data?.markdown
    if (!markdown) {
      console.error("[ocr] firecrawl returned no markdown:", body.error ?? "")
      return null
    }

    const cleaned = stripMarkdownNoise(markdown)
    // OCR that recovers almost nothing is a failure wearing a success costume.
    if (cleaned.trim().length < 200) {
      console.error("[ocr] firecrawl recovered too little text to score")
      return null
    }

    const pagesText = pseudoPages(cleaned)

    return {
      pageCount:
        body.data?.metadata?.numPages ??
        body.data?.metadata?.totalPages ??
        pagesText.length,
      pagesText,
      rawText: pagesText.join("\n\n"),
      parseMs: Math.round(performance.now() - started),
      source: "ocr",
    }
  } catch (err) {
    console.error("[ocr] firecrawl call failed:", err)
    return null
  }
}

/**
 * Markdown scaffolding the extractor does not need.
 *
 * Embedded images are the expensive one — a base64 data URI from a scan can be
 * tens of thousands of characters and would eat the whole prompt budget before
 * the model reaches the work history. Line count is preserved so the pseudo-page
 * indices stay stable.
 */
function stripMarkdownNoise(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) =>
      line
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/^#{1,6}\s+/, "")
        .replace(/^\s*[-*+]\s+/, "· ")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .trimEnd()
    )
    .join("\n")
}
