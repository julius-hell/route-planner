import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"

import * as schema from "@/lib/db/schema"

const { Pool } = pg

const globalForDb = globalThis as unknown as {
  pool: InstanceType<typeof Pool> | undefined
}

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  })

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool
}

export const db = drizzle(pool, { schema })
