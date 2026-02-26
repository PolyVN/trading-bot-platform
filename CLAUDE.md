# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Polymarket event-driven trading bot system. Multi-repo architecture with 5 repositories, 3 VPS deployment. This repo (`polymarketjs`) is the root project containing architecture documentation and orchestration.

## Architecture (3 VPS, 5 Repos)

```
VPS 1: Trading Engine (Node.js/TS) ──┐
VPS 2: CMS Backend (Fastify) +       ├── VPS 3: MongoDB + Redis
       CMS Frontend (Next.js 15) ────┘
```

| Repo | Purpose |
|------|---------|
| `polymarket-shared-types` | `@polymarket/shared-types` npm package - all TypeScript interfaces |
| `polymarket-trading-engine` | Event-driven bot execution, strategy plugins, data feeds |
| `polymarket-cms-backend` | Fastify REST API, BullMQ workers, Socket.IO relay |
| `polymarket-cms-frontend` | Next.js 15 dashboard with shadcn/ui, realtime via Socket.IO |
| `polymarket-docker` | Docker Compose per VPS (vps1-trading, vps2-cms, vps3-database) |

## Communication Flow

- **Trading Engine → CMS Backend**: Redis Pub/Sub (realtime) + BullMQ (persistent)
- **CMS Backend → Trading Engine**: Redis Pub/Sub with `{engineId}` routing
- **CMS Backend → CMS Frontend**: Socket.IO WebSocket + REST API
- **Persistence**: Only CMS Backend writes to MongoDB (via BullMQ workers). Trading Engine never touches DB directly.

## Key Architectural Patterns

**Event-driven trading engine**: Single process async, each bot is a BotRunner instance with its own AbortController. Hybrid tick model: event-driven (`onFeedUpdate`) for fast reaction + periodic (`onTick`) for maintenance.

**Shared data feeds (FeedManager)**: Singleton with reference counting. Multiple bots trading the same market share 1 WebSocket connection. `subscribe()` increments refCount; `unsubscribe()` decrements; feed closes at refCount=0.

**Strategy plugin system**: `BaseStrategy` abstract class. Builtin strategies in `src/strategies/builtin/`. External plugins hot-reloaded via dynamic `import()` from `plugins/` directory without engine restart.

**Multi-engine horizontal scaling**: Each TE instance has a unique `engineId`. Redis HSET for engine registry. CMS routes commands to `cms:bot:command:{engineId}`. Bot assignment stored in MongoDB.

**Paper trading**: Same data feeds, simulated order execution via `PaperExecutor` (same interface as `OrderExecutor`). Flag `isPaper` propagated throughout orders, trades, PnL.

**Risk management**: Auto-stop → `RISK_STOPPED` status (requires manual resume from CMS). Telegram alert + CMS red banner. Checks: maxDailyLoss, maxDrawdown, maxPositionSize, maxOrdersPerMinute.

## Important Conventions

- All Redis Pub/Sub payloads include `engineId` and `timestamp`
- Channel names defined as shared constants in `@polymarket/shared-types` (never hardcode strings)
- Private keys encrypted with AES-256-GCM, `ENCRYPTION_KEY` from env
- Wallet system uses Polymarket proxy wallets: proxy address + private key → CLOB credentials
- Order status never goes backwards (use STATUS_ORDER map for comparison)
- Pub/Sub payloads must stay < 10KB; large data goes through BullMQ
- Use separate Redis connections for subscriber vs publisher vs cache
- Bot states: IDLE → STARTING → RUNNING → PAUSING/PAUSED → STOPPING → STOPPED, plus RISK_STOPPED and ERROR
- RBAC roles: admin (full), operator (manage bots/orders, no users/keys), viewer (read-only)

## Documentation

Full architecture docs are in `docs/` organized by service:
- `docs/00-overview.md` - System overview, decisions log
- `docs/01-trading-engine/` - All TE modules (feed-manager, strategies, risk, paper trading, etc.)
- `docs/02-cms-backend/` - API routes, database schemas, RBAC, queue workers
- `docs/03-cms-frontend/` - Pages, realtime hooks
- `docs/04-communication/` - Redis Pub/Sub channels, BullMQ queues, WebSocket protocol
- `docs/05-infrastructure/` - Docker Compose, deployment, monitoring, security
- `docs/06-shared-types/` - All TypeScript interfaces
- `docs/07-implementation/` - Roadmap, verification checklist

## Tech Stack

| Service | Stack |
|---------|-------|
| Trading Engine | Node.js 20+, TypeScript, ioredis, bullmq, pino, prom-client, @polymarket/clob-client |
| CMS Backend | Fastify, Mongoose (MongoDB), Socket.IO, BullMQ workers, NextAuth-compatible JWT |
| CMS Frontend | Next.js 15, shadcn/ui, TanStack Query v5, TanStack Table, Recharts, Socket.IO Client, NextAuth.js v5 |
| Infrastructure | Docker Compose, Redis 7, MongoDB 7, Prometheus, Grafana, Caddy/nginx reverse proxy |
