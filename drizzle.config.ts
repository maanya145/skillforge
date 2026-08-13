import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Direct connection, not the pooler: DDL over PgBouncer transaction pooling
    // is unreliable. Falls back to DATABASE_URL for local Postgres.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
  // Mastra owns the `mastra` schema. Without this filter the first `db:push`
  // offers to drop every memory and trace table it created.
  schemaFilter: ['public'],
  verbose: true,
  strict: true,
} satisfies Config
