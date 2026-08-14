import { describe, it, expect } from "vitest"
import { readFile } from "node:fs/promises"

import {
  extractResume,
  numberLines,
  pseudoPages,
  verifyQuote,
} from "./extract"

const PAGES = [
  "AARAV MENON\nB.Tech CSE, VIT Vellore, 2026\n\nEXPERIENCE\nZeta — Backend intern\nImproved performance significantly.\nFamiliar with Docker",
  "PROJECTS\nWeather CLI — Python\nCampus Mess Portal — Django, Postgres, 400 users",
]

describe("numberLines", () => {
  it("labels every non-empty line with a page and line number", () => {
    const out = numberLines(PAGES)
    expect(out).toContain("[p1 L1] AARAV MENON")
    expect(out).toContain("[p1 L6] Improved performance significantly.")
    expect(out).toContain("[p2 L1] PROJECTS")
  })

  it("skips blank lines without renumbering the ones after them", () => {
    const out = numberLines(PAGES)
    // Line 3 of page 1 is blank and absent, but EXPERIENCE keeps its real index
    expect(out).not.toContain("[p1 L3]")
    expect(out).toContain("[p1 L4] EXPERIENCE")
  })

  it("truncates loudly rather than silently", () => {
    const out = numberLines(PAGES, 80)
    expect(out).toContain("truncated")
    expect(out.length).toBeLessThan(200)
  })
})

describe("verifyQuote — the anti-hallucination guard", () => {
  it("accepts a quote that really is on that line", () => {
    expect(
      verifyQuote(PAGES, 1, 6, "Improved performance significantly.")
    ).toBe(true)
  })

  it("accepts a substring of the line", () => {
    expect(verifyQuote(PAGES, 1, 7, "Familiar with Docker")).toBe(true)
  })

  it("tolerates whitespace and case differences", () => {
    expect(verifyQuote(PAGES, 1, 7, "  familiar   with DOCKER ")).toBe(true)
  })

  it("rejects a quote that is on a different line", () => {
    expect(verifyQuote(PAGES, 1, 1, "Familiar with Docker")).toBe(false)
  })

  it("rejects a quote that is on a different page", () => {
    expect(verifyQuote(PAGES, 2, 7, "Familiar with Docker")).toBe(false)
  })

  it("rejects text that appears nowhere — the invented-flag case", () => {
    expect(
      verifyQuote(PAGES, 1, 6, "Led a team of 40 engineers at Google")
    ).toBe(false)
  })

  it("rejects out-of-range citations instead of throwing", () => {
    expect(verifyQuote(PAGES, 9, 1, "anything")).toBe(false)
    expect(verifyQuote(PAGES, 1, 999, "anything")).toBe(false)
    expect(verifyQuote(PAGES, 0, 0, "anything")).toBe(false)
  })

  it("rejects an empty quote", () => {
    expect(verifyQuote(PAGES, 1, 1, "   ")).toBe(false)
  })
})

/**
 * Pasted text and OCR output both arrive with no page structure. Chunking them
 * has to keep citations verifiable, which means the line count must survive.
 */
describe("pseudoPages", () => {
  const lines = (n: number) =>
    Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n")

  it("chunks at the page boundary", () => {
    expect(pseudoPages(lines(60))).toHaveLength(1)
    expect(pseudoPages(lines(61))).toHaveLength(2)
    expect(pseudoPages(lines(180))).toHaveLength(3)
  })

  it("preserves every line, in order, across the split", () => {
    const pages = pseudoPages(lines(125))
    expect(pages.join("\n").split("\n")).toHaveLength(125)
    expect(pages[0].split("\n")[0]).toBe("line 1")
    expect(pages[1].split("\n")[0]).toBe("line 61")
    expect(pages[2].split("\n")[0]).toBe("line 121")
  })

  it("keeps citations checkable against the chunked result", () => {
    const pages = pseudoPages(`${lines(60)}\nFamiliar with Docker`)
    // Line 61 of the source is line 1 of the second pseudo-page.
    expect(verifyQuote(pages, 2, 1, "Familiar with Docker")).toBe(true)
    expect(verifyQuote(pages, 1, 1, "Familiar with Docker")).toBe(false)
  })

  it("normalises without shifting line indices", () => {
    // A blank line and a ligature on either side of the quoted line: neither
    // may move it, or every citation below would be off by one.
    const pages = pseudoPages("header\n\nveriﬁed the ﬂow\ntail")
    expect(pages[0].split("\n")).toHaveLength(4)
    expect(verifyQuote(pages, 1, 3, "verified the flow")).toBe(true)
  })

  it("handles empty and single-line input without throwing", () => {
    expect(pseudoPages("")).toEqual([""])
    expect(pseudoPages("just one line")).toEqual(["just one line"])
  })
})

/**
 * End-to-end over real PDF bytes. The unit tests above prove the citation
 * logic; this proves the whole chain — bytes → pages → line indices → a
 * verified quote — which is the path every flagged resume line travels.
 */
describe("extractResume — real PDF bytes", () => {
  const load = async () =>
    extractResume(
      new Uint8Array(await readFile("fixtures/aarav-menon-resume-v4.pdf"))
    )

  it("reads the fixture resume", async () => {
    const r = await load()
    expect(r.pageCount).toBe(1)
    expect(r.rawText).toContain("AARAV MENON")
    expect(r.parseMs).toBeGreaterThanOrEqual(0)
  })

  it("keeps line indices aligned with the source document", async () => {
    const { pagesText } = await load()
    const lines = pagesText[0].split("\n")
    expect(lines[0]).toBe("AARAV MENON")
    expect(lines[3]).toBe("EDUCATION")
  })

  it("verifies a real citation against the extracted text", async () => {
    const { pagesText } = await load()
    const lines = pagesText[0].split("\n")

    // The weak claim the intake screen flags, located the way the model must
    const idx = lines.findIndex((l) => l.includes("Improved performance"))
    expect(idx).toBeGreaterThan(-1)

    expect(
      verifyQuote(pagesText, 1, idx + 1, "Improved performance significantly.")
    ).toBe(true)
    // And an invented flag on the same line is still rejected
    expect(verifyQuote(pagesText, 1, idx + 1, "Reduced p99 by 80%")).toBe(false)
  })

  it("produces a prompt fragment the agent can cite from", async () => {
    const { pagesText } = await load()
    const prompt = numberLines(pagesText)
    expect(prompt).toMatch(/^\[p1 L1\] AARAV MENON/)
    expect(prompt).toContain("Familiar with Docker")
  })
})
