/**
 * Bounded, read-only inspection of a public GitHub repository.
 *
 * This is the evidence side of the determinism contract applied to portfolios:
 * every signal below is computed in TypeScript from file *paths* in the commit
 * tree, never from a model reading the code. The agent gets to interpret what
 * the signals mean; it never gets to decide whether they are present.
 *
 * Repository *discovery* deliberately lives elsewhere — `searchRepositories` in
 * src/lib/lookup.ts already backs the mentor's find_learning_resources tool.
 * Verification starts from a normalised owner/repo, never from search prose.
 */
const GITHUB_API = "https://api.github.com"
const REQUEST_TIMEOUT_MS = 8_000
const MAX_FILES = 24
const MAX_FILE_BYTES = 48_000

export type GithubRepositoryRef = {
  owner: string
  repo: string
}

export type GithubFile = {
  path: string
  size: number
  text: string | null
  /** Present, but clipped at MAX_FILE_BYTES. */
  truncated: boolean
  /** Listed in the tree, but the fetch failed — a different claim entirely. */
  unreadable: boolean
}

export type GithubPortfolioSnapshot = {
  provider: "github"
  owner: string
  repo: string
  url: string
  defaultBranch: string
  commitSha: string
  stars: number
  forks: number
  language: string | null
  updatedAt: string | null
  /** Every evidence-bearing path in the commit tree. Signals are read from here. */
  inspectablePaths: string[]
  /** GitHub truncates the tree for very large repositories. */
  treeTruncated: boolean
  /** The subset whose contents were actually fetched, for quoting. */
  files: GithubFile[]
}

export type PortfolioSignals = {
  hasReadme: boolean
  hasTests: boolean
  hasCi: boolean
  hasDocker: boolean
  hasDeploymentConfig: boolean
  hasDocumentation: boolean
  hasPackageManifest: boolean
  hasPublicRepository: true
  /** Every evidence-bearing path seen in the tree — what the signals are from. */
  inspectedPaths: string[]
  /** The subset quoted back, capped by the fetch budget. */
  excerptedPaths: string[]
  /** Read, but clipped — the signal is real, the excerpt is partial. */
  truncatedPaths: string[]
  /** Could not be read at all — report as "unavailable", never as absent. */
  unreadablePaths: string[]
  /** When true, a false signal means "not in the part we saw", not "absent". */
  treeTruncated: boolean
}

export function parseGithubRepositoryUrl(value: string): GithubRepositoryRef {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error("Enter a valid GitHub repository URL.")
  }

  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
    throw new Error("Only public GitHub repository URLs are supported right now.")
  }

  const parts = url.pathname.split("/").filter(Boolean)
  if (parts.length < 2 || parts.length > 3) {
    throw new Error("Use a repository URL such as https://github.com/owner/repository.")
  }

  const [owner, repoWithSuffix] = parts
  const repo = repoWithSuffix.replace(/\.git$/, "")
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error("That GitHub repository URL contains an invalid owner or repository name.")
  }

  return { owner, repo }
}

async function githubJson<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN?.trim()
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "SkillForge/1.0 (portfolio verifier)",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    if (response.status === 404) throw new Error("That GitHub repository was not found or is not public.")
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub rate-limited this check. Add GITHUB_TOKEN or try again later.")
    }
    throw new Error(`GitHub returned HTTP ${response.status} while checking the repository.`)
  }

  return (await response.json()) as T
}

async function githubText(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: {
      accept: "text/plain",
      "user-agent": "SkillForge/1.0 (portfolio verifier)",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) return null
  const contentLength = Number(response.headers.get("content-length") ?? 0)
  if (contentLength > MAX_FILE_BYTES) return null
  const text = await response.text()
  return text.length > MAX_FILE_BYTES ? text.slice(0, MAX_FILE_BYTES) : text
}

type GithubRepoResponse = {
  html_url: string
  default_branch: string
  stargazers_count: number
  forks_count: number
  language: string | null
  updated_at: string | null
}

type GithubTreeResponse = {
  sha: string
  truncated: boolean
  tree: { path?: string; type?: string; size?: number; sha?: string }[]
}

const INSPECTABLE_PATH = /(^|\/)(readme(?:\.[^/]+)?|package\.json|pyproject\.toml|requirements[^/]*|go\.mod|cargo\.toml|dockerfile|docker-compose[^/]*|tsconfig\.json|jest\.config\.[^/]+|vitest\.config\.[^/]+|pytest\.ini|makefile|\.github\/workflows\/[^/]+|docs\/[^/]+|test[^/]*\/[^/]+|tests?\/[^/]+)$/i

function inspectable(path: string) {
  return INSPECTABLE_PATH.test(path) || /(^|\/)(test|tests|spec|specs)(\/|$)/i.test(path)
}

/**
 * Which files are worth spending the fetch budget on.
 *
 * The budget used to be spent in alphabetical order, which meant that on any
 * repository with more than a couple of dozen inspectable paths it was
 * exhausted somewhere in `.github/` long before reaching `README.md`. Signals
 * were then computed from that arbitrary slice, so a mature repository
 * reported "no README, no tests" — and in this product, under-reporting is a
 * claim about someone's work.
 *
 * Signals now come from the whole tree (below); this ranking only decides whose
 * *contents* get quoted back.
 */
function excerptPriority(path: string): number {
  const p = path.toLowerCase()
  if (/^readme(\.|$)/.test(p)) return 0
  if (/^(package\.json|pyproject\.toml|go\.mod|cargo\.toml|requirements)/.test(p)) return 1
  if (p.includes("dockerfile") || p.includes("docker-compose")) return 2
  if (p.startsWith(".github/workflows/")) return 3
  if (p.startsWith("docs/")) return 4
  return 5
}

export async function fetchGithubPortfolioSnapshot(
  input: GithubRepositoryRef
): Promise<GithubPortfolioSnapshot> {
  const encodedOwner = encodeURIComponent(input.owner)
  const encodedRepo = encodeURIComponent(input.repo)
  const repo = await githubJson<GithubRepoResponse>(`/repos/${encodedOwner}/${encodedRepo}`)
  const branch = encodeURIComponent(repo.default_branch)
  const tree = await githubJson<GithubTreeResponse>(
    `/repos/${encodedOwner}/${encodedRepo}/git/trees/${branch}?recursive=1`
  )

  // Signal detection reads the whole tree — it is already in hand and costs
  // nothing. Only content fetching is rationed.
  const inspectablePaths = tree.tree
    .filter((entry) => entry.type === "blob" && entry.path && inspectable(entry.path))
    .map((entry) => entry.path as string)
    .sort()

  const candidates = tree.tree
    .filter((entry) => entry.type === "blob" && entry.path && inspectable(entry.path))
    .sort((a, b) => {
      const rank = excerptPriority(a.path ?? "") - excerptPriority(b.path ?? "")
      return rank !== 0 ? rank : (a.path ?? "").localeCompare(b.path ?? "")
    })
    .slice(0, MAX_FILES)

  const files = await Promise.all(
    candidates.map(async (entry) => {
      const path = entry.path as string
      const text = await githubText(
        `https://raw.githubusercontent.com/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/${tree.sha}/${path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`
      )
      return {
        path,
        size: entry.size ?? text?.length ?? 0,
        text,
        truncated: text !== null && (entry.size ?? 0) > MAX_FILE_BYTES,
        unreadable: text === null,
      }
    })
  )

  return {
    provider: "github",
    owner: input.owner,
    repo: input.repo,
    url: repo.html_url,
    defaultBranch: repo.default_branch,
    commitSha: tree.sha,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    language: repo.language,
    updatedAt: repo.updated_at,
    inspectablePaths,
    treeTruncated: tree.truncated === true,
    files,
  }
}

export function inspectGithubPortfolio(snapshot: GithubPortfolioSnapshot): PortfolioSignals {
  const lower = snapshot.inspectablePaths.map((path) => path.toLowerCase())
  const has = (predicate: (path: string) => boolean) => lower.some(predicate)

  return {
    hasReadme: has((path) => path === "readme" || path.startsWith("readme.")),
    hasTests: has((path) => /(^|\/)(test|tests|spec|specs)(\/|$)/.test(path) || /(^|\/)(jest|vitest|pytest)/.test(path)),
    hasCi: has((path) => path.startsWith(".github/workflows/")),
    hasDocker: has((path) => path.includes("dockerfile") || path.includes("docker-compose")),
    hasDeploymentConfig: has((path) => /(^|\/)(vercel|render|fly|railway|terraform|k8s|kubernetes)/.test(path)),
    // Deliberately NOT satisfied by a README — that is `hasReadme`. Counting one
    // file as two signals would let a single artefact prove itself twice if
    // these are ever mapped onto EvidenceSignals.
    hasDocumentation: has((path) => path.startsWith("docs/")),
    hasPackageManifest: has((path) => /(^|\/)(package\.json|pyproject\.toml|requirements[^/]*|go\.mod|cargo\.toml)$/.test(path)),
    hasPublicRepository: true,
    inspectedPaths: snapshot.inspectablePaths,
    excerptedPaths: snapshot.files.map((f) => f.path),
    truncatedPaths: snapshot.files.filter((f) => f.truncated).map((f) => f.path),
    unreadablePaths: snapshot.files.filter((f) => f.unreadable).map((f) => f.path),
    // GitHub truncates the tree response for very large repositories. When it
    // does, a false signal means "not in the part we saw" — never "absent".
    treeTruncated: snapshot.treeTruncated,
  }
}
