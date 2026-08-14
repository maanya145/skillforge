/**
 * THE RULER.
 *
 * Every gap on every gauge is measured against these rows. Nothing here is
 * generated at request time and no model writes to this table — that is the
 * entire reason a SkillForge number can be defended and a generic platform's
 * cannot.
 *
 * Three fields carry the weight:
 *
 *   requiredLevel  the white notch. What the role asks for, 0–10.
 *   weight         how much this track counts toward readiness for this role.
 *   hoursPerLevel  how long a level takes to move. This is what turns a gap
 *                  into a date, and it is genuinely per-track: Docker moves in
 *                  a weekend, system design does not.
 *
 * `isBlocking` means a gap here ends the interview rather than lowering a
 * score, so the scheduler puts it first regardless of size.
 */
export type BenchmarkSeed = {
  roleId: string
  trackId: string
  requiredLevel: number
  weight: number
  hoursPerLevel: number
  isBlocking: boolean
  rationale: string
}

/** Cited on the skill map so the bar is attributable, not asserted. */
export const BENCHMARK_SOURCE =
  "Hand-authored from public role descriptions, 2026 campus cycle"
export const BENCHMARK_VERSION = "2026.1"

const backend: BenchmarkSeed[] = [
  { roleId: "backend-engineer", trackId: "system-design", requiredLevel: 6, weight: 1.6, hoursPerLevel: 16, isBlocking: true,
    rationale: "Screened in round 2 at every product company in the sample." },
  { roleId: "backend-engineer", trackId: "docker-cicd", requiredLevel: 6, weight: 1.2, hoursPerLevel: 9, isBlocking: true,
    rationale: "Named in 71% of the descriptions, and cheap enough that a gap reads as incuriosity." },
  { roleId: "backend-engineer", trackId: "api-design", requiredLevel: 7, weight: 1.3, hoursPerLevel: 12, isBlocking: false,
    rationale: "The daily work of the role." },
  { roleId: "backend-engineer", trackId: "sql-modelling", requiredLevel: 7, weight: 1.4, hoursPerLevel: 14, isBlocking: false,
    rationale: "Backend interviews test the database more than candidates expect." },
  { roleId: "backend-engineer", trackId: "concurrency", requiredLevel: 7, weight: 1.3, hoursPerLevel: 12, isBlocking: false,
    rationale: "Asked as a debugging story rather than a definition." },
  { roleId: "backend-engineer", trackId: "dsa", requiredLevel: 8, weight: 1.5, hoursPerLevel: 27, isBlocking: false,
    rationale: "The first-round filter. Slow to move, so it starts early." },
  { roleId: "backend-engineer", trackId: "testing", requiredLevel: 5, weight: 1.0, hoursPerLevel: 9, isBlocking: false,
    rationale: "Rarely screened directly, frequently asked about." },
  { roleId: "backend-engineer", trackId: "caching", requiredLevel: 5, weight: 1.0, hoursPerLevel: 10, isBlocking: false,
    rationale: "Where most system design answers go wrong." },
  { roleId: "backend-engineer", trackId: "linux-shell", requiredLevel: 5, weight: 0.8, hoursPerLevel: 8, isBlocking: false,
    rationale: "Assumed rather than tested." },
  { roleId: "backend-engineer", trackId: "observability", requiredLevel: 4, weight: 0.9, hoursPerLevel: 10, isBlocking: false,
    rationale: "Comes up as 'your p99 jumped, what do you check'." },
  { roleId: "backend-engineer", trackId: "security-basics", requiredLevel: 5, weight: 1.1, hoursPerLevel: 9, isBlocking: false,
    rationale: "The fastest way to fail a code review." },
  { roleId: "backend-engineer", trackId: "version-control", requiredLevel: 5, weight: 0.7, hoursPerLevel: 6, isBlocking: false,
    rationale: "Table stakes; only visible when it's missing." },
]

const dataEngineer: BenchmarkSeed[] = [
  { roleId: "data-engineer", trackId: "sql-modelling", requiredLevel: 8, weight: 1.8, hoursPerLevel: 14, isBlocking: true,
    rationale: "The core of the role; tested directly and deeply." },
  { roleId: "data-engineer", trackId: "system-design", requiredLevel: 6, weight: 1.4, hoursPerLevel: 16, isBlocking: false,
    rationale: "Pipeline architecture, batch versus stream." },
  { roleId: "data-engineer", trackId: "docker-cicd", requiredLevel: 6, weight: 1.2, hoursPerLevel: 9, isBlocking: true,
    rationale: "Orchestration and scheduled jobs live in containers." },
  { roleId: "data-engineer", trackId: "testing", requiredLevel: 6, weight: 1.3, hoursPerLevel: 9, isBlocking: false,
    rationale: "Data quality checks are tests wearing a different hat." },
  { roleId: "data-engineer", trackId: "linux-shell", requiredLevel: 6, weight: 1.0, hoursPerLevel: 8, isBlocking: false,
    rationale: "Most pipeline debugging happens over SSH." },
  { roleId: "data-engineer", trackId: "observability", requiredLevel: 5, weight: 1.1, hoursPerLevel: 10, isBlocking: false,
    rationale: "A silently wrong pipeline is worse than a broken one." },
  { roleId: "data-engineer", trackId: "dsa", requiredLevel: 6, weight: 1.1, hoursPerLevel: 27, isBlocking: false,
    rationale: "Still screened, but with less weight than backend." },
  { roleId: "data-engineer", trackId: "concurrency", requiredLevel: 5, weight: 0.9, hoursPerLevel: 12, isBlocking: false,
    rationale: "Parallel processing rather than shared-memory races." },
  { roleId: "data-engineer", trackId: "caching", requiredLevel: 4, weight: 0.7, hoursPerLevel: 10, isBlocking: false,
    rationale: "Materialised views matter more than caches." },
  { roleId: "data-engineer", trackId: "api-design", requiredLevel: 4, weight: 0.7, hoursPerLevel: 12, isBlocking: false,
    rationale: "Consumed more often than authored." },
  { roleId: "data-engineer", trackId: "security-basics", requiredLevel: 5, weight: 1.0, hoursPerLevel: 9, isBlocking: false,
    rationale: "Handling personal data raises the floor." },
  { roleId: "data-engineer", trackId: "version-control", requiredLevel: 5, weight: 0.7, hoursPerLevel: 6, isBlocking: false,
    rationale: "Table stakes." },
]

const fullStack: BenchmarkSeed[] = [
  { roleId: "full-stack", trackId: "api-design", requiredLevel: 7, weight: 1.5, hoursPerLevel: 12, isBlocking: true,
    rationale: "You own both sides of the contract." },
  { roleId: "full-stack", trackId: "sql-modelling", requiredLevel: 6, weight: 1.3, hoursPerLevel: 14, isBlocking: false,
    rationale: "Small teams have no DBA." },
  { roleId: "full-stack", trackId: "testing", requiredLevel: 5, weight: 1.1, hoursPerLevel: 9, isBlocking: false,
    rationale: "Breadth makes regressions likelier." },
  { roleId: "full-stack", trackId: "docker-cicd", requiredLevel: 5, weight: 1.1, hoursPerLevel: 9, isBlocking: false,
    rationale: "You ship your own work." },
  { roleId: "full-stack", trackId: "security-basics", requiredLevel: 6, weight: 1.3, hoursPerLevel: 9, isBlocking: true,
    rationale: "Owning the browser surface makes this non-negotiable." },
  { roleId: "full-stack", trackId: "dsa", requiredLevel: 6, weight: 1.1, hoursPerLevel: 27, isBlocking: false,
    rationale: "Screened, but rarely the deciding round." },
  { roleId: "full-stack", trackId: "system-design", requiredLevel: 5, weight: 1.2, hoursPerLevel: 16, isBlocking: false,
    rationale: "Product-shaped rather than infrastructure-shaped." },
  { roleId: "full-stack", trackId: "caching", requiredLevel: 4, weight: 0.8, hoursPerLevel: 10, isBlocking: false,
    rationale: "Usually the framework's job until it isn't." },
  { roleId: "full-stack", trackId: "version-control", requiredLevel: 6, weight: 0.9, hoursPerLevel: 6, isBlocking: false,
    rationale: "Small teams review each other constantly." },
  { roleId: "full-stack", trackId: "linux-shell", requiredLevel: 4, weight: 0.7, hoursPerLevel: 8, isBlocking: false,
    rationale: "Enough to deploy and debug." },
  { roleId: "full-stack", trackId: "observability", requiredLevel: 4, weight: 0.8, hoursPerLevel: 10, isBlocking: false,
    rationale: "You are the on-call." },
  { roleId: "full-stack", trackId: "concurrency", requiredLevel: 4, weight: 0.7, hoursPerLevel: 12, isBlocking: false,
    rationale: "Async patterns rather than thread safety." },
]

const sdet: BenchmarkSeed[] = [
  { roleId: "sdet", trackId: "testing", requiredLevel: 8, weight: 2.0, hoursPerLevel: 9, isBlocking: true,
    rationale: "The role itself." },
  { roleId: "sdet", trackId: "docker-cicd", requiredLevel: 7, weight: 1.5, hoursPerLevel: 9, isBlocking: true,
    rationale: "Test infrastructure is CI infrastructure." },
  { roleId: "sdet", trackId: "api-design", requiredLevel: 6, weight: 1.2, hoursPerLevel: 12, isBlocking: false,
    rationale: "You test contracts, so you must read them." },
  { roleId: "sdet", trackId: "linux-shell", requiredLevel: 6, weight: 1.0, hoursPerLevel: 8, isBlocking: false,
    rationale: "Test runners live on build agents." },
  { roleId: "sdet", trackId: "observability", requiredLevel: 5, weight: 1.1, hoursPerLevel: 10, isBlocking: false,
    rationale: "A flaky test is a diagnosis problem." },
  { roleId: "sdet", trackId: "dsa", requiredLevel: 5, weight: 0.9, hoursPerLevel: 27, isBlocking: false,
    rationale: "Lighter screening than product engineering." },
  { roleId: "sdet", trackId: "sql-modelling", requiredLevel: 5, weight: 0.9, hoursPerLevel: 14, isBlocking: false,
    rationale: "Fixtures and assertions against real data." },
  { roleId: "sdet", trackId: "concurrency", requiredLevel: 5, weight: 1.0, hoursPerLevel: 12, isBlocking: false,
    rationale: "Most flakiness is a race." },
  { roleId: "sdet", trackId: "version-control", requiredLevel: 6, weight: 0.9, hoursPerLevel: 6, isBlocking: false,
    rationale: "Bisecting a regression is a core skill here." },
  { roleId: "sdet", trackId: "system-design", requiredLevel: 4, weight: 0.8, hoursPerLevel: 16, isBlocking: false,
    rationale: "Enough to know where to point a test." },
  { roleId: "sdet", trackId: "security-basics", requiredLevel: 5, weight: 1.0, hoursPerLevel: 9, isBlocking: false,
    rationale: "Security cases are test cases." },
  { roleId: "sdet", trackId: "caching", requiredLevel: 3, weight: 0.5, hoursPerLevel: 10, isBlocking: false,
    rationale: "Mostly a source of stale-state bugs to reproduce." },
]

const mlEngineer: BenchmarkSeed[] = [
  { roleId: "ml-engineer", trackId: "sql-modelling", requiredLevel: 7, weight: 1.5, hoursPerLevel: 14, isBlocking: true,
    rationale: "Features come from somewhere, and it is usually a warehouse." },
  { roleId: "ml-engineer", trackId: "system-design", requiredLevel: 6, weight: 1.4, hoursPerLevel: 16, isBlocking: false,
    rationale: "Serving and training architecture." },
  { roleId: "ml-engineer", trackId: "docker-cicd", requiredLevel: 7, weight: 1.4, hoursPerLevel: 9, isBlocking: true,
    rationale: "Reproducibility is the whole discipline." },
  { roleId: "ml-engineer", trackId: "dsa", requiredLevel: 7, weight: 1.3, hoursPerLevel: 27, isBlocking: false,
    rationale: "Screened, and the maths adjacency helps." },
  { roleId: "ml-engineer", trackId: "observability", requiredLevel: 6, weight: 1.3, hoursPerLevel: 10, isBlocking: false,
    rationale: "Drift is invisible without measurement." },
  { roleId: "ml-engineer", trackId: "api-design", requiredLevel: 6, weight: 1.1, hoursPerLevel: 12, isBlocking: false,
    rationale: "A model reaches users through an endpoint." },
  { roleId: "ml-engineer", trackId: "testing", requiredLevel: 5, weight: 1.1, hoursPerLevel: 9, isBlocking: false,
    rationale: "Data tests and evaluation harnesses." },
  { roleId: "ml-engineer", trackId: "caching", requiredLevel: 5, weight: 0.9, hoursPerLevel: 10, isBlocking: false,
    rationale: "Inference is expensive; caching is the first lever." },
  { roleId: "ml-engineer", trackId: "linux-shell", requiredLevel: 6, weight: 1.0, hoursPerLevel: 8, isBlocking: false,
    rationale: "GPU boxes are Linux boxes." },
  { roleId: "ml-engineer", trackId: "concurrency", requiredLevel: 5, weight: 0.9, hoursPerLevel: 12, isBlocking: false,
    rationale: "Batching and parallel data loading." },
  { roleId: "ml-engineer", trackId: "security-basics", requiredLevel: 4, weight: 0.8, hoursPerLevel: 9, isBlocking: false,
    rationale: "Training data is often sensitive." },
  { roleId: "ml-engineer", trackId: "version-control", requiredLevel: 5, weight: 0.7, hoursPerLevel: 6, isBlocking: false,
    rationale: "Experiments need to be traceable to a commit." },
]

export const ROLE_BENCHMARKS: BenchmarkSeed[] = [
  ...backend,
  ...dataEngineer,
  ...fullStack,
  ...sdet,
  ...mlEngineer,
]

/**
 * Ordering constraints for the scheduler.
 *
 * These are why the roadmap can say "Docker comes first because the shortener
 * can't be load-tested without it" and have it be true of the algorithm rather
 * than a sentence a model wrote.
 */
export type PrerequisiteSeed = {
  roleId: string
  trackId: string
  requiresTrackId: string
}

export const TRACK_PREREQUISITES: PrerequisiteSeed[] = [
  // You cannot load-test what you cannot deploy.
  { roleId: "backend-engineer", trackId: "system-design", requiresTrackId: "docker-cicd" },
  // Caching decisions are meaningless without measurement.
  { roleId: "backend-engineer", trackId: "caching", requiresTrackId: "observability" },
  // Integration tests need something to run against.
  { roleId: "backend-engineer", trackId: "testing", requiresTrackId: "docker-cicd" },
  // Query tuning presupposes reading a schema.
  { roleId: "backend-engineer", trackId: "caching", requiresTrackId: "sql-modelling" },

  { roleId: "data-engineer", trackId: "system-design", requiresTrackId: "sql-modelling" },
  { roleId: "data-engineer", trackId: "testing", requiresTrackId: "docker-cicd" },
  { roleId: "data-engineer", trackId: "observability", requiresTrackId: "docker-cicd" },

  { roleId: "full-stack", trackId: "system-design", requiresTrackId: "api-design" },
  { roleId: "full-stack", trackId: "security-basics", requiresTrackId: "api-design" },
  { roleId: "full-stack", trackId: "testing", requiresTrackId: "docker-cicd" },

  { roleId: "sdet", trackId: "testing", requiresTrackId: "docker-cicd" },
  { roleId: "sdet", trackId: "observability", requiresTrackId: "testing" },
  { roleId: "sdet", trackId: "concurrency", requiresTrackId: "testing" },

  { roleId: "ml-engineer", trackId: "observability", requiresTrackId: "docker-cicd" },
  { roleId: "ml-engineer", trackId: "system-design", requiresTrackId: "sql-modelling" },
  { roleId: "ml-engineer", trackId: "caching", requiresTrackId: "observability" },
]
