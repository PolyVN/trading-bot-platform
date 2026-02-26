# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-exchange event-driven trading bot system. Supports **Polymarket** (prediction markets) and **OKX** (spot/futures/perpetuals), extensible to more exchanges. Multi-repo architecture with 5 repositories, 3-4 VPS deployment. This repo is the root project containing architecture documentation and orchestration.

## Architecture (3-4 VPS, 5 Repos)

```
VPS 1: TE Polymarket (Node.js/TS) ──┐
VPS 4: TE OKX (Node.js/TS)         ├── VPS 3: MongoDB + Redis
  (or co-located on VPS 1)          │
VPS 2: CMS Backend (Fastify) +     ─┘
       CMS Frontend (Next.js 15)
```

| Repo | Purpose |
|------|---------|
| `polymarket-shared-types` | `@polymarket/shared-types` npm package - all TypeScript interfaces (exchange-agnostic) |
| `polymarket-trading-engine` | Event-driven bot execution, exchange adapters, strategy plugins, data feeds |
| `polymarket-cms-backend` | Fastify REST API, BullMQ workers, Socket.IO relay (exchange-agnostic) |
| `polymarket-cms-frontend` | Next.js 15 dashboard with shadcn/ui, exchange selector, realtime via Socket.IO |
| `polymarket-docker` | Docker Compose per VPS (vps1-trading, vps2-cms, vps3-database, vps4-okx) |

## Multi-Exchange Architecture

**Exchange type**: `'polymarket' | 'okx'` (extensible union type)

**Exchange Abstraction Layer**: Core interfaces decouple trading logic from exchange specifics:
- `IOrderExecutor` - place/cancel/amend orders
- `IFeedProvider` - market data feeds (orderbook, ticker, trades, klines)
- `IWalletAdapter` - credential management, balance queries
- `IPositionAdapter` - position tracking (binary shares vs leveraged contracts)
- `ExchangeAdapter` - composite interface combining all above

**ExchangeRegistry**: Factory singleton that registers exchange adapters at startup. BotRunner resolves adapter via `ExchangeRegistry.getAdapter(bot.exchange)`.

| Aspect | Polymarket | OKX |
|--------|-----------|-----|
| Type | Prediction market (binary) | CEX (spot/futures/perp/options) |
| Auth | Proxy wallet + PK → CLOB creds | API Key + Secret + Passphrase |
| Currency | USDC only | Multi-currency (USDT, USDC, BTC...) |
| Leverage | No | 1x-125x |
| Resolution | Yes (binary outcome) | No (continuous), but futures expire |
| Order types | Limit, Market | Limit, Market, Stop, Trailing, TP/SL, Iceberg, TWAP |

## Communication Flow

- **Trading Engine → CMS Backend**: Redis Pub/Sub (realtime) + BullMQ (persistent)
- **CMS Backend → Trading Engine**: Redis Pub/Sub with `{engineId}` routing
- **CMS Backend → CMS Frontend**: Socket.IO WebSocket + REST API
- **Persistence**: Only CMS Backend writes to MongoDB (via BullMQ workers). Trading Engine never touches DB directly.
- **All payloads** include `exchange`, `engineId`, and `timestamp` fields.

## Key Architectural Patterns

**Exchange abstraction**: All exchange-specific code lives in `src/exchanges/{exchange}/`. Core modules (BotRunner, FeedManager, RiskManager, StrategyContext) are exchange-agnostic and work through adapter interfaces.

**Event-driven trading engine**: Single process async, each bot is a BotRunner instance with its own AbortController. Hybrid tick model: event-driven (`onFeedUpdate`) for fast reaction + periodic (`onTick`) for maintenance.

**Shared data feeds (FeedManager)**: Singleton with reference counting. Feed key format: `{exchange}:{feedType}:{params}`. Multiple bots on same feed share 1 WebSocket connection.

**Strategy plugin system**: `BaseStrategy` abstract class with `supportedExchanges: Exchange[]`. Builtin strategies: Market Making, Signal-based, Arbitrage (cross-exchange), Grid Trading (OKX), Funding Rate Arb (OKX), DCA (OKX). External plugins hot-reloaded via dynamic `import()`.

**Multi-engine horizontal scaling**: Each TE instance has unique `engineId` + `supportedExchanges`. Engines can specialize per exchange or handle multiple.

**Paper trading**: PaperExecutor wraps any exchange's IOrderExecutor. Per-exchange simulation: Polymarket (binary fills), OKX spot (ticker-based), OKX perpetual (funding + liquidation simulation).

**Risk management**: Per-bot + optional cross-exchange aggregation. Universal limits (maxDailyLoss, maxDrawdown) + exchange-specific (maxLeverage, liquidationBuffer for OKX). Currency normalization to USDC equivalent for cross-exchange risk.

## Important Conventions

- All Redis Pub/Sub payloads include `exchange`, `engineId`, and `timestamp`
- All database models include `exchange` field with compound indexes
- Channel names defined as shared constants in `@polymarket/shared-types` (never hardcode strings)
- Credentials encrypted with AES-256-GCM (private keys, API keys, secrets, passphrases)
- Wallet-bot binding enforced: `wallet.exchange` must match `bot.exchange`
- Order status never goes backwards (use STATUS_ORDER map for comparison)
- Pub/Sub payloads must stay < 10KB; large data goes through BullMQ
- Use separate Redis connections for subscriber vs publisher vs cache
- Bot states: IDLE → STARTING → RUNNING → PAUSING/PAUSED → STOPPING → STOPPED, plus RISK_STOPPED and ERROR
- RBAC roles: admin (full), operator (manage bots/orders, exchange-scoped), viewer (read-only)
- CMS is exchange-agnostic: stores/relays data for all exchanges without exchange-specific business logic
- Currency normalization: all cross-exchange risk/PnL converted to USDC equivalent

## Documentation

Full architecture docs are in `docs/` organized by domain:
- `docs/00-overview.md` - System overview, decisions log, exchange support matrix
- `docs/01-trading-engine/` - All TE modules (exchange-abstraction, feed-manager, strategies, risk, paper trading, etc.)
- `docs/02-exchanges/` - Exchange-specific docs (registry, polymarket.md, okx.md)
- `docs/03-cms-backend/` - API routes, database schemas, RBAC, queue workers
- `docs/04-cms-frontend/` - Pages, exchange selector, realtime hooks
- `docs/05-communication/` - Redis Pub/Sub channels, BullMQ queues, WebSocket protocol
- `docs/06-infrastructure/` - Docker Compose, deployment, monitoring, security
- `docs/07-shared-types/` - All TypeScript interfaces (exchange-aware)
- `docs/08-implementation/` - Roadmap (8 weeks), verification checklist

## Tech Stack

| Service | Stack |
|---------|-------|
| Trading Engine | Node.js 20+, TypeScript, ioredis, bullmq, pino, prom-client, @polymarket/clob-client, OKX V5 API |
| CMS Backend | Fastify, Mongoose (MongoDB), Socket.IO, BullMQ workers, NextAuth-compatible JWT |
| CMS Frontend | Next.js 15, shadcn/ui, TanStack Query v5, TanStack Table, Recharts, Socket.IO Client, NextAuth.js v5 |
| Infrastructure | Docker Compose, Redis 7, MongoDB 7, Prometheus, Grafana, Caddy/nginx reverse proxy |
