import { betterAuth } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { headers } from "next/headers";
import nodemailer from "nodemailer";
import { getDb } from "@/lib/db/client";
import {
  account as authAccount,
  session as authSession,
  user as authUser,
  verification as authVerification,
} from "@/lib/db/better-auth-schema";
import {
  getBetterAuthBaseUrl,
  getBetterAuthSecret,
  getSmtpConfig,
  hasGoogleAuthEnv,
  hasSmtpEnv,
} from "@/lib/auth/env";

const db = getDb();

const plugins: BetterAuthPlugin[] = [nextCookies()];

if (hasSmtpEnv()) {
  plugins.push(
    magicLink({
      async sendMagicLink({ email, url }) {
        const smtp = getSmtpConfig();
        const transporter = nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.port === 465,
          auth: {
            user: smtp.user,
            pass: smtp.pass,
          },
        });

        await transporter.sendMail({
          from: smtp.from,
          to: email,
          subject: "FWJ施設予約管理ツール ログインリンク",
          text: `以下のリンクからログインしてください。\n\n${url}`,
          html: `<p>以下のリンクからログインしてください。</p><p><a href="${url}">${url}</a></p>`,
        });
      },
    }),
  );
}

export const auth = betterAuth({
  appName: "FWJ Venue Booking",
  secret: getBetterAuthSecret(),
  baseURL: getBetterAuthBaseUrl(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    google: hasGoogleAuthEnv()
      ? {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        }
      : undefined,
  },
  plugins,
});

export type AuthSession = typeof auth.$Infer.Session;

export async function getAuthSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getAuthUser() {
  const session = await getAuthSession();
  return session?.user ?? null;
}
