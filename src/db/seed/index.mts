/**
 * Seeds the benchmark core: roles, skill tracks with their rubrics, the
 * per-role required levels, and the scheduler's ordering constraints.
 *
 *   npm run db:seed
 *
 * Idempotent — every write is an upsert on the natural key, so it is safe to
 * re-run mid-demo after editing a rubric or a required level.
 *
 * Deliberately does NOT import src/db/index.ts: that module is marked
 * `server-only` and throws outside a Next request. The seed owns its own pool.
 */
import { setDefaultResultOrder } from "node:dns"
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"

import * as schema from "../schema"
import { ROLES } from "./roles"
import { SKILL_TRACKS } from "./skill-tracks"
import {
  ROLE_BENCHMARKS,
  TRACK_PREREQUISITES,
  BENCHMARK_SOURCE,
  BENCHMARK_VERSION,
} from "./role-benchmarks"
import { PROJECT_CATALOG, CERT_CATALOG, QUESTION_BANK } from "./catalogs"

// Neon publishes AAAA records; on a network without IPv6 egress every
// connection dies with EHOSTUNREACH before reaching Postgres.
setDefaultResultOrder("ipv4first")

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("DATABASE_URL is not set. Run `vercel env pull .env.local`.")
  process.exit(1)
}

const pool = new Pool({ connectionString, max: 3 })
const db = drizzle(pool, { schema })

async function main() {
  // Mastra creates its memory and trace tables here on first use. Making the
  // schema up front means drizzle-kit and Mastra never contend for `public`.
  await db.execute(sql`create schema if not exists mastra`)

  await db
    .insert(schema.roles)
    .values(ROLES)
    .onConflictDoUpdate({
      target: schema.roles.id,
      set: {
        name: sql`excluded.name`,
        blurb: sql`excluded.blurb`,
        sortOrder: sql`excluded.sort_order`,
      },
    })
  console.log(`roles                ${ROLES.length}`)

  await db
    .insert(schema.skillTracks)
    .values(SKILL_TRACKS)
    .onConflictDoUpdate({
      target: schema.skillTracks.id,
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        description: sql`excluded.description`,
        levelRubric: sql`excluded.level_rubric`,
      },
    })
  console.log(`skill tracks         ${SKILL_TRACKS.length}`)

  await db
    .insert(schema.roleBenchmarks)
    .values(
      ROLE_BENCHMARKS.map((b) => ({
        ...b,
        sourceNote: BENCHMARK_SOURCE,
        benchmarkVersion: BENCHMARK_VERSION,
      }))
    )
    .onConflictDoUpdate({
      target: [schema.roleBenchmarks.roleId, schema.roleBenchmarks.trackId],
      set: {
        requiredLevel: sql`excluded.required_level`,
        weight: sql`excluded.weight`,
        hoursPerLevel: sql`excluded.hours_per_level`,
        isBlocking: sql`excluded.is_blocking`,
        rationale: sql`excluded.rationale`,
        sourceNote: sql`excluded.source_note`,
        benchmarkVersion: sql`excluded.benchmark_version`,
      },
    })
  console.log(`role benchmarks      ${ROLE_BENCHMARKS.length}`)

  await db
    .insert(schema.trackPrerequisites)
    .values(TRACK_PREREQUISITES)
    .onConflictDoNothing()
  console.log(`prerequisite edges   ${TRACK_PREREQUISITES.length}`)

  await db
    .insert(schema.projectCatalog)
    .values(PROJECT_CATALOG)
    .onConflictDoUpdate({
      target: schema.projectCatalog.id,
      set: {
        title: sql`excluded.title`,
        summary: sql`excluded.summary`,
        stack: sql`excluded.stack`,
        effortWeeks: sql`excluded.effort_weeks`,
        difficulty: sql`excluded.difficulty`,
        closesTrackIds: sql`excluded.closes_track_ids`,
        evidenceProduced: sql`excluded.evidence_produced`,
        requiresTrackIds: sql`excluded.requires_track_ids`,
      },
    })
  console.log(`project catalog      ${PROJECT_CATALOG.length}`)

  await db
    .insert(schema.certCatalog)
    .values(CERT_CATALOG)
    .onConflictDoUpdate({
      target: schema.certCatalog.id,
      set: {
        name: sql`excluded.name`,
        provider: sql`excluded.provider`,
        costInr: sql`excluded.cost_inr`,
        examWindow: sql`excluded.exam_window`,
        baseValue: sql`excluded.base_value`,
        provesTrackIds: sql`excluded.proves_track_ids`,
        cheaperAlternative: sql`excluded.cheaper_alternative`,
      },
    })
  console.log(`cert catalog         ${CERT_CATALOG.length}`)

  await db
    .insert(schema.questionBank)
    .values(QUESTION_BANK)
    .onConflictDoUpdate({
      target: schema.questionBank.id,
      set: {
        prompt: sql`excluded.prompt`,
        trackId: sql`excluded.track_id`,
        topic: sql`excluded.topic`,
        company: sql`excluded.company`,
        round: sql`excluded.round`,
        year: sql`excluded.year`,
        difficulty: sql`excluded.difficulty`,
        modelAnswerOutline: sql`excluded.model_answer_outline`,
      },
    })
  console.log(`question bank        ${QUESTION_BANK.length}`)

  // A benchmark row pointing at a track that doesn't exist would fail the
  // foreign key, but a MISSING row is silent — a track with no required level
  // simply never appears on that role's skill map. Check for it explicitly.
  const missing: string[] = []
  for (const role of ROLES) {
    for (const track of SKILL_TRACKS) {
      const has = ROLE_BENCHMARKS.some(
        (b) => b.roleId === role.id && b.trackId === track.id
      )
      if (!has) missing.push(`${role.id}/${track.id}`)
    }
  }
  if (missing.length) {
    console.warn(
      `\nwarning: ${missing.length} role/track pairs have no benchmark and will not appear on that skill map:\n  ` +
        missing.join("\n  ")
    )
  }

  console.log(
    `\nbenchmark ${BENCHMARK_VERSION} — ${BENCHMARK_SOURCE}\n` +
      `${ROLES.length} roles × ${SKILL_TRACKS.length} tracks`
  )
}

try {
  await main()
} finally {
  await pool.end()
}
