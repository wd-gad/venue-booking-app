# 施設予約管理ツール

`Next.js + Better Auth + PostgreSQL + Leaflet` で構成した会場予約管理アプリです。

## 実装内容

- 全国地図に `予約済み` と `予約候補` を色分けして表示
- 右カラムに `日付 / 会場名 / 住所 / 利用料` のタイムライン
- テーブルで `利用予定日 / 料金 / 予約ステータス` を管理
- Better Auth によるメール+パスワード / Google / マジックリンク認証
- PostgreSQL + Drizzle で会場データを管理
- 利用許可証 PDF を Object Storage に保管可能

## 技術構成

- フロント: Next.js App Router
- 認証: Better Auth
- DB: PostgreSQL + Drizzle
- 地図: Leaflet + React Leaflet
- デプロイ: OCI Compute

## ローカル起動

```bash
npm install
cp .env.example .env.local
npm run auth:migrate
npm run dev
```

ブラウザで `http://127.0.0.1:3002` を開きます。

最低限必要な設定:

```bash
DATABASE_URL=
BETTER_AUTH_URL=http://127.0.0.1:3002
BETTER_AUTH_SECRET=
```

Google ログインを使う場合:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

マジックリンクを使う場合:

```bash
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=no-reply@example.com
```

## Better Auth セットアップ

認証テーブルは Better Auth が管理します。初回セットアップ時と、auth schema を更新したときは次を実行します。

```bash
npm run auth:generate
npm run auth:migrate
```

生成された Drizzle schema は [better-auth-schema.ts](/Users/takashiwada/Documents/会場予約管理ツール/next-app/src/lib/db/better-auth-schema.ts) にあります。

## OCI Compute への配置

### 1. 環境変数ファイルを作る

```bash
cp .env.oci.example .env.oci
```

`.env.oci` を編集し、`DATABASE_URL` を OCI PostgreSQL の接続情報に合わせて更新します。

必須の auth 関連設定:

```bash
BETTER_AUTH_URL=https://app.tekamaki.org
NEXT_PUBLIC_APP_URL=https://app.tekamaki.org
NEXT_PUBLIC_BETTER_AUTH_URL=https://app.tekamaki.org/api/auth
BETTER_AUTH_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
```

Google ログインを使う場合は `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`、マジックリンクを使う場合は SMTP 設定も入れます。

### 2. OCI Ubuntu 側で起動

```bash
npm install
npm run auth:migrate
npm run build
sudo systemctl restart venue-booking-app.service
```

確認:

```bash
sudo systemctl status venue-booking-app.service --no-pager
curl -I https://app.tekamaki.org
```

### 3. Oracle Linux/Ubuntu イメージの OS Firewall を開ける

OCI の Security List で `3000` を許可しても、OS 側の `iptables` で拒否されることがあります。開発検証用には次を追加してください。

```bash
sudo iptables -I INPUT 5 -p tcp --dport 3000 -j ACCEPT
```

永続化する場合は `iptables-persistent` か `nftables` 側で保存します。

## OCI Always Free + self-hosted PostgreSQL

コスト優先で進める場合は、OCI の managed PostgreSQL ではなく `Compute + Docker` 上に PostgreSQL を自前で載せる方が向いています。

### ファイル

- Postgres 単独: [compose.oci-postgres.yaml](/Users/takashiwada/Documents/venue-booking-manager/next-app/compose.oci-postgres.yaml)
- スタック構成: [compose.oci-stack.yaml](/Users/takashiwada/Documents/venue-booking-manager/next-app/compose.oci-stack.yaml)
- 初期スキーマ: [001-schema.sql](/Users/takashiwada/Documents/venue-booking-manager/next-app/infra/postgres/init/001-schema.sql)
- 環境変数例: [.env.oci-stack.example](/Users/takashiwada/Documents/venue-booking-manager/next-app/.env.oci-stack.example)

### DB だけ先に起動する

```bash
cp .env.oci-stack.example .env.oci
docker compose --env-file .env.oci -f compose.oci-postgres.yaml up -d
docker compose --env-file .env.oci -f compose.oci-postgres.yaml ps
```

初回起動時に `infra/postgres/init/001-schema.sql` が流れます。これで OCI 側は `PostgreSQL だけ` を先に安定運用できます。

バックアップ例:

```bash
chmod +x scripts/backup-postgres.sh
POSTGRES_DB=venue_booking_manager \
POSTGRES_USER=venue_admin \
POSTGRES_PASSWORD=YOUR_PASSWORD \
./scripts/backup-postgres.sh
```

OCI で毎日自動バックアップ（JST 03:00）を有効化:

```bash
chmod +x scripts/install-oci-backup-cron.sh scripts/backup-postgres.sh
APP_DIR=/home/ubuntu/next-app \
BACKUP_DIR=/home/ubuntu/backups/postgres \
CRON_SCHEDULE="0 3 * * *" \
./scripts/install-oci-backup-cron.sh
```

登録確認:

```bash
crontab -l
tail -n 100 /home/ubuntu/logs/postgres-backup.log
```

### app + db を同居で起動する

```bash
cp .env.oci-stack.example .env.oci
docker compose --env-file .env.oci -f compose.oci-stack.yaml up -d --build
```

この同居構成では:
- `postgres` が VM 内 `5432`
- `app` が VM 内 `3000`

になります。

### OCI 側で開けるポート

- `3000` for Next.js
- `5432` は原則閉じたままにする

### 注意

利用許可証 PDF を OCI Object Storage に置く場合は、追加で次を設定します。

```bash
OCI_S3_REGION=
OCI_S3_ENDPOINT=
OCI_S3_ACCESS_KEY_ID=
OCI_S3_SECRET_ACCESS_KEY=
OCI_S3_BUCKET=
```

## 環境変数

`.env.local` に以下を設定します。

```bash
DATABASE_URL=
BETTER_AUTH_URL=http://127.0.0.1:3002
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3002
NEXT_PUBLIC_BETTER_AUTH_URL=http://127.0.0.1:3002/api/auth
BETTER_AUTH_SECRET=
```

## Google SSO 設定手順

1. Google Cloud Console で OAuth Client を作成する
2. 承認済みリダイレクト URI に `https://app.tekamaki.org/api/auth/callback/google` を登録する
3. ローカル開発用に `http://127.0.0.1:3002/api/auth/callback/google` も登録する
4. `GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` を環境変数に設定する

## Leaflet の導入について

Leaflet 自体は OSS ライブラリなので、Leaflet 用のアカウント作成は不要です。今回の実装では OpenStreetMap のタイルを使っています。

- `Leaflet`: ライブラリ本体
- `React Leaflet`: React から Leaflet を扱うラッパー
- 背景地図: OpenStreetMap タイル

`MapLibre` も選択肢ですが、スタイルやタイル供給の設計が少し増えます。今回は「最短で業務画面を立ち上げる」目的なので Leaflet を選んでいます。

## 本番デプロイ

1. GitHub に push する
2. GitHub Actions から OCI へ自動デプロイする

### GitHub Actions (pushで自動デプロイ)

[deploy-oci.yml](/Users/takashiwada/Documents/会場予約管理ツール/next-app/.github/workflows/deploy-oci.yml) を追加済みです。`main` への push で以下を実行します。
- GitHub Actions ランナーから `/home/ubuntu/next-app` へファイル同期
- OCI 側で `npm ci` / `npm run db:push -- --force` / `npm run build`
- `venue-booking-app.service` 再起動

GitHub Repository Secrets に次を設定してください:

```bash
OCI_HOST=155.248.176.237
OCI_USERNAME=ubuntu
OCI_SSH_PRIVATE_KEY=<private key content>
```

OCI 側の前提:

```bash
cd /home/ubuntu/next-app
test -f .env.oci
```

## 推奨運用

ローカル開発と本番公開は分けて運用します。

- MacBook: `npm run dev:lan` で開発する
- 公開URL: `app.tekamaki.org` は本番環境だけに向ける
- 外部確認: 必要なときだけ `cloudflared` でローカルを一時公開する

### 日常の流れ

1. MacBook で実装する
2. `npm run lint` と必要な動作確認を通す
3. GitHub に push する
4. 本番環境で deploy する
5. `app.tekamaki.org` で確認する

### GitHub への反映

このリポジトリは `origin` がまだ未設定なら、先に GitHub リポジトリを接続します。

```bash
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git branch -M main
git push -u origin main
```

以後は通常の更新で構いません。

```bash
git add .
git commit -m "Describe the change"
git push origin main
```

### OCI 反映手順

現時点の OCI 配置は `git clone` ベースではなく、`/home/ubuntu/next-app` に反映済みファイルを置いて動かしています。そのため、更新時は `GitHub push` のあとに OCI 側へコード反映と再起動を行います。

前提:

- OCI host: `ubuntu@155.248.176.237`
- app path: `/home/ubuntu/next-app`
- app service: `venue-booking-app.service`
- tunnel service: `cloudflared.service`

反映の基本手順:

```bash
rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude '.env.local' \
  --exclude '.env.oci' \
  /Users/takashiwada/Documents/venue-booking-manager/next-app/ \
  ubuntu@155.248.176.237:/home/ubuntu/next-app/ \
  -e 'ssh -i /Users/takashiwada/Downloads/ssh-key-2026-03-04.key'
```

OCI 側で build と再起動:

```bash
ssh -i /Users/takashiwada/Downloads/ssh-key-2026-03-04.key ubuntu@155.248.176.237
cd /home/ubuntu/next-app
export $(grep -v '^#' .env.oci | xargs)
npm install
npm run build
sudo systemctl restart venue-booking-app.service
sudo systemctl status venue-booking-app.service --no-pager
```

公開確認:

```bash
curl -I https://app.tekamaki.org
```

`HTTP 200` なら反映完了です。

まとめて実行するなら:

```bash
chmod +x scripts/deploy-oci.sh
./scripts/deploy-oci.sh
```

### 本番反映の考え方

- `main`: 本番に反映してよい状態だけを置く
- ローカル作業中: MacBook 上の `next dev` で確認する
- 公開確認: 本番URLで行う

ローカルの `cloudflared` は便利ですが、本番公開先として固定しない方が安全です。`app.tekamaki.org` を MacBook に向け続けると、スリープや再起動で公開が止まります。

## 参考ドキュメント

- Next.js App Router: [nextjs.org/docs](https://nextjs.org/docs)
- Better Auth: [better-auth.com/docs](https://www.better-auth.com/docs)
- Better Auth Magic Link: [better-auth.com/docs/plugins/magic-link](https://www.better-auth.com/docs/plugins/magic-link)
- Leaflet Quick Start: [leafletjs.com/examples/quick-start](https://leafletjs.com/examples/quick-start/)

## 移行設計

- OCI への移行計画: [docs/oci-migration-plan.md](/Users/takashiwada/Documents/venue-booking-manager/next-app/docs/oci-migration-plan.md)
- 管理基盤比較: [docs/coolify-vs-dokploy.md](/Users/takashiwada/Documents/venue-booking-manager/next-app/docs/coolify-vs-dokploy.md)
- OCI 切り替え手順: [docs/oci-cutover-runbook.md](/Users/takashiwada/Documents/venue-booking-manager/next-app/docs/oci-cutover-runbook.md)
- OCI スペック/コスト判断: [docs/oci-scale-up-cost-guide.md](/Users/takashiwada/Documents/会場予約管理ツール/next-app/docs/oci-scale-up-cost-guide.md)
