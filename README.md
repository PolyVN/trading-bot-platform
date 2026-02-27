# Multi-Exchange Trading Bot System

[![Rust](https://img.shields.io/badge/Trading_Engine-Rust_2024-000000?logo=rust&logoColor=white)](docs/01-trading-engine/architecture.md)
[![TypeScript](https://img.shields.io/badge/CMS-TypeScript_5.9-3178C6?logo=typescript&logoColor=white)](docs/03-cms-backend/architecture.md)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_16-000000?logo=next.js&logoColor=white)](docs/04-cms-frontend/architecture.md)
[![Redis](https://img.shields.io/badge/Cache-Redis_7.4-DC382D?logo=redis&logoColor=white)](docs/06-infrastructure/docker-compose.md)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_8.0-47A248?logo=mongodb&logoColor=white)](docs/03-cms-backend/database-schemas.md)
[![Docker](https://img.shields.io/badge/Deploy-Docker_Compose-2496ED?logo=docker&logoColor=white)](docs/06-infrastructure/docker-compose.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Event-driven trading bot platform supporting **Polymarket** (on-chain prediction markets) and **OKX** (spot/futures/perpetuals), with a unified CMS dashboard and cross-exchange arbitrage support.

```mermaid
graph LR
  subgraph TE[Trading Engine]
    TE_PM[Polymarket Adapter]
    TE_OKX[OKX Adapter]
  end
  subgraph CMS[CMS]
    BE[CMS Backend<br/>Fastify]
    FE[CMS Frontend<br/>Next.js 16]
  end
  subgraph DB[Database]
    Redis[(Redis 7.4<br/>Sentinel HA)]
    Mongo[(MongoDB 8.0)]
  end

  TE_PM <-->|"CLOB SDK + WS"| PMX((Polymarket))
  TE_OKX <-->|"V5 REST + WS"| OKXX((OKX))

  TE_PM & TE_OKX <-->|Pub/Sub + BullMQ| Redis
  BE <--> Redis
  BE <--> Mongo
  FE <-->|Socket.IO + REST| BE
```

## Key Features

- **Multi-exchange** — Polymarket + OKX via adapter pattern; extensible to new exchanges
- **Cross-exchange arb** — Polymarket vs OKX futures; extensible to new prediction markets
- **Compiled strategies** — Market making, signal-based, arbitrage, grid trading, funding rate arb, DCA (Rust, trait-based)
- **Risk management** — Per-bot + portfolio-level limits, cross-exchange aggregation, auto-stop
- **Paper trading** — Real feeds, simulated execution per exchange (incl. leverage/liquidation for OKX)
- **Realtime dashboard** — Next.js 16 + shadcn/ui, Socket.IO, exchange selector, live PnL
- **Horizontal scaling** — Multiple TE instances, Redis-based engine registry
- **Redis Sentinel HA** — Master + replica + 3 sentinels, fail-closed on Redis failure

## Architecture

| Component | Stack |
|-----------|-------|
| Trading Engine | **Rust 2024 edition** (tokio 1.49), polymarket-client-sdk, redis 1.0, tokio-tungstenite 0.28, reqwest 0.13, serde 1.0, tracing 0.1, prometheus-client 0.24 |
| Shared Types | JSON Schema (source of truth) → codegen to TypeScript (`json-schema-to-typescript 15.0`) + Rust (`typify 0.6`) |
| CMS Backend | Node.js 22 LTS / TypeScript 5.9: Fastify 5.7, Mongoose 9.2, Socket.IO 4.8, BullMQ 5.70, Pino 10.3, Zod 4.3, decimal.js 10.6 |
| CMS Frontend | Next.js 16 / React 19.2, shadcn/ui, Tailwind CSS 4.2, TanStack Query 5.90, TanStack Table 8.21, Recharts 3.7, Socket.IO Client 4.8, NextAuth.js 4.24 |
| Infrastructure | Docker Compose v2, Redis 7.4 (Sentinel), MongoDB 8.0, Prometheus 3.x, Grafana 11.x, Caddy 2.9 |

## Prerequisites

- **Rust** 1.85+ (`rustup`, `cargo`)
- **Node.js** 22+ LTS (`npm`)
- **Docker** 27+ & Docker Compose v2
- **Git** with SSH keys added to GitHub
- **Servers**: 3 servers minimum (TE + CMS + DB) with private network (10.0.0.0/24 recommended); optionally 4+ with dedicated TE per exchange
- **Exchange credentials**: Managed via CMS API (not .env files) — Polymarket wallet private key, OKX API key/secret/passphrase

## Repositories

This root repo (`trading-system`) contains architecture documentation and orchestration only. Implementation lives across 5 sub-repos:

| Repo | Description | Clone |
|------|-------------|-------|
| [`trading-shared-types`](https://github.com/PolyVN/trading-shared-types) | JSON Schema (source of truth) → `@polyvn/shared-types` (npm) + `polyvn-shared-types` (Rust crate) | `git@github.com:PolyVN/trading-shared-types.git` |
| [`trading-engine`](https://github.com/PolyVN/trading-engine) | Rust trading engine: bot execution, exchange adapters, strategies | `git@github.com:PolyVN/trading-engine.git` |
| [`trading-cms-backend`](https://github.com/PolyVN/trading-cms-backend) | Node.js/TypeScript: Fastify REST API, BullMQ workers, Socket.IO relay | `git@github.com:PolyVN/trading-cms-backend.git` |
| [`trading-cms-frontend`](https://github.com/PolyVN/trading-cms-frontend) | Next.js 16 dashboard, exchange selector, realtime UI | `git@github.com:PolyVN/trading-cms-frontend.git` |
| [`trading-docker`](https://github.com/PolyVN/trading-docker) | Docker Compose per service (database, trading-engine, cms) | `git@github.com:PolyVN/trading-docker.git` |

## Documentation

Full architecture docs in [`docs/`](docs/00-overview.md):

| Section | Contents |
|---------|----------|
| [00 - Overview](docs/00-overview.md) | System overview, exchange support matrix, decisions log |
| [01 - Trading Engine](docs/01-trading-engine/) | Exchange abstraction, feeds, execution, risk, strategies, paper trading |
| [02 - Exchanges](docs/02-exchanges/) | Registry, Polymarket, OKX adapters |
| [03 - CMS Backend](docs/03-cms-backend/) | API routes, database schemas, RBAC, queue workers |
| [04 - CMS Frontend](docs/04-cms-frontend/) | Pages, exchange selector, realtime hooks |
| [05 - Communication](docs/05-communication/) | Redis Pub/Sub channels, BullMQ queues, WebSocket protocol |
| [06 - Infrastructure](docs/06-infrastructure/) | Docker Compose, deployment, monitoring, security |
| [07 - Shared Types](docs/07-shared-types/) | JSON Schema → TypeScript + Rust codegen |
| [08 - Implementation](docs/08-implementation/) | Roadmap, verification checklist |
| [Troubleshooting](docs/troubleshooting.md) | Common errors and debugging guide |

## Quick Start

```bash
# Clone all repos into a parent directory
mkdir polyvn && cd polyvn

git clone git@github.com:PolyVN/trading-system.git
git clone git@github.com:PolyVN/trading-shared-types.git
git clone git@github.com:PolyVN/trading-engine.git
git clone git@github.com:PolyVN/trading-cms-backend.git
git clone git@github.com:PolyVN/trading-cms-frontend.git
git clone git@github.com:PolyVN/trading-docker.git
```

> **Important**: Services must be started in order: **Database → Shared Types → Trading Engine → CMS**. The Trading Engine depends on Redis, and the CMS depends on both Redis and MongoDB.

```bash
# 1. Start database layer
cd trading-docker/database
cp .env.example .env        # fill in MongoDB/Redis passwords
docker compose up -d
docker compose logs -f --tail=20   # verify MongoDB and Redis are healthy, then Ctrl+C

# 2. Generate shared types (used by engine + cms-backend)
cd ../../trading-shared-types
npm install && npm run generate   # generates TypeScript + Rust types from JSON Schema

# 3. Build trading engine (Rust)
cd ../trading-engine
cargo build --release

# 4. Start trading engine
cd ../trading-docker/trading-engine
cp .env.example .env        # fill in DB_HOST, REDIS_PASSWORD, ENCRYPTION_KEY
docker compose up -d
docker compose logs -f --tail=20   # verify TE registers in Redis, then Ctrl+C

# 5. Start CMS
cd ../cms
cp .env.example .env        # fill in DB_HOST, passwords, JWT/NextAuth secrets
docker compose up -d
docker compose logs -f --tail=20   # verify CMS Backend connects to Redis + MongoDB

# 6. Verify everything is running
curl http://localhost:3001/api/system/health        # CMS Backend health
curl http://localhost:3001/api/engines              # should list registered TEs

# 7. Add exchange credentials via CMS (not in .env)
#    Create wallets: POST /api/wallets (Polymarket PK, OKX keys)
#    Create bots:    POST /api/bots (strategy, exchange, risk limits)
#    See "Creating Your First Bot" below
```

See [`env/`](env/) for `.env.example` templates (infrastructure config only — exchange credentials are managed via CMS).
See [deployment guide](docs/06-infrastructure/deployment.md) for full setup, firewall rules, and reverse proxy config.

## Creating Your First Bot

After all services are running, create a bot via the CMS API (or use the dashboard at `http://localhost:3000`):

```bash
# 1. Login to get a JWT token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-password"}' \
  | jq -r '.token')

# 2. Register a wallet (Polymarket example)
WALLET_ID=$(curl -s -X POST http://localhost:3001/api/wallets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pm-wallet-1",
    "exchange": "polymarket",
    "credentials": {
      "proxyAddress": "0xYourProxyAddress",
      "encryptedPrivateKey": "aes256gcm:..."
    }
  }' | jq -r '.walletId')

# 3. Create a market-making bot (paper mode for testing)
BOT_ID=$(curl -s -X POST http://localhost:3001/api/bots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pm-mm-test",
    "exchange": "polymarket",
    "strategy": "market-making",
    "walletId": "'$WALLET_ID'",
    "mode": "paper",
    "config": { "spread": 0.03, "orderSize": 10 },
    "exchangeConfig": { "marketId": "0x...", "tokenId": "71321045..." },
    "riskLimits": { "maxDailyLoss": 50, "maxDrawdown": 10, "maxPositionSize": 200 }
  }' | jq -r '.botId')

# 4. Start the bot
curl -X POST "http://localhost:3001/api/bots/$BOT_ID/start" \
  -H "Authorization: Bearer $TOKEN"
```

See [API routes](docs/03-cms-backend/api-routes.md) for full endpoint reference.

## License

[MIT](LICENSE)
