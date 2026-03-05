import { betterAuth } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, magicLink } from "better-auth/plugins";
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
  getTrustedOrigins,
  hasGoogleAuthEnv,
  hasSmtpEnv,
} from "@/lib/auth/env";

const db = getDb();

const plugins: BetterAuthPlugin[] = [nextCookies()];

if (hasSmtpEnv()) {
  const getRequestOrigin = (request?: Request) => {
    const candidate = request?.headers.get("origin") ?? request?.headers.get("referer");
    if (!candidate) {
      return null;
    }

    try {
      return new URL(candidate).origin;
    } catch {
      return null;
    }
  };

  const sendAuthMail = async ({
    email,
    subject,
    text,
    html,
  }: {
    email: string;
    subject: string;
    text: string;
    html: string;
  }) => {
    const smtp = getSmtpConfig();
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth:
        smtp.user && smtp.pass
          ? {
              user: smtp.user,
              pass: smtp.pass,
            }
          : undefined,
    });

    await transporter.sendMail({
      from: smtp.from,
      to: email,
      subject,
      text,
      html,
    });
  };

  plugins.push(
    magicLink({
      async sendMagicLink({ email, url }, ctx) {
        const requestOrigin = getRequestOrigin(ctx?.request);
        let resolvedUrl = url;

        if (requestOrigin) {
          try {
            const magicLinkUrl = new URL(url);
            const callbackURL = magicLinkUrl.searchParams.get("callbackURL");

            magicLinkUrl.protocol = new URL(requestOrigin).protocol;
            magicLinkUrl.host = new URL(requestOrigin).host;

            if (callbackURL) {
              const callback = new URL(callbackURL);
              callback.protocol = new URL(requestOrigin).protocol;
              callback.host = new URL(requestOrigin).host;
              magicLinkUrl.searchParams.set("callbackURL", callback.toString());
            }

            resolvedUrl = magicLinkUrl.toString();
          } catch {
            resolvedUrl = url;
          }
        }

        await sendAuthMail({
          email,
          subject: "FWJ施設予約管理ツール ログインリンク",
          text: `以下のリンクからログインしてください。\n\n${resolvedUrl}`,
          html: `<p>以下のリンクからログインしてください。</p><p><a href="${resolvedUrl}">${resolvedUrl}</a></p>`,
        });
      },
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        const typeLabel =
          type === "sign-in"
            ? "サインイン"
            : type === "email-verification"
              ? "メール確認"
              : type === "forget-password"
                ? "パスワード再設定"
                : "メールアドレス変更";

        await sendAuthMail({
          email,
          subject: `FWJ施設予約管理ツール ${typeLabel}コード`,
          text: `認証コード: ${otp}\n5分以内に入力してください。`,
          html: `<p>認証コード: <strong>${otp}</strong></p><p>5分以内に入力してください。</p>`,
        });
      },
    }),
  );
}

export const auth = betterAuth({
  appName: "FWJ Venue Booking",
  secret: getBetterAuthSecret(),
  baseURL: getBetterAuthBaseUrl(),
  trustedOrigins: async (request) => getTrustedOrigins(request),
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
