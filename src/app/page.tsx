import { VenueDashboard } from "@/components/venue-dashboard";
import { hasGoogleAuthEnv, hasSmtpEnv } from "@/lib/auth/env";
import { getAuthUser } from "@/lib/auth/server";
import { hasDatabaseUrl } from "@/lib/db/env";
import { listVenues } from "@/lib/db/repositories/venues";
import type { Venue } from "@/lib/types";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const databaseEnabled = hasDatabaseUrl();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const user = await getAuthUser();

  let initialUserEmail: string | null = null;
  let initialUserName: string | null = null;
  let initialVenues: Venue[] = [];
  let initialMessage: string | null = null;

  const authError =
    typeof resolvedSearchParams.authError === "string"
      ? resolvedSearchParams.authError
      : typeof resolvedSearchParams.error === "string"
        ? resolvedSearchParams.error
        : null;
  const authErrorDescription =
    typeof resolvedSearchParams.authErrorDescription === "string"
      ? resolvedSearchParams.authErrorDescription
      : typeof resolvedSearchParams.message === "string"
        ? resolvedSearchParams.message
        : null;

  if (authError) {
    initialMessage = authErrorDescription && typeof authErrorDescription === "string"
      ? decodeURIComponent(authErrorDescription)
      : `認証に失敗しました: ${authError}`;
  }

  initialUserEmail = user?.email ?? null;
  initialUserName = user?.name ?? null;

  if (user && databaseEnabled) {
    initialVenues = await listVenues();
  }

  if (!initialMessage) {
    if (!databaseEnabled) {
      initialMessage = "DATABASE_URL が未設定のため、会場データを読み込めません。";
    } else if (user?.name || user?.email) {
      initialMessage = `サインイン中: ${user?.name ?? user?.email}`;
    } else {
      initialMessage = "サインインすると会場一覧を表示します。";
    }
  }

  return (
    <VenueDashboard
      initialMessage={initialMessage}
      initialUserEmail={initialUserEmail}
      initialUserName={initialUserName}
      initialVenues={initialVenues}
      databaseEnabled={databaseEnabled}
      googleAuthEnabled={hasGoogleAuthEnv()}
      magicLinkEnabled={hasSmtpEnv()}
    />
  );
}
