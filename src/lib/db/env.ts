const FALLBACK_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    // Better Auth initializes during route compilation, so builds need a placeholder URL.
    return FALLBACK_DATABASE_URL;
  }

  return databaseUrl;
}
