const DEFAULT_DEV_SECRET = "dev-only-better-auth-secret-change-this";

export function getBetterAuthBaseUrl() {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://127.0.0.1:3002"
  );
}

export function getBetterAuthSecret() {
  return process.env.BETTER_AUTH_SECRET ?? DEFAULT_DEV_SECRET;
}

function normalizeOrigin(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getTrustedOrigins(request?: Request) {
  const trustedOrigins = new Set<string>();
  const configuredOrigins = [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    "http://127.0.0.1:3002",
    "http://localhost:3002",
    "http://0.0.0.0:3002",
  ];

  for (const origin of configuredOrigins) {
    const normalized = normalizeOrigin(origin);
    if (normalized) {
      trustedOrigins.add(normalized);
    }
  }

  const envTrustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
  if (envTrustedOrigins) {
    for (const item of envTrustedOrigins.split(",")) {
      const normalized = normalizeOrigin(item.trim());
      if (normalized) {
        trustedOrigins.add(normalized);
      }
    }
  }

  // In local/dev, allow the browser origin to avoid localhost/127.0.0.1/LAN mismatches.
  if (process.env.NODE_ENV !== "production") {
    const requestOrigin = normalizeOrigin(request?.headers.get("origin"));
    if (requestOrigin) {
      trustedOrigins.add(requestOrigin);
    }
  }

  return Array.from(trustedOrigins);
}

export function hasGoogleAuthEnv() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function hasSmtpEnv() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_FROM,
  );
}

export function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const portValue = process.env.SMTP_PORT;
  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;

  if (!host || !portValue || !from) {
    throw new Error("SMTP settings are not fully configured.");
  }

  const port = Number(portValue);

  if (!Number.isFinite(port)) {
    throw new Error("SMTP_PORT must be a valid number.");
  }

  return {
    host,
    port,
    user: user || undefined,
    pass: pass || undefined,
    from,
  };
}
