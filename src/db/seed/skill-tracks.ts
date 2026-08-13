import type { LevelRubric } from "@/lib/scoring/types"

/**
 * The gauge vocabulary — one entry per horizontal bar on the skill map.
 *
 * The `levelRubric` is the most important field in this file. It is shown to
 * the extraction agent, which is asked *which rung the evidence supports* —
 * never for a score. That is what lets a student ask "why am I a 2?" and get an
 * answer with a resume line behind it instead of a shrug.
 *
 * Rungs are deliberately behavioural. "Has drawn one under load" is checkable;
 * "intermediate knowledge" is not.
 */
export type SkillTrackSeed = {
  id: string
  name: string
  category: "core" | "tooling" | "dsa" | "data" | "systems"
  description: string
  levelRubric: LevelRubric
}

export const SKILL_TRACKS: SkillTrackSeed[] = [
  {
    id: "system-design",
    name: "System design",
    category: "core",
    description:
      "Choosing and defending an architecture under real constraints — traffic, latency, failure.",
    levelRubric: [
      { level: 2, label: "Can name the components", evidence: "Uses the vocabulary: load balancer, cache, queue, replica." },
      { level: 4, label: "Has drawn one under load", evidence: "A diagram with an identified bottleneck, not just boxes." },
      { level: 6, label: "Has estimated capacity and justified a cache", evidence: "Numbers behind the choice — QPS, payload size, hit rate." },
      { level: 8, label: "Has broken a real system and written it up", evidence: "A load test that found the limit, and a postmortem." },
    ],
  },
  {
    id: "docker-cicd",
    name: "Docker & CI/CD",
    category: "tooling",
    description:
      "Packaging an application and getting it to production without touching a server.",
    levelRubric: [
      { level: 2, label: "Has run someone else's container", evidence: "docker run appears in a README." },
      { level: 4, label: "Has written a working Dockerfile", evidence: "An image that builds and starts from a repo you own." },
      { level: 6, label: "Has a pipeline that gates merges", evidence: "CI runs tests and blocks a red build." },
      { level: 8, label: "Has deployed on merge, with a rollback", evidence: "Automated deploy plus a documented way back." },
    ],
  },
  {
    id: "testing",
    name: "Testing",
    category: "core",
    description:
      "Proving code works, and keeping it working while it changes.",
    levelRubric: [
      { level: 2, label: "Has written a test", evidence: "At least one test file exists." },
      { level: 4, label: "Tests the awkward cases", evidence: "Boundary and failure cases, not just the happy path." },
      { level: 6, label: "Tests across a boundary", evidence: "An integration test against a real database or HTTP layer." },
      { level: 8, label: "Uses tests to drive a change", evidence: "A regression test written before the fix." },
    ],
  },
  {
    id: "concurrency",
    name: "Concurrency",
    category: "systems",
    description:
      "Doing several things at once without corrupting state or deadlocking.",
    levelRubric: [
      { level: 2, label: "Knows the primitives", evidence: "Can name threads, locks, channels, async." },
      { level: 4, label: "Has written concurrent code that works", evidence: "A parallel or async path in a real project." },
      { level: 6, label: "Has found and fixed a race", evidence: "A specific bug, and what made it reproducible." },
      { level: 8, label: "Designs to avoid shared state", evidence: "Chose an architecture that makes races impossible." },
    ],
  },
  {
    id: "dsa",
    name: "DSA — graphs & DP",
    category: "dsa",
    description:
      "The problem-solving round. Graphs and dynamic programming are where campus interviews concentrate.",
    levelRubric: [
      { level: 2, label: "Arrays, strings, hashing", evidence: "Comfortable with the basics under time pressure." },
      { level: 4, label: "Trees and recursion", evidence: "Traversals and divide-and-conquer without hints." },
      { level: 6, label: "Graphs and shortest paths", evidence: "BFS/DFS, Dijkstra, topological sort from scratch." },
      { level: 8, label: "Dynamic programming under time pressure", evidence: "Recognises the state and transition unaided." },
    ],
  },
  {
    id: "sql-modelling",
    name: "SQL & data modelling",
    category: "data",
    description:
      "Designing a schema and making the database do the work efficiently.",
    levelRubric: [
      { level: 2, label: "Reads and writes basic SQL", evidence: "SELECT, JOIN, GROUP BY." },
      { level: 4, label: "Designs a normalised schema", evidence: "Sensible keys and relationships in a real project." },
      { level: 6, label: "Reads a query plan", evidence: "Used EXPLAIN to make something measurably faster." },
      { level: 8, label: "Understands the cost of an index", evidence: "Can say when an index hurts writes, with evidence." },
    ],
  },
  {
    id: "api-design",
    name: "REST & API design",
    category: "core",
    description:
      "Designing an interface other people have to live with.",
    levelRubric: [
      { level: 2, label: "Can call an API", evidence: "Consumed a third-party HTTP API." },
      { level: 4, label: "Has built endpoints that work", evidence: "A CRUD surface in a shipped project." },
      { level: 6, label: "Handles errors, auth and pagination", evidence: "Status codes and auth chosen on purpose." },
      { level: 8, label: "Versions without breaking clients", evidence: "Evolved a live API compatibly." },
    ],
  },
  {
    id: "linux-shell",
    name: "Linux & shell",
    category: "systems",
    description:
      "Being productive on a machine with no GUI, which is where the code runs.",
    levelRubric: [
      { level: 2, label: "Moves around a filesystem", evidence: "Comfortable with the everyday commands." },
      { level: 4, label: "Chains tools together", evidence: "Pipes, grep, awk to answer a real question." },
      { level: 6, label: "Debugs a running process", evidence: "Read logs, checked ports, inspected resource use." },
      { level: 8, label: "Scripts a repeatable operation", evidence: "A script other people run." },
    ],
  },
  {
    id: "observability",
    name: "Observability",
    category: "tooling",
    description:
      "Knowing what production is doing before a user tells you.",
    levelRubric: [
      { level: 2, label: "Logs things", evidence: "Deliberate log statements, not leftover prints." },
      { level: 4, label: "Uses structured logs", evidence: "Machine-readable fields that can be queried." },
      { level: 6, label: "Measures latency and error rate", evidence: "Metrics, and a sense of what normal looks like." },
      { level: 8, label: "Traced a slow request end to end", evidence: "Found a bottleneck across services." },
    ],
  },
  {
    id: "caching",
    name: "Caching",
    category: "data",
    description:
      "Trading freshness for speed on purpose, and knowing what it costs.",
    levelRubric: [
      { level: 2, label: "Knows what a cache is for", evidence: "Can explain the read-path benefit." },
      { level: 4, label: "Has added one", evidence: "Redis or in-memory caching in a project." },
      { level: 6, label: "Has an invalidation strategy", evidence: "TTL or explicit invalidation chosen deliberately." },
      { level: 8, label: "Has reasoned about a stampede", evidence: "Handled cold starts or thundering herds." },
    ],
  },
  {
    id: "security-basics",
    name: "Security basics",
    category: "core",
    description:
      "The failures that get student projects rejected in review.",
    levelRubric: [
      { level: 2, label: "Keeps secrets out of the repo", evidence: "Environment variables, not committed keys." },
      { level: 4, label: "Hashes passwords and validates input", evidence: "No plaintext credentials, no string-built SQL." },
      { level: 6, label: "Implements authz, not just authn", evidence: "Checks what a user may do, not only who they are." },
      { level: 8, label: "Threat-models a feature", evidence: "Identified an abuse case before shipping." },
    ],
  },
  {
    id: "version-control",
    name: "Version control",
    category: "tooling",
    description:
      "Working on a codebase with other people without losing work.",
    levelRubric: [
      { level: 2, label: "Commits and pushes", evidence: "A repository with a history." },
      { level: 4, label: "Branches and merges", evidence: "Feature branches and resolved conflicts." },
      { level: 6, label: "Writes reviewable changes", evidence: "Focused commits with messages that explain why." },
      { level: 8, label: "Recovers from a mistake", evidence: "Bisect, revert or reflog used in anger." },
    ],
  },
]

export const TRACK_IDS = SKILL_TRACKS.map((t) => t.id)
