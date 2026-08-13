/**
 * The recommendation catalogs. Seeded and version-controlled like the
 * benchmarks: the ranking algorithms choose FROM these closed sets, so the
 * mentor can never invent a project, a certification or a question — only
 * surface one that a human authored.
 */

export const PROJECT_CATALOG = [
  {
    id: "rate-limited-shortener",
    title: "Rate-limited link shortener",
    summary:
      "Redis token bucket in front of a Postgres key store. Ship it, then break it deliberately with a load test and write up where it bent.",
    stack: ["Go", "Redis", "Postgres", "Docker"],
    effortWeeks: 4,
    difficulty: 3,
    closesTrackIds: ["system-design", "docker-cicd", "caching"],
    evidenceProduced: "a deployed service, a load test, and a numbers-first write-up",
    requiresTrackIds: ["docker-cicd"],
  },
  {
    id: "ci-retrofit",
    title: "CI retrofit on an existing project",
    summary:
      "Add a pipeline to something you already shipped — tests, build, deploy on merge. The cheapest possible proof of the Docker claim.",
    stack: ["GitHub Actions", "Docker", "pytest"],
    effortWeeks: 2,
    difficulty: 2,
    closesTrackIds: ["docker-cicd", "testing", "version-control"],
    evidenceProduced: "a green pipeline badge on a repo that predates it",
    requiresTrackIds: [],
  },
  {
    id: "chat-backend",
    title: "Chat backend with delivery receipts",
    summary:
      "WebSockets, presence, and receipts that survive a reconnect. The one project an interviewer will want to dig into.",
    stack: ["Go", "WebSocket", "Postgres"],
    effortWeeks: 5,
    difficulty: 4,
    closesTrackIds: ["concurrency", "sql-modelling", "api-design"],
    evidenceProduced: "a reconnect test log and a schema that handles ordering",
    requiresTrackIds: ["docker-cicd"],
  },
  {
    id: "slow-query-teardown",
    title: "Slow-query teardown",
    summary:
      "Take your slowest real query, read the plan, fix it, publish the before and after. One weekend, one strong resume line.",
    stack: ["Postgres", "EXPLAIN ANALYZE"],
    effortWeeks: 1,
    difficulty: 2,
    closesTrackIds: ["sql-modelling", "observability"],
    evidenceProduced: "an EXPLAIN before/after with measured latency",
    requiresTrackIds: [],
  },
  {
    id: "structured-logging-pass",
    title: "Structured logging + metrics pass",
    summary:
      "Instrument an existing service: structured logs, latency histogram, error-rate counter, and a dashboard that shows a deploy.",
    stack: ["Grafana", "Prometheus", "any service you own"],
    effortWeeks: 2,
    difficulty: 2,
    closesTrackIds: ["observability", "linux-shell"],
    evidenceProduced: "a dashboard screenshot with a real incident annotated",
    requiresTrackIds: ["docker-cicd"],
  },
  {
    id: "auth-hardening",
    title: "Auth hardening on a shipped app",
    summary:
      "Password hashing, rate-limited login, session invalidation, and a written threat model of your own app.",
    stack: ["bcrypt/argon2", "your existing project"],
    effortWeeks: 2,
    difficulty: 3,
    closesTrackIds: ["security-basics", "api-design"],
    evidenceProduced: "a threat model doc and the commits that answer it",
    requiresTrackIds: [],
  },
  {
    id: "race-hunt",
    title: "Find and fix a real race",
    summary:
      "Introduce concurrency into a project that lacks it — a worker pool, a shared cache — then find the race you created with the race detector, and write it up.",
    stack: ["Go race detector or TLA-lite reasoning"],
    effortWeeks: 3,
    difficulty: 4,
    closesTrackIds: ["concurrency", "testing"],
    evidenceProduced: "a failing race test and the commit that fixes it",
    requiresTrackIds: ["testing"],
  },
  {
    id: "etl-pipeline",
    title: "Small ETL pipeline with data checks",
    summary:
      "Ingest a public dataset nightly, validate it, load it into Postgres, alert on anomalies. Data engineering in miniature.",
    stack: ["Python", "Postgres", "cron"],
    effortWeeks: 3,
    difficulty: 3,
    closesTrackIds: ["sql-modelling", "testing", "linux-shell"],
    evidenceProduced: "a pipeline that has survived a malformed input",
    requiresTrackIds: [],
  },
]

export const CERT_CATALOG = [
  {
    id: "aws-ccp",
    name: "AWS Cloud Practitioner",
    provider: "AWS",
    costInr: 8000,
    examWindow: "Monthly windows",
    baseValue: 3,
    provesTrackIds: ["system-design", "docker-cicd"],
    cheaperAlternative: null,
  },
  {
    id: "docker-dca",
    name: "Docker Certified Associate",
    provider: "Docker",
    costInr: 16000,
    examWindow: null,
    baseValue: 1.5,
    provesTrackIds: ["docker-cicd"],
    cheaperAlternative: "The CI retrofit proves this for free.",
  },
  {
    id: "mongodb-assoc",
    name: "MongoDB Associate Developer",
    provider: "MongoDB",
    costInr: 6000,
    examWindow: null,
    baseValue: 0.5,
    provesTrackIds: [],
    cheaperAlternative: null,
  },
  {
    id: "cka",
    name: "Kubernetes CKAD",
    provider: "CNCF",
    costInr: 32000,
    examWindow: "Anytime, proctored",
    baseValue: 2.5,
    provesTrackIds: ["docker-cicd", "system-design"],
    cheaperAlternative: null,
  },
  {
    id: "psql-assoc",
    name: "PostgreSQL Associate",
    provider: "EDB",
    costInr: 15000,
    examWindow: null,
    baseValue: 1,
    provesTrackIds: ["sql-modelling"],
    cheaperAlternative: "The slow-query teardown proves this better and free.",
  },
  {
    id: "github-actions",
    name: "GitHub Actions certification",
    provider: "GitHub",
    costInr: 4000,
    examWindow: "Anytime",
    baseValue: 1.5,
    provesTrackIds: ["docker-cicd", "version-control"],
    cheaperAlternative: "The CI retrofit is the same proof with a repo attached.",
  },
]

const QUESTION_BANK_RAW = [
  // system design
  { id: "sd-shortener", prompt: "Design a URL shortener serving 50k redirects a second. Where does the read path break first, and what do you add?", trackId: "system-design", topic: "System design", company: "Razorpay", round: "R2", year: 2025, difficulty: 3 },
  { id: "sd-feed", prompt: "Design the feed for a campus events app. Push or pull, and what changes at 100× the users?", trackId: "system-design", topic: "System design", company: "Swiggy", round: "R2", year: 2025, difficulty: 3 },
  { id: "sd-ratelimit", prompt: "Two app servers must share one rate limit per user. Walk me through your options and their failure modes.", trackId: "system-design", topic: "System design", company: "Postman", round: "R2", year: 2024, difficulty: 4 },
  // sql
  { id: "sql-index", prompt: "Explain how an index makes a range query fast — and when it makes writes slow.", trackId: "sql-modelling", topic: "Databases", company: "Postman", round: "R2", year: 2025, difficulty: 2 },
  { id: "sql-nplus1", prompt: "Your ORM page loads 40 queries. Diagnose and fix, without hand-waving 'caching'.", trackId: "sql-modelling", topic: "Databases", company: "Zoho", round: "R2", year: 2024, difficulty: 2 },
  { id: "sql-txn", prompt: "Two services write the same row at the same time. Walk me through what you'd actually do.", trackId: "concurrency", topic: "Concurrency", company: "Zeta", round: "R3", year: 2025, difficulty: 4 },
  // dsa
  { id: "dsa-groupby", prompt: "You have a 2 GB CSV and 512 MB of RAM. Write the group-by.", trackId: "dsa", topic: "Systems + DSA", company: "Zoho", round: "R1", year: 2025, difficulty: 3 },
  { id: "dsa-shortest", prompt: "Cheapest flight with at most K stops — code it, then tell me why plain Dijkstra is wrong here.", trackId: "dsa", topic: "Graphs", company: "Flipkart", round: "R1", year: 2025, difficulty: 3 },
  { id: "dsa-dp", prompt: "Count the ways to decode a digit string. Now do it in O(1) space.", trackId: "dsa", topic: "DP", company: "Amazon", round: "R1", year: 2024, difficulty: 3 },
  // testing
  { id: "test-flaky", prompt: "A test passes locally and fails in CI one run in five. What are your first three hypotheses?", trackId: "testing", topic: "Testing", company: "Atlassian", round: "R2", year: 2025, difficulty: 3 },
  { id: "test-what", prompt: "You have one day to add tests to an untested service. What do you test first and why?", trackId: "testing", topic: "Testing", company: "Freshworks", round: "R2", year: 2024, difficulty: 2 },
  // api
  { id: "api-pagination", prompt: "Design pagination for a feed that inserts at the top. Offset breaks — what do you use and what does the client contract look like?", trackId: "api-design", topic: "API design", company: "Meesho", round: "R2", year: 2025, difficulty: 3 },
  { id: "api-idempotent", prompt: "A payment client retries on timeout. Make the charge endpoint safe.", trackId: "api-design", topic: "API design", company: "Razorpay", round: "R2", year: 2025, difficulty: 3 },
  // docker
  { id: "dock-image", prompt: "Your image is 1.8 GB and builds in 9 minutes. Get both down, and tell me what each change trades away.", trackId: "docker-cicd", topic: "Docker & CI", company: "Postman", round: "R2", year: 2024, difficulty: 3 },
  { id: "dock-debug", prompt: "The container works locally and crashes in prod with exit code 137. Go.", trackId: "docker-cicd", topic: "Docker & CI", company: "Zeta", round: "R2", year: 2025, difficulty: 3 },
  // observability
  { id: "obs-p99", prompt: "Your API's p99 went from 80ms to 900ms after a deploy. First three things you check?", trackId: "observability", topic: "Debugging", company: "Atlassian", round: "R2", year: 2025, difficulty: 3 },
  // linux
  { id: "linux-disk", prompt: "The disk is full but du can't find the space. What's happening and how do you fix it live?", trackId: "linux-shell", topic: "Linux", company: "Zoho", round: "R2", year: 2024, difficulty: 3 },
  // security
  { id: "sec-token", prompt: "Where do you store a session token in the browser, and what attack does each choice invite?", trackId: "security-basics", topic: "Security", company: "Freshworks", round: "R2", year: 2025, difficulty: 3 },
  { id: "sec-sqli", prompt: "Show me how a string-built query gets exploited, then the two distinct layers that should have stopped it.", trackId: "security-basics", topic: "Security", company: "Zoho", round: "R1", year: 2024, difficulty: 2 },
  // caching
  { id: "cache-stampede", prompt: "A cache key expires under heavy traffic and your database falls over. Name the pattern and two fixes.", trackId: "caching", topic: "Caching", company: "Swiggy", round: "R2", year: 2025, difficulty: 4 },
  { id: "cache-invalidate", prompt: "Profile edits must appear instantly but reads are cached for 5 minutes. Reconcile that.", trackId: "caching", topic: "Caching", company: "Meesho", round: "R2", year: 2024, difficulty: 3 },
  // version control
  { id: "vc-bisect", prompt: "A bug shipped some time in the last 60 commits. Find it in under ten test runs.", trackId: "version-control", topic: "Git", company: "Atlassian", round: "R1", year: 2024, difficulty: 2 },
  // concurrency
  { id: "conc-pool", prompt: "Build a worker pool with backpressure. What happens when a worker panics?", trackId: "concurrency", topic: "Concurrency", company: "Postman", round: "R3", year: 2025, difficulty: 4 },
  { id: "conc-deadlock", prompt: "Two locks, two goroutines, intermittent freeze. How do you prove it's a deadlock and then prevent it?", trackId: "concurrency", topic: "Concurrency", company: "Flipkart", round: "R2", year: 2024, difficulty: 4 },
]

/**
 * Answer outlines — the scaffold a strong answer follows, not a script. Shown
 * in the practice dialog after the student has had a chance to think.
 */
const ANSWER_OUTLINES: Record<string, string> = {
  "sd-shortener": "Read path first: cache hit ratio decides everything. Redirects are read-heavy (say 100:1), so put the hot mapping in Redis with the DB as source of truth. The read path breaks at the cache-miss stampede on a viral link — add per-key request coalescing. Then talk key generation: pre-generated ranges beat hashing for collision handling.",
  "sd-feed": "Start with the ratio: events apps are read-heavy with a small writer set, so push (fan-out on write) wins at campus scale. At 100× the users, celebrity accounts break fan-out — switch to hybrid: push for most, pull for high-follower sources. Name the storage: a per-user feed list capped at N entries.",
  "sd-ratelimit": "Local counters fail the moment a second server exists — the user gets 2× the limit. Options: sticky sessions (fragile, uneven), a shared store (Redis INCR with TTL — one round trip, single point of failure), or a token-bucket service (accurate, more moving parts). Pick Redis for the interview; name the failure mode: fail open or closed, and why.",
  "sql-index": "A B-tree keeps keys sorted, so a range query walks a contiguous leaf chain instead of scanning the heap — O(log n) to find the start, then sequential. Writes pay the price: every INSERT/UPDATE touches the index too, and each additional index multiplies that. Mention write amplification and when a partial index is the answer.",
  "sql-nplus1": "Name the pattern first: one parent query, then a child query per row. Fix with a join or an IN batch (select all children for the page's ids), or the ORM's eager loading. Show you know why caching is the wrong first answer: it hides the problem until the cache misses.",
  "sql-txn": "Clarify the requirement first: last-write-wins, or must both survive? Options ladder: row locks (SELECT FOR UPDATE) for short critical sections, optimistic versioning (version column, retry on conflict) for low contention, and a serialisable transaction when correctness beats throughput. Name the deadlock risk with lock ordering.",
  "dsa-groupby": "512MB can't hold 2GB, so partition: hash each row's key to one of K spill files (each fits in memory), then aggregate file by file. That's external hashing — the same idea as a grace hash join. Mention the degenerate case: one hot key bigger than memory needs streaming aggregation per key.",
  "dsa-shortest": "Plain Dijkstra is wrong because a cheaper fare with more stops can dominate a costlier one with fewer — the state must include stops used. BFS layer-by-layer (Bellman-Ford limited to K+1 relaxation rounds) or Dijkstra on (city, stopsUsed) states. Code the K+1 rounds version; it's shorter and provably correct.",
  "dsa-dp": "State: ways(i) depends on whether s[i-1] alone is valid (1–9) and whether s[i-2..i-1] is valid (10–26). That's Fibonacci-shaped, so two rolling variables give O(1) space. Walk the edge cases out loud: leading zeros, '10', '27'.",
  "test-flaky": "Three hypotheses in order of prior: (1) shared state between tests — run it alone vs in suite; (2) time or ordering assumptions — CI is slower and parallel; (3) a real race in the code under test, which makes the flake a gift. Say how you'd bisect: seed the runner, fix the order, isolate the database.",
  "test-what": "Test where the blast radius is: the money path, the auth path, and anything that writes. One end-to-end smoke for the critical flow beats fifty unit tests on getters. Then characterisation tests around whatever you're about to change — tests exist to make change safe, so put them where change is coming.",
  "api-pagination": "Offset breaks because inserts shift every page. Cursor pagination: return an opaque cursor (the last row's sort key), client sends it back, server queries WHERE key < cursor. Contract: cursors expire, pages may be short, order must be stable — say which column makes it stable.",
  "api-idempotent": "The client sends an Idempotency-Key header; the server stores key → result and replays the stored response on retry. The subtle part is the race between two in-flight retries: take a lock or unique-constraint on the key row before charging. Distinguish from natural idempotency (PUT) — charges need the key.",
  "dock-image": "Multi-stage build: compile in a fat stage, copy the artifact into a slim runtime base. Order layers by change frequency so dependency layers cache — lockfile copy, install, then source copy. Trade-offs: alpine images shrink size but can swap libc; distroless kills shell debugging. That's the 'what does each change trade away'.",
  "dock-debug": "137 = 128 + 9: the kernel SIGKILLed it — almost always the OOM killer. Locally you have no memory limit; prod does. Check `docker stats`/cgroup limits, then the app's actual footprint. Fixes: raise the limit, or find the leak/spike — and mention that JVM/Node heap flags must agree with the cgroup limit.",
  "obs-p99": "First: is it all endpoints or one? (Dashboard by route.) Second: what shipped — diff the deploy. Third: where is the time — upstream, app, or DB? p99-only with a flat p50 says queueing or a slow dependency on a subset: connection pool exhaustion, a new N+1, GC pauses. Say you'd roll back first if the curve is still climbing.",
  "linux-disk": "du walks the filesystem; deleted-but-open files don't appear. `lsof +L1` finds processes holding deleted file handles — usually a log that got rotated out from under a long-lived process. Fix live: truncate via /proc/<pid>/fd/<n>, then fix rotation (copytruncate or signal the process).",
  "sec-token": "localStorage: readable by any XSS — one injected script exfiltrates every session. Cookie with HttpOnly+Secure+SameSite: immune to script theft, but now CSRF matters. The defensible answer: HttpOnly cookie + SameSite=Lax + CSRF token for state-changing routes. Say the real point: you're choosing which attack class to engineer against.",
  "sec-sqli": "Show `' OR 1=1 --` breaking a string-built login query. Layer one: parameterised queries — the fix, not escaping. Layer two: least-privilege DB user, so even a successful injection can't drop tables. Bonus: name why ORMs mostly save you and where they don't (raw fragments).",
  "cache-stampede": "The pattern is a thundering herd / cache stampede: expiry turns one hot key into a thousand simultaneous DB hits. Fix one: request coalescing (first miss recomputes, the rest wait). Fix two: stale-while-revalidate or jittered TTLs so keys don't expire in sync. Mention probabilistic early refresh if you want the senior answer.",
  "cache-invalidate": "Split the paths: reads stay cached, but the write path explicitly invalidates (or updates) the profile key on edit — write-through beats TTL here. The 5-minute TTL becomes the safety net, not the mechanism. Name the wrinkle: the editor must see their own write — read-your-writes via cache update or session pinning.",
  "vc-bisect": "git bisect: mark the last known good and current bad, and it binary-searches — 60 commits is ~6 test runs, under the 10 budget. Automate with `git bisect run <test script>`. Mention the prerequisite people forget: each commit must build, which is why you keep main green.",
  "conc-pool": "Bounded channel as the queue — submit blocks (or rejects) when full, and that's the backpressure. Workers recover from panics individually (defer/recover per task) so one poisoned task doesn't kill the pool; count restarts and eject repeat offenders. Name the shutdown story: close the intake, drain, then stop.",
  "conc-deadlock": "Prove it: grab a goroutine/thread dump during the freeze — two threads each holding one lock and waiting on the other is the smoking gun. Prevention: a global lock ordering (always A before B), or collapse to one lock, or replace shared state with a channel/queue. Say why timeouts are a mitigation, not a fix.",
}

export const QUESTION_BANK = QUESTION_BANK_RAW.map((q) => ({
  ...q,
  modelAnswerOutline: ANSWER_OUTLINES[q.id] ?? null,
}))
