# Dev Environment

Databases in Docker + app services on host for debugging.

## Quick Start

```bash
cp .env.example .env        # passwords/keys (defaults work for local dev)
docker compose up -d         # MongoDB + Redis
```

## Run App Services on Host

Load env vars pointing to `localhost` (same config as deploy, only hostnames differ):

```bash
source .env.host
```

Then run each service in a separate terminal:

**Trading Engine** (Rust — breakpoints, RUST_LOG):
```bash
cd packages/trading-engine
source ../docker/dev/.env.host
cargo run
```

**CMS Backend** (Node.js — hot-reload):
```bash
cd packages/cms-backend
source ../docker/dev/.env.host
npm run dev
```

**CMS Frontend** (Next.js — hot-reload):
```bash
cd packages/cms-frontend
source ../docker/dev/.env.host
npm run dev
```

## Optional Tools

```bash
# Redis Commander — browse Redis at http://localhost:8081
docker compose --profile debug up -d

# Prometheus + Grafana — http://localhost:9090, http://localhost:3002
docker compose --profile monitoring up -d
```

## Full Containerized (CI / demo)

Run everything in Docker without host toolchains:

```bash
docker compose --profile app up -d
docker compose --profile app --profile debug --profile monitoring up -d  # everything
```

## Ports

| Port  | Service          | Default | Profile      |
|-------|------------------|---------|--------------|
| 27017 | MongoDB          | yes     |              |
| 6379  | Redis            | yes     |              |
| 8081  | Redis Commander  |         | `debug`      |
| 3010  | Trading Engine   |         | `app`        |
| 3001  | CMS Backend      |         | `app`        |
| 3000  | CMS Frontend     |         | `app`        |
| 9090  | Prometheus       |         | `monitoring` |
| 3002  | Grafana          |         | `monitoring` |

## Files

| File             | Purpose                                           |
|------------------|---------------------------------------------------|
| `.env.example`   | Docker compose env vars (copy to `.env`)           |
| `.env.host`      | Host-mode env vars (`source` before `cargo run`)   |
| `prometheus.yml` | Prometheus scrape config (TE + CMS Backend)        |
