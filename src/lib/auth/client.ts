"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

function resolveAuthBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

  if (configured?.startsWith("http://") || configured?.startsWith("https://")) {
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
  plugins: [magicLinkClient()],
});
