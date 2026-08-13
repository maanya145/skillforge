/**
 * Guards the design system against the classes shadcn and muscle memory
 * reintroduce. Retrofitting 40 components later is how hackathon UIs end up
 * looking generic, so this runs cheap and early.
 *
 *   npm run check:design
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, extname } from "node:path"

const RULES = [
  {
    pattern: /\bfont-(bold|semibold|extrabold|black)\b/,
    why: "Weight caps at 590. Use font-[510] or font-[590].",
  },
  {
    pattern: /\bshadow-(lg|xl|2xl)\b/,
    why: "Elevation is hairline borders and shadow-subtle; overlays use shadow-card.",
  },
  {
    // rounded-full (9999px) IS in the vocabulary — pills, avatars, status dots.
    // These four are not: they'd land on 16px+, above the 12px card maximum.
    pattern: /\brounded-(2xl|3xl|4xl|\[?\d{2,}px\]?)\b/,
    why: "Radius vocabulary is 4 (sm) / 6 (md) / 12 (xl) / 9999 (rounded-full). 12px is the card maximum.",
  },
  {
    pattern: /\b(bg|text|border)-(slate|gray|zinc|stone|neutral)-\d{2,3}\b/,
    why: "Use the Linear palette: void carbon obsidian graphite smoke ash fog mist bone paper.",
  },
  { pattern: /oklch\(/, why: "The Linear values are exact hexes; do not convert to oklch." },
]

const ROOT = "src"
const EXTS = new Set([".ts", ".tsx", ".css"])

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p)
    return EXTS.has(extname(p)) ? [p] : []
  })
}

let failures = 0
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, "utf8").split("\n")
  lines.forEach((line, i) => {
    if (line.includes("check-design-ignore")) return
    for (const { pattern, why } of RULES) {
      const m = line.match(pattern)
      if (m) {
        failures++
        console.error(`${file}:${i + 1}  ${m[0]}\n    ${why}`)
      }
    }
  })
}

if (failures) {
  console.error(`\n${failures} design-system violation(s).`)
  process.exit(1)
}
console.log("Design system clean.")
