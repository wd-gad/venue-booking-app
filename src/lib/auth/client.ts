"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient, magicLinkClient } from "better-auth/client/plugins";

function resolveAuthBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

  if (configured?.startsWith("http://") || configured?.startsWith("https://")) {
    if (typeof window !== "undefined") {
      try {
        const configuredUrl = new URL(configured);
        const localHosts = new Set(["127.0.0.1", "localhost", "0.0.0.0"]);

        if (localHosts.has(configuredUrl.hostname)) {
          return `${window.location.origin}${configuredUrl.pathname}`;
        }
      } catch {
        // Fall back to configured value when URL parsing fails.
      }
    }

    return configured;
  }

  if (configured?.startsWith("/")) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${configured}`;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3002";
    return `${appUrl}${configured}`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/auth`;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3002";
  return `${appUrl}/api/auth`;
}

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseUrl(),
  plugins: [magicLinkClient(), emailOTPClient()],
});
