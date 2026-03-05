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

export function hasGoogleAuthEnv() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function hasSmtpEnv() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USERNAME &&
      process.env.SMTP_PASSWORD &&
      process.env.SMTP_FROM,
  );
}

export function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const portValue = process.env.SMTP_PORT;
  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;

  if (!host || !portValue || !user || !pass || !from) {
    throw new Error("SMTP settings are not fully configured.");
  }

  const port = Number(portValue);

  if (!Number.isFinite(port)) {
    throw new Error("SMTP_PORT must be a valid number.");
  }

  return {
    host,
    port,
    user,
    pass,
    from,
  };
}
