/**
 * What's actually in the database right now.
 *
 *   npm run db:state
 *
 * Faster than opening Drizzle Studio when you just want to know whether a
 * migration landed or a seed ran.
 */
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

const schemas = await sql.query(`
  select table_schema, count(*)::int as tables
  from information_schema.tables
  where table_schema in ('public', 'mastra')
  group by table_schema
  order by table_schema
`)

if (schemas.length === 0) {
  console.log("No tables yet. Run `npm run db:migrate`.")
  process.exit(0)
}

for (const s of schemas) {
  console.log(`${s.table_schema}: ${s.tables} tables`)
}

// Row counts for the tables that tell you whether seeding and analysis ran
const INTERESTING = [
  "roles",
  "skill_tracks",
  "role_benchmarks",
  "track_prerequisites",
  "project_catalog",
  "cert_catalog",
  "question_bank",
  "students",
  "resumes",
  "analysis_runs",
  "skill_assessments",
  "roadmaps",
  "readiness_snapshots",
]

const present = await sql.query(
  `select table_name from information_schema.tables where table_schema = 'public'`
)
const have = new Set(present.map((r) => r.table_name))

console.log()
for (const table of INTERESTING) {
  if (!have.has(table)) continue
  const rows = await sql.query(`select count(*)::int as n from "${table}"`)
  const n = rows[0].n
  console.log(`  ${table.padEnd(22)} ${String(n).padStart(6)}${n === 0 ? "  (empty)" : ""}`)
}


