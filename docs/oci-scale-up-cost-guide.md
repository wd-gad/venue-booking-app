# OCI スペックアップ/コスト判断ガイド

最終更新: 2026-03-05

## 目的

- OCI がボトルネックかを判断する
- 途中でスペックアップできるかを判断する
- Supabase/Vercel の無料運用と比べて高くならないように運用する

## 現在の実測（この環境）

2026-03-05 時点でサーバー実測は以下でした。

- Shape: `VM.Standard.E2.1.Micro`
- CPU 表示: `2 vCPU`
- メモリ: `約 1 GB`
- swap: `使用率高め`
- `uptime` の load average: `4.36, 4.15, 2.52`

この数値は「メモリ不足 + バースト系CPUの頭打ち」が出ている状態です。  
まずは無料枠内で構成改善し、それでも足りない場合だけ有料Shapeを検討してください。

## OCI コスト見積もりの基本式

月額は以下で見積もります。

`Compute(OCPU単価 x OCPU x 730h) + Memory(GB単価 x GB x 730h) + Boot Volume + 転送料 + Object Storage`

注意点:

- Compute は停止中は非課金
- Boot Volume は停止中でも課金
- Always Free 枠内の対象リソースは 0 円

## 最初にやること（5分）

1. OCI Console で `Compute > Create Instance > Shape` を開く
2. `Always Free Eligible` の付いた Shape のみを確認する
3. `Governance & Administration > Limits, Quotas and Usage` を開く
4. 利用可能な Always Free 枠の CPU/Memory を確認する
5. `Billing & Cost Management > Budgets` で予算アラートを作る（例: `USD 1`）

## 途中からスペックアップできるか

可能です。以下の2パターンがあります。

### パターンA: 互換 Shape にそのまま変更（最短）

`Compute Instance > More Actions > Change Shape` で変更します。  
同系統内で互換がある場合はこの方法が最短です。

実施後に確認:

```bash
ssh -i /Users/takashiwada/Downloads/ssh-key-2026-03-04.key ubuntu@155.248.176.237 \
  "curl -s -H 'Authorization: Bearer Oracle' http://169.254.169.254/opc/v2/instance/ | jq -r '.shape'"
```

### パターンB: 新規インスタンスを作って移行（無料枠優先）

`E2 (x86)` から `A1 (Arm)` に寄せたい場合は新規作成移行が安全です。  
`node:22-bookworm-slim` と `postgres:16-bookworm` は multi-arch なので現行Composeは流用しやすいです。

## 推奨手順（停止時間最小）

現行は `DBコンテナのみ稼働` なので、まず DB を安全に移してから app を切り替えます。

1. 新規 OCI インスタンス作成（Always Free Eligible を優先）
2. 新規側で Docker / Compose をセットアップ
3. 現行DBをダンプ
4. 新規側DBへリストア
5. アプリの `DATABASE_URL` を新規DBへ切り替え
6. `venue-booking-app.service` 再起動
7. 動作確認後に旧DBを停止

自動化スクリプト:

- 事前チェック: `scripts/oci-preflight-check.sh`
- DB移行: `scripts/migrate-postgres-oci-to-oci.sh`

実行例:

```bash
cd /Users/takashiwada/Documents/会場予約管理ツール/next-app
./scripts/oci-preflight-check.sh \
  ubuntu@155.248.176.237 \
  ubuntu@<NEW_OCI_IP> \
  /Users/takashiwada/Downloads/ssh-key-2026-03-04.key

./scripts/migrate-postgres-oci-to-oci.sh \
  ubuntu@155.248.176.237 \
  ubuntu@<NEW_OCI_IP> \
  /Users/takashiwada/Downloads/ssh-key-2026-03-04.key
```

先に手順だけ検証する場合:

```bash
./scripts/migrate-postgres-oci-to-oci.sh --dry-run \
  ubuntu@155.248.176.237 \
  ubuntu@<NEW_OCI_IP> \
  /Users/takashiwada/Downloads/ssh-key-2026-03-04.key
```

### 3) 現行 DB ダンプ

```bash
ssh -i /Users/takashiwada/Downloads/ssh-key-2026-03-04.key ubuntu@155.248.176.237 \
  "cd /home/ubuntu/next-app && \
   docker exec -i venue-booking-postgres pg_dump -U venue_admin -d venue_booking_manager -Fc" \
  > /tmp/venue_booking_manager_$(date +%Y%m%d_%H%M%S).dump
```

### 4) 新規側 DB リストア

新規インスタンスへ dump を転送後:

```bash
docker cp /tmp/venue.dump venue-booking-postgres:/tmp/venue.dump
docker exec -it venue-booking-postgres \
  pg_restore -U venue_admin -d venue_booking_manager --clean --if-exists /tmp/venue.dump
```

## ボトルネック確認コマンド（切り分け）

```bash
ssh -i /Users/takashiwada/Downloads/ssh-key-2026-03-04.key ubuntu@155.248.176.237 \
  "uptime; free -h; vmstat 1 5; docker stats --no-stream"
```

見るポイント:

- `free -h` でメモリ枯渇 + swap増加
- `vmstat` の `si/so` が継続して大きい
- `load average` が CPU 数を常時超える

## Supabase/Vercel 無料運用との比較ルール

現状が Supabase/Vercel 無料なら、比較基準は次の通りに固定します。

- 目標: OCI も原則 0 円（Always Free 範囲）
- 逸脱検知: Budget アラートで即通知
- 有料化判断: 無料枠で SLO を満たせないことを 1 週間のメトリクスで確認後

この順にすると「先に有料化してしまう」判断ミスを避けられます。

## 参考

- OCI Compute Shapes: https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeshapes.htm
- Change Shape: https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/resizinginstances.htm
- Cost Analysis: https://docs.oracle.com/en-us/iaas/Content/Billing/Concepts/costanalysisoverview.htm
