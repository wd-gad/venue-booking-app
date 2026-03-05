import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/db/env";

declare global {
  var __venueBookingPool: Pool | undefined;
}

function createPool() {
  return new Pool({
    connectionString: getDatabaseUrl(),
    max: 10,
  });
}

export function getDb() {
  const pool = globalThis.__venueBookingPool ?? createPool();

  if (!globalThis.__venueBookingPool) {
    globalThis.__venueBookingPool = pool;
  }

  return drizzle(pool);
}
