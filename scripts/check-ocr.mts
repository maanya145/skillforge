/**
 * Is the OCR fallback wired up, and does it degrade safely when it isn't?
 *
 *   npm run check:ocr
 *
 * With no FIRECRAWL_API_KEY this proves the important property: the fallback
 * returns null rather than throwing, so a PDF with no text layer lands on the
 * "paste the text" message instead of a 500.
 *
 * With a key set it makes a real call against the fixture resume and prints
 * what came back. That spends credits (~1 per page) — it is the only way to
 * know the contract still holds.
 */
import { readFile } from "node:fs/promises"

import { ocrResume } from "@/lib/pdf/firecrawl"
import { verifyQuote } from "@/lib/pdf/extract"

const bytes = new Uint8Array(
  await readFile("fixtures/aarav-menon-resume-v4.pdf")
)

const configured = Boolean(process.env.FIRECRAWL_API_KEY)
console.log(`FIRECRAWL_API_KEY: ${configured ? "set" : "not set"}\n`)

if (!configured) {
  const result = await ocrResume(bytes, "resume.pdf")
  console.log(
    result === null
      ? "✓ Returns null with no key — uploads without a text layer fall back to\n" +
          "  the paste path, which is the intended behaviour.\n\n" +
          "  Set FIRECRAWL_API_KEY in .env.local to enable OCR for scanned PDFs."
      : "✗ Expected null with no key, got a result."
  )
  process.exit(result === null ? 0 : 1)
}

console.log("Calling Firecrawl /v2/parse with the fixture resume…")
const started = performance.now()
const result = await ocrResume(bytes, "aarav-menon-resume-v4.pdf")
const elapsed = Math.round(performance.now() - started)

if (!result) {
  console.error(`✗ OCR returned null after ${elapsed}ms — see the error above.`)
  process.exit(1)
}

console.log(`✓ ${elapsed}ms · ${result.pageCount} pages · source=${result.source}`)
console.log(`  ${result.rawText.length} chars over ${result.pagesText.length} pseudo-pages`)

// The whole point of the pseudo-page split is that citations still verify.
const firstLine = result.pagesText[0]?.split("\n").find((l) => l.trim())
if (firstLine) {
  const ok = verifyQuote(result.pagesText, 1, result.pagesText[0].split("\n").indexOf(firstLine) + 1, firstLine)
  console.log(`  citation round-trip: ${ok ? "✓" : "✗"}`)
}

console.log("\nFirst 5 non-empty lines:")
for (const line of result.rawText.split("\n").filter((l) => l.trim()).slice(0, 5)) {
  console.log(`  ${line.slice(0, 90)}`)
}
