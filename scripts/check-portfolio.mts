/**
 * Does the portfolio verifier actually reach GitHub, and are its signals real?
 *
 *   npm run check:portfolio [owner/repo]
 *
 * Defaults to a repository whose signals are known: vercel/next.js has a
 * README, tests, CI workflows and a package manifest, so a run that reports
 * otherwise is a regression in the path matching, not a quiet API change.
 *
 * Works unauthenticated, but GitHub allows only 60 requests per hour per IP
 * that way. Set GITHUB_TOKEN to lift it to 5,000.
 */
import {
  fetchGithubPortfolioSnapshot,
  inspectGithubPortfolio,
  parseGithubRepositoryUrl,
} from "@/lib/github-portfolio"

const target = process.argv[2] ?? "vercel/next.js"
const url = target.startsWith("https://")
  ? target
  : `https://github.com/${target}`

console.log(`GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? "set" : "not set (60 req/hr)"}\n`)

const ref = parseGithubRepositoryUrl(url)
console.log(`Inspecting ${ref.owner}/${ref.repo}…`)

const started = performance.now()
const snapshot = await fetchGithubPortfolioSnapshot(ref)
const signals = inspectGithubPortfolio(snapshot)
const elapsed = Math.round(performance.now() - started)

console.log(
  `✓ ${elapsed}ms · commit ${snapshot.commitSha.slice(0, 8)} · ` +
    `${signals.inspectedPaths.length} evidence paths in tree, ` +
    `${snapshot.files.length} excerpted` +
    (signals.treeTruncated ? " · TREE TRUNCATED by GitHub" : "") +
    "\n"
)

const flags = [
  ["README", signals.hasReadme],
  ["tests", signals.hasTests],
  ["CI", signals.hasCi],
  ["Docker", signals.hasDocker],
  ["deployment config", signals.hasDeploymentConfig],
  ["docs/", signals.hasDocumentation],
  ["package manifest", signals.hasPackageManifest],
] as const

for (const [label, present] of flags) {
  console.log(`  ${present ? "✓" : "·"} ${label}${present ? "" : "  (not observed)"}`)
}

if (signals.truncatedPaths.length) {
  console.log(`\n  truncated:  ${signals.truncatedPaths.join(", ")}`)
}
if (signals.unreadablePaths.length) {
  console.log(`  unavailable: ${signals.unreadablePaths.join(", ")}`)
}

// A snapshot that inspected nothing would still return a full signal object,
// every flag false — indistinguishable from a repository with no evidence.
if (snapshot.files.length === 0) {
  console.error("\n✗ Inspected zero files. Path matching or the tree API changed.")
  process.exit(1)
}

console.log("\nSignals are computed from paths in TypeScript — no model involved.")
