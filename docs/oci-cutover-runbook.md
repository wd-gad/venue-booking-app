# OCI Cutover Runbook

## Goal

Move `app.tekamaki.org` off the MacBook and run it from OCI.

After cutover:

- MacBook is used only for local development.
- `app.tekamaki.org` is served from OCI.
- Cloudflare Tunnel runs on OCI, not on the MacBook.

## Current Assumptions

- The app runs from this repository's `next-app` directory.
- `supabase.tekamaki.org` can continue to point to the current Supabase tunnel for now.
- App runtime will be Docker Compose on OCI.
- OCI PostgreSQL may be either:
  - managed PostgreSQL, referenced by `DATABASE_URL`, or
  - self-hosted PostgreSQL via `compose.oci-stack.yaml`.

## Files Used

- [compose.yaml](/Users/takashiwada/Documents/venue-booking-manager/next-app/compose.yaml)
- [compose.oci-stack.yaml](/Users/takashiwada/Documents/venue-booking-manager/next-app/compose.oci-stack.yaml)
- [.env.oci.example](/Users/takashiwada/Documents/venue-booking-manager/next-app/.env.oci.example)
- [cloudflared-config.yml](/Users/takashiwada/Documents/venue-booking-manager/next-app/deploy/oci/cloudflared-config.yml)
- [venue-booking-manager.service](/Users/takashiwada/Documents/venue-booking-manager/next-app/deploy/oci/venue-booking-manager.service)
- [cloudflared.service](/Users/takashiwada/Documents/venue-booking-manager/next-app/deploy/oci/cloudflared.service)

## OCI Target Layout

Suggested target paths on OCI:

- App checkout: `/opt/venue-booking-manager/next-app`
- App env file: `/opt/venue-booking-manager/next-app/.env.oci`
- Cloudflared config: `/etc/cloudflared/config.yml`
- Cloudflared credentials: `/etc/cloudflared/<tunnel-id>.json`

## One-Time Server Setup

Install Docker, Compose plugin, and cloudflared on the OCI host.

Example outline:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Install `cloudflared` using the official package for the OCI host OS.

## App Deployment

Clone the repo on OCI and place the runtime env file.

```bash
sudo mkdir -p /opt/venue-booking-manager
sudo chown $USER:$USER /opt/venue-booking-manager
cd /opt/venue-booking-manager
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd next-app
cp .env.oci.example .env.oci
```

Fill in `.env.oci` with real values:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- optional `OCI_S3_*`

If app only should run on OCI:

```bash
docker compose --env-file .env.oci -f compose.yaml up -d --build
```

If app and PostgreSQL should run together on OCI:

```bash
docker compose --env-file .env.oci -f compose.oci-stack.yaml up -d --build
```

## Tunnel Cutover

Use the existing tunnel ID if you want to keep the current DNS record.

Current local tunnel:

- `d82511bf-dee6-4fc3-aab2-9cb839bbb1f7`

Copy the tunnel credentials JSON from the MacBook to OCI, then place the config at `/etc/cloudflared/config.yml`.

Expected ingress:

- `app.tekamaki.org -> http://127.0.0.1:3000`
- `supabase.tekamaki.org` stays wherever you want it to stay

Important:

- Do not run the same tunnel from both MacBook and OCI long-term.
- For cutover, stop the MacBook `cloudflared` after OCI is connected and healthy.

## Verification

On OCI:

```bash
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs --tail=100 app
curl -I http://127.0.0.1:3000
sudo systemctl status cloudflared
```

From outside:

```bash
curl -I https://app.tekamaki.org
```

Healthy result should be `HTTP 200`.

## Rollback

If OCI fails after cutover:

1. Stop `cloudflared` on OCI
2. Restart `cloudflared` on the MacBook
3. Restart the local app on port `3002`

That restores the previous temporary setup quickly.
