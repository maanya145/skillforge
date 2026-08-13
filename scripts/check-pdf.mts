/**
 * Runs the real extractor over a real PDF and prints what the agent would see.
 *
 *   npx tsx scripts/check-pdf.ts fixtures/aarav-menon-resume-v4.pdf
 *
 * Run this against at least four resumes before demo day — single column, two
 * column, an Overleaf/LaTeX export and a Canva export. The last two are where
 * text extraction usually goes wrong.
 */
import { readFile } from "node:fs/promises"

import { extractResume, numberLines, ResumeParseError } from "../src/lib/pdf/extract"

const path = process.argv[2]
if (!path) {
  console.error("usage: tsx scripts/check-pdf.ts <file.pdf>")
  process.exit(1)
}

const bytes = new Uint8Array(await readFile(path))

try {
  const r = await extractResume(bytes)

  console.log(`file       ${path}`)
  console.log(`pages      ${r.pageCount}`)
  console.log(`characters ${r.rawText.length}`)
  console.log(`parse      ${r.parseMs}ms`)

  for (let p = 0; p < r.pagesText.length; p++) {
    const lines = r.pagesText[p].split("\n")
    console.log(`\n── page ${p + 1} — ${lines.length} lines ──`)
    lines.slice(0, 8).forEach((line, i) => {
      console.log(`  [p${p + 1} L${i + 1}] ${line.slice(0, 88)}`)
    })
    if (lines.length > 8) console.log(`  … ${lines.length - 8} more`)
  }

  const prompt = numberLines(r.pagesText)
  console.log(`\n── prompt fragment: ${prompt.length} chars ──`)
  console.log(prompt.split("\n").slice(0, 5).join("\n"))
} catch (err) {
  if (err instanceof ResumeParseError) {
    console.error(`\n${err.kind}: ${err.message}`)
    process.exit(2)
  }
  throw err
}
