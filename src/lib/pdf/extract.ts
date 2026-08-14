import { extractText, getDocumentProxy } from "unpdf"

export interface ExtractedResume {
  pageCount: number
  /** One entry per page. Page and line indices are what make citations real. */
  pagesText: string[]
  rawText: string
  parseMs: number
  /**
   * How the text was recovered. `text-layer` means the page indices below are
   * the PDF's real ones; `ocr` and `pasted` mean they are synthesised, so a
   * citation still verifies against what the model was shown but does not
   * correspond to a physical page.
   */
  source: "text-layer" | "ocr" | "pasted"
}

export class ResumeParseError extends Error {
  constructor(
    message: string,
    readonly kind: "encrypted" | "no-text-layer" | "unreadable"
  ) {
    super(message)
    this.name = "ResumeParseError"
  }
}

/** Below this, the PDF is almost certainly a scan or outlined text. */
const MIN_USEFUL_CHARS = 200

/**
 * Normalises a page while PRESERVING ITS LINE COUNT.
 *
 * Every transformation here replaces rather than deletes, because line indices
 * are load-bearing: a flag citing "p.1 L7" is verified by looking up line 7 of
 * page 1, and dropping a blank line would silently shift every citation below
 * it by one.
 */
function normalisePage(page: string): string {
  return page
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      line
        // Soft hyphens and zero-width characters
        .replace(/[­​-‍﻿]/g, "")
        // Ligatures that break substring matching against the quote
        .replace(/ﬁ/g, "fi")
        .replace(/ﬂ/g, "fl")
        .replace(/ﬀ/g, "ff")
        .replace(/ﬃ/g, "ffi")
        .replace(/ﬄ/g, "ffl")
        // Non-breaking and exotic spaces
        .replace(/[  -   　]/g, " ")
        // Two-column layouts emit long space runs between columns
        .replace(/ {3,}/g, "  ")
        .trimEnd()
    )
    .join("\n")
}

/**
 * PDF bytes → page-separated text.
 *
 * `mergePages: false` is the important flag: the string[] is what gives page
 * indices, and splitting each page on \n gives line indices. Without it,
 * "p.1 L7" in the flagged-lines panel would be decoration.
 */
export async function extractResume(
  bytes: Uint8Array
): Promise<ExtractedResume> {
  const started = performance.now()

  let pdf
  try {
    pdf = await getDocumentProxy(bytes)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    if (/password|encrypt/i.test(message)) {
      throw new ResumeParseError(
        "That PDF is password protected. Save an unprotected copy and upload it again.",
        "encrypted"
      )
    }
    throw new ResumeParseError(
      "That file could not be read as a PDF.",
      "unreadable"
    )
  }

  let totalPages: number
  let pagesText: string[]
  try {
    const extracted = await extractText(pdf, { mergePages: false })
    totalPages = extracted.totalPages
    pagesText = (extracted.text as string[]).map(normalisePage)
  } catch {
    // A PDF that opens but fails mid-extraction (corrupt content streams) must
    // land on the 422 path, not as an uncaught 500 the client reads as a
    // network failure.
    throw new ResumeParseError(
      "That PDF could not be read — some of it appears to be damaged.",
      "unreadable"
    )
  }
  const rawText = pagesText.join("\n\n")

  if (rawText.trim().length < MIN_USEFUL_CHARS) {
    throw new ResumeParseError(
      "That PDF has no selectable text — it's likely a scan or an image export. Switch to \"Paste the text\" and paste your resume instead.",
      "no-text-layer"
    )
  }

  return {
    pageCount: totalPages,
    pagesText,
    rawText,
    parseMs: Math.round(performance.now() - started),
    source: "text-layer",
  }
}

/** Lines per synthesised page when the source has no real page boundaries. */
export const PSEUDO_PAGE_LINES = 60

/**
 * Text with no page structure → the same `string[]` shape the rest of the
 * pipeline works on.
 *
 * Pasted resumes and OCR output arrive as one blob, but citations, the flagged
 * lines panel and `verifyQuote` all index by page and line. Chunking into fixed
 * pseudo-pages keeps "p.2 L14" meaningful and verifiable: it points at the text
 * the model was actually shown, which is what the guard checks. It just is not
 * the physical page — hence `source` on ExtractedResume.
 */
export function pseudoPages(text: string): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  const pages: string[] = []
  for (let i = 0; i < lines.length; i += PSEUDO_PAGE_LINES) {
    pages.push(normalisePage(lines.slice(i, i + PSEUDO_PAGE_LINES).join("\n")))
  }
  return pages
}

/**
 * The prompt fragment the extraction agent sees. Numbering every line is what
 * lets the model cite a location, and lets us verify the citation afterwards.
 */
export function numberLines(pagesText: string[], maxChars = 14_000): string {
  const out: string[] = []
  let used = 0
  let truncated = false

  for (let p = 0; p < pagesText.length; p++) {
    const lines = pagesText[p].split("\n")
    for (let l = 0; l < lines.length; l++) {
      if (!lines[l].trim()) continue
      const entry = `[p${p + 1} L${l + 1}] ${lines[l]}`
      if (used + entry.length > maxChars) {
        truncated = true
        break
      }
      out.push(entry)
      used += entry.length + 1
    }
    if (truncated) break
  }

  if (truncated) out.push("[... truncated: resume exceeds the length limit]")
  return out.join("\n")
}

/**
 * Verifies a model-supplied citation against the source.
 *
 * Returns false when the quote does not occur on that line, which is how
 * hallucinated flags get dropped before they reach the database. Whitespace is
 * collapsed on both sides so a quote is not rejected over a double space.
 */
export function verifyQuote(
  pagesText: string[],
  page: number,
  line: number,
  quote: string
): boolean {
  const pageText = pagesText[page - 1]
  if (!pageText) return false

  const lineText = pageText.split("\n")[line - 1]
  if (!lineText) return false

  const flatten = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase()
  const haystack = flatten(lineText)
  const needle = flatten(quote)

  return needle.length > 0 && haystack.includes(needle)
}
