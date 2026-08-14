import { describe, expect, it } from "vitest"

import {
  inspectGithubPortfolio,
  parseGithubRepositoryUrl,
  type GithubPortfolioSnapshot,
} from "./github-portfolio"

describe("parseGithubRepositoryUrl", () => {
  it("accepts a public repository URL and strips .git", () => {
    expect(parseGithubRepositoryUrl("https://github.com/skillforge/demo.git")).toEqual({
      owner: "skillforge",
      repo: "demo",
    })
  })

  it("rejects non-GitHub and repository-less URLs", () => {
    expect(() => parseGithubRepositoryUrl("https://gitlab.com/a/b")).toThrow()
    expect(() => parseGithubRepositoryUrl("https://github.com/skillforge")).toThrow()
  })

  it("rejects hosts that merely look like GitHub", () => {
    expect(() => parseGithubRepositoryUrl("https://github.com.evil.tld/a/b")).toThrow()
    expect(() => parseGithubRepositoryUrl("http://github.com/a/b")).toThrow()
  })

  it("neutralises path traversal rather than passing it through", () => {
    // The URL constructor resolves ".." before we ever look at the path, so
    // this lands on a harmless owner/repo that simply will not exist. Asserted
    // because the safety here is inherited from URL parsing, not written down.
    expect(parseGithubRepositoryUrl("https://github.com/../../etc/passwd")).toEqual({
      owner: "etc",
      repo: "passwd",
    })
    // Percent-encoded separators survive normalisation, and those ARE rejected.
    expect(() => parseGithubRepositoryUrl("https://github.com/a/..%2f..%2fetc")).toThrow()
  })
})

/**
 * `inspectablePaths` defaults to the fetched files' paths, which is the common
 * case. Pass it explicitly to model the important one: a repository whose tree
 * is larger than the fetch budget.
 */
const snapshot = (
  files: GithubPortfolioSnapshot["files"],
  overrides: Partial<GithubPortfolioSnapshot> = {}
): GithubPortfolioSnapshot => ({
  provider: "github",
  owner: "skillforge",
  repo: "demo",
  url: "https://github.com/skillforge/demo",
  defaultBranch: "main",
  commitSha: "abc123",
  stars: 0,
  forks: 0,
  language: "TypeScript",
  updatedAt: null,
  inspectablePaths: files.map((f) => f.path),
  treeTruncated: false,
  files,
  ...overrides,
})

describe("inspectGithubPortfolio", () => {
  it("reports deterministic signals, and separates truncated from unreadable", () => {
    const signals = inspectGithubPortfolio(
      snapshot([
        { path: "README.md", size: 10, text: "# Demo", truncated: false, unreadable: false },
        { path: "tests/app.test.ts", size: 10, text: "test", truncated: false, unreadable: false },
        { path: ".github/workflows/ci.yml", size: 10, text: null, truncated: false, unreadable: true },
        { path: "Dockerfile", size: 60_000, text: "FROM node", truncated: true, unreadable: false },
      ])
    )

    expect(signals).toEqual({
      hasReadme: true,
      hasTests: true,
      hasCi: true,
      hasDocker: true,
      hasDeploymentConfig: false,
      // A README is not documentation — see hasReadme. Counting it twice would
      // let one artefact prove itself twice.
      hasDocumentation: false,
      hasPackageManifest: false,
      hasPublicRepository: true,
      inspectedPaths: [
        "README.md",
        "tests/app.test.ts",
        ".github/workflows/ci.yml",
        "Dockerfile",
      ],
      excerptedPaths: [
        "README.md",
        "tests/app.test.ts",
        ".github/workflows/ci.yml",
        "Dockerfile",
      ],
      truncatedPaths: ["Dockerfile"],
      unreadablePaths: [".github/workflows/ci.yml"],
      treeTruncated: false,
    })
  })

  /**
   * The regression that shipped in the original: signals were read from the
   * fetched files, so anything past the 24-file budget was reported absent.
   * On a real repository that meant "no README" for repositories with one.
   */
  it("detects signals beyond the fetch budget", () => {
    const signals = inspectGithubPortfolio(
      snapshot(
        [{ path: ".github/workflows/a.yml", size: 1, text: "x", truncated: false, unreadable: false }],
        {
          inspectablePaths: [
            ".github/workflows/a.yml",
            "README.md",
            "docs/architecture.md",
            "test/unit.spec.ts",
            "package.json",
          ],
        }
      )
    )

    expect(signals.hasReadme).toBe(true)
    expect(signals.hasDocumentation).toBe(true)
    expect(signals.hasTests).toBe(true)
    expect(signals.hasPackageManifest).toBe(true)
    // Only one file's contents were fetched, and that is reported separately.
    expect(signals.excerptedPaths).toEqual([".github/workflows/a.yml"])
  })

  it("carries the tree-truncated flag so absence is never overclaimed", () => {
    const signals = inspectGithubPortfolio(
      snapshot([], { inspectablePaths: [], treeTruncated: true })
    )
    expect(signals.hasReadme).toBe(false)
    expect(signals.treeTruncated).toBe(true)
  })

  it("counts a real docs directory as documentation", () => {
    const signals = inspectGithubPortfolio(
      snapshot([
        { path: "docs/architecture.md", size: 10, text: "x", truncated: false, unreadable: false },
      ])
    )
    expect(signals.hasDocumentation).toBe(true)
    expect(signals.hasReadme).toBe(false)
  })

  it("reports nothing for an empty snapshot rather than guessing", () => {
    const signals = inspectGithubPortfolio(snapshot([]))
    expect(signals.hasReadme).toBe(false)
    expect(signals.hasTests).toBe(false)
    expect(signals.hasCi).toBe(false)
    expect(signals.inspectedPaths).toEqual([])
    expect(signals.excerptedPaths).toEqual([])
    expect(signals.truncatedPaths).toEqual([])
    expect(signals.unreadablePaths).toEqual([])
  })
})
