# Setup

Node 20+ (built on 24.16.0), npm. The public marketing page runs with no

configuration at all; everything behind sign-in needs the steps below.

## 1. Install

```bash
npm install
```

## 2. Provision Neon and Clerk

These are interactive — they open a browser.

```bash
vercel login
vercel link                     # pick scope, confirm project name

vercel install neon  --name skillforge-db   --plan free -e development -e preview -e production
vercel install clerk --name skillforge-auth               -e development -e preview -e production

vercel env pull .env.local
```

`vercel install` provisions the resource, connects it to the linked project and

pulls the env vars itself.

During the Clerk install you'll be handed off to Clerk's dashboard to choose

sign-in methods. Email + Google is enough.

## 3. Models — nothing to configure

Agents run on [OpenCode Zen](https://opencode.ai/docs/zen), which serves its

free models **without an API key**. Confirm one is reachable:

```bash
npm run check:models
```

This probes the live gateway rather than reading a registry, because the

registry bundled with `@mastra/core` lists ~25 free model ids and Zen actually

serves about three of them.

**Do not set a placeholder `OPENCODE_API_KEY`.** Verified against the live API:


| Request                        | Result          |
| ------------------------------ | --------------- |
| no `Authorization` header      | 200             |
| `Authorization: Bearer <junk>` | 401 `AuthError` |


An empty-but-present key is strictly worse than no key.

`src/mastra/models.ts` omits the header unless a real value exists. Setting a

real key lifts the shared rate limits and unlocks the paid models; nothing else

changes.

`**GITHUB_TOKEN` is optional, but not really.** The portfolio verifier reads

public repositories without one, at GitHub's unauthenticated limit of 60

requests per hour **per IP**. That IP is shared on Vercel, so the limit is

realistic locally and unrealistic in production. A token lifts it to 5,000.

Create a **fine-grained** token at

github.com/settings/personal-access-tokens

with *Public Repositories (read-only)* and no account permissions, then add it

to `.env.local` as `GITHUB_TOKEN`. Do not reuse a `gh` CLI token: those carry

`repo` and `workflow` write scopes, and nothing here ever writes to GitHub.

Verify with `npm run check:portfolio` — it inspects `vercel/next.js` by default

and prints which signals were detected, or pass an `owner/repo` of your own.

`**FIRECRAWL_API_KEY` is optional.** Without it, PDFs with no text layer (scans,

photos, Canva exports) are told to use the paste fallback. With it, they are

OCR'd through Firecrawl's `/v2/parse`. This is the only point where a resume

leaves our infrastructure, so it stays off unless the key is set. Verify with

`npm run check:ocr`.

This is also why agents don't use Mastra's model router. `model: "opencode/hy3-free"` makes the router resolve `OPENCODE_API_KEY` and throw when

it's absent, so it can't reach the free tier at all. Passing an

`OpenAICompatibleConfig` (`{ id, url }`) sends no Authorization header, which is

the only thing Zen accepts unauthenticated.

Two things to know about the free tier:

- **Rate limits are the failure mode**, and they're shared by IP. One analysis

  makes three model calls; if the gateway throttles mid-run the workflow fails

  rather than degrading, so the run goes to `failed` and the intake screen says

  so. `deepseek-v4-flash-free` in particular is saturated most of the time.
- **Reasoning models need room.** Some free models emit visible

  chain-of-thought before any JSON and truncate mid-thought on a tight budget —

  `nemotron-3.5-lightning-free` produced nothing usable under 1500 output

  tokens. `MAX_OUTPUT_TOKENS` in `src/mastra/models.ts` is set generously for

  this reason. `hy3-free` is the default because it honours `json_schema`

  without the chain-of-thought tax.

## 4. Database

```bash
npm run db:generate   # SQL migration from src/db/schema.ts
npm run db:migrate    # apply it
npm run db:state      # what's actually in there
npm run db:seed       # roles, skill tracks, benchmarks, catalogs
npm run db:demo       # optional: the populated demo student
```

Prefer `db:generate` + `db:migrate` over `db:push`. Push needs a TTY to confirm

(`strict: true` in `drizzle.config.ts`) so it can't run unattended, and

migrations leave a reviewable SQL file behind.

## 5. Run

Two servers, two terminals:

```bash
npm run dev          # http://localhost:3000
npm run mastra:dev   # http://localhost:4111  (Mastra Studio)
```

Studio is where prompts get iterated — you can run the `analyze-resume`

workflow against a fixture resume without touching the browser or the upload

path.

---

## Things that will otherwise cost you an hour

`**.env.local` is overwritten, `.env` is yours.** `vercel env pull` — and every

`vercel install` — rewrites `.env.local` wholesale, so anything hand-written

there is lost on the next provisioning run. Vercel-managed values live in

`.env.local`; app config (model ids, Clerk redirect URLs, `MASTRA_DB_SCHEMA`,

`OPENCODE_API_KEY`) lives in `.env`. The two hold disjoint keys, Next reads

both, and the npm scripts pass both to dotenv-cli:

`dotenv -e .env.local -e .env --`. Without that, Studio starts fine and then

every model call 401s.

**IPv6 will bite you on some networks.** Neon's hostnames publish both A and

AAAA records, and Node 20+ hands back the IPv6 address first. On a network

without IPv6 egress every connection dies with `EHOSTUNREACH` before reaching

Postgres — an error that looks nothing like a DNS problem. `src/db/index.ts`

calls `setDefaultResultOrder("ipv4first")` for the app, and every `db:*` script

sets `NODE_OPTIONS=--dns-result-order=ipv4first` for the CLIs.

**A `pg` SSL deprecation warning is expected.** `sslmode=require` in Neon's

connection string is currently treated as `verify-full`; pg v9 will switch it

to weaker libpq semantics. The warning is informational — nothing is misconfigured.

**Two connection strings, two consumers.** `DATABASE_URL` is the PgBouncer

pooled URL and is used at runtime by both Drizzle and Mastra's `PostgresStore`.

`DATABASE_URL_UNPOOLED` is direct and is used only by drizzle-kit — DDL over

transaction pooling is unreliable. If you see `prepared statement "s1" already exists`, something is running queries over the pooler that shouldn't be.

`**schemaFilter: ['public']**` in `drizzle.config.ts` is load-bearing. Mastra

creates its memory and trace tables in the `mastra` schema; without the filter

the first `db:push` offers to drop all of them.

**Mastra's provider registry can be empty.** Mastra refreshes it from the

models.dev gateway and can persist an *empty* registry to `~/.cache/mastra`

after a failed refresh — which then shadows the good copy bundled in

`@mastra/core` and surfaces as "model not found" for a model id you know is

valid. `npm run check:models` detects exactly this. The fix is to move

`~/.cache/mastra/provider-registry.json` aside and let it regenerate.

**Next rewrites `tsconfig.json`.** `next dev` sets `module` to `esnext` on

every boot regardless of what's committed. That's still ESM, so Mastra is happy;

don't fight it. If the Mastra CLI ever objects, add a `tsconfig.mastra.json`

that extends the root rather than loosening the root.