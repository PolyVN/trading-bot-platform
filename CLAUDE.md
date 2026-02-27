# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-exchange event-driven trading bot system. Supports **Polymarket** (on-chain prediction markets) and **OKX** (spot/futures/perpetuals), extensible to more exchanges. Multi-repo architecture with 5 repositories, deployed as Docker services across 3 servers (optionally 4+ with dedicated TE per exchange). This repo is the root project containing architecture documentation and orchestration.

## Architecture (Docker Services, 5 Repos)

```
Trading Engine (Rust/tokio)        ──┐
  Polymarket + OKX adapters            ├── Database: MongoDB + Redis
CMS Backend (Fastify) +              │
CMS Frontend (Next.js 16)           ─┘
```

| Repo | Purpose |
|------|---------|
| `trading-shared-types` | JSON Schema (source of truth) → generated TypeScript (`@polyvn/shared-types`) + Rust (`polyvn-shared-types` crate) |
| `trading-engine` | Rust trading engine: bot execution, exchange adapters (polymarket-client-sdk, OKX), strategies, data feeds |
| `trading-cms-backend` | Fastify REST API, BullMQ workers, Socket.IO relay (exchange-agnostic, Node.js/TypeScript) |
| `trading-cms-frontend` | Next.js 16 dashboard with shadcn/ui, exchange selector, realtime via Socket.IO |
| `trading-docker` | Docker Compose per service (trading-engine, cms, database) |

## Multi-Exchange Architecture

**Exchange type**: `'polymarket' | 'okx'` (extensible union type)

**Exchange Abstraction Layer**: Core traits decouple trading logic from exchange specifics:
- `OrderExecutor` trait - place/cancel/amend orders
- `FeedProvider` trait - market data feeds (orderbook, ticker, trades, klines)
- `WalletAdapter` trait - credential management, balance queries
- `PositionAdapter` trait - position tracking (binary shares vs leveraged contracts)
- `ExchangeAdapter` - composite struct combining all above (trait objects)

**ExchangeRegistry**: Factory singleton that registers `ExchangeAdapterFactory` per exchange at startup. BotRunner creates per-bot adapter via `ExchangeRegistry::create_adapter(&bot_config)`.

| Aspect | Polymarket | OKX |
|--------|-----------|-----|
| Type | Prediction market (on-chain) | CEX (spot/futures/perp/options) |
| Auth | Proxy wallet + PK → CLOB creds | API Key + Secret + Passphrase |
| Currency | USDC only | Multi-currency (USDT, USDC, BTC...) |
| Leverage | No | 1x-125x |
| Resolution | Yes (UMA oracle, 48–72h dispute) | No (continuous), but futures expire |
| Jurisdiction | Global | Global |
| Order types | Limit, Market | Limit, Market, Stop, Trailing, TP/SL, Iceberg, TWAP |

## Communication Flow

- **Trading Engine → CMS Backend**: Redis Pub/Sub (realtime) + BullMQ-compatible job enqueue (persistent)
- **CMS Backend → Trading Engine**: Redis Pub/Sub with `{engineId}` routing
- **CMS Backend → CMS Frontend**: Socket.IO WebSocket + REST API
- **Persistence**: Only CMS Backend writes to MongoDB (via BullMQ workers). Trading Engine never touches DB directly. Rust TE enqueues jobs by replicating BullMQ's internal protocol via Lua script: `INCR` job ID → `HSET bull:{queueName}:{jobId}` (job data) → `LPUSH bull:{queueName}:wait` (FIFO enqueue) → `PUBLISH` (notify workers). CMS Backend BullMQ workers consume normally.
- **All payloads** include `engineId`, `exchange`, and `timestamp` (Unix epoch **milliseconds**). JSON serialized via `serde_json` on Rust side, parsed natively on Node.js side.

## Key Architectural Patterns

**Exchange abstraction**: All exchange-specific code lives in `src/exchanges/{exchange}/`. Core modules (BotRunner, FeedManager, RiskManager, StrategyContext) are exchange-agnostic and work through adapter traits.

**Event-driven trading engine**: Single process async (tokio runtime), each bot is a BotRunner instance with its own `CancellationToken`. Hybrid tick model: event-driven (`on_feed_update`) for fast reaction + periodic (`on_tick`) for maintenance. Uses `tokio::select!` for multiplexing feeds and cancellation.

**Shared data feeds (FeedManager)**: Singleton with `Arc` reference counting. Feed key format: `{exchange}:{feedType}:{params}`. Multiple bots on same feed share 1 WebSocket connection via `tokio-tungstenite`.

**Strategy system**: `Strategy` trait with `supported_exchanges() -> Vec<Exchange>`. Builtin strategies: Market Making, Signal-based, Arbitrage (cross-exchange), Grid Trading (OKX), Funding Rate Arb (OKX), DCA (OKX). Strategies are compiled into the engine binary; no hot-reload (recompile + restart for strategy changes).

**Multi-engine horizontal scaling**: Each TE instance has unique `engine_id` + `supported_exchanges`. Engines can specialize per exchange or handle multiple.

**Paper trading**: PaperExecutor wraps any exchange's `OrderExecutor` trait. Per-exchange simulation: Polymarket (binary fills), OKX spot (ticker-based), OKX perpetual (funding + liquidation simulation).

**Risk management**: Per-bot + optional cross-exchange aggregation. Universal limits (max_daily_loss, max_drawdown) + exchange-specific (max_leverage, liquidation_buffer for OKX). Currency normalization to USDC equivalent for cross-exchange risk.

## Important Conventions

- All Redis Pub/Sub payloads include `engineId`, `exchange`, and `timestamp` (camelCase in JSON; Rust uses `#[serde(rename_all = "camelCase")]`)
- All database models include `exchange` field with compound indexes
- Channel names defined as shared constants in JSON Schema package (never hardcode strings); Rust uses generated const definitions, TypeScript uses generated const objects
- Credentials encrypted with AES-256-GCM (`aes-gcm` crate in Rust, `crypto` module in Node.js)
- Wallet-bot binding enforced: `wallet.exchange` must match `bot.exchange`
- Order status never goes backwards (use `STATUS_ORDER` map for comparison)
- Pub/Sub payloads must stay < 10KB; large data goes through BullMQ jobs (persistent queue)
- Use separate Redis connections for subscriber vs publisher vs cache (`deadpool-redis` pools in Rust)
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
- `docs/07-shared-types/` - JSON Schema (source of truth) + codegen to TypeScript/Rust
- `docs/08-implementation/` - Roadmap (10 weeks), verification checklist

## Tech Stack

| Service | Stack |
|---------|-------|
| Trading Engine | **Rust 2024 edition** (MSRV 1.85): tokio 1.49, serde 1.0, reqwest 0.13, redis 1.0 + deadpool-redis 0.23, tokio-tungstenite 0.28, tracing 0.1 + tracing-subscriber 0.3, prometheus-client 0.24, aes-gcm 0.10, rust_decimal 1.40, axum 0.8, chrono 0.4, anyhow 1.0, thiserror 2.0, polymarket-client-sdk |
| Shared Types | **JSON Schema** (source of truth) → codegen to TypeScript (`json-schema-to-typescript 15.0`) + Rust (`typify 0.6`) |
| CMS Backend | **Node.js 22 LTS** / TypeScript 5.9: Fastify 5.7, Mongoose 9.2, Socket.IO 4.8, BullMQ 5.70, ioredis 5.9, Zod 4.3, Pino 10.3, prom-client 15.1, decimal.js 10.6, NextAuth-compatible JWT |
| CMS Frontend | **Next.js 16** / React 19.2: shadcn/ui (latest), Tailwind CSS 4.2, TanStack Query 5.90, TanStack Table 8.21, Recharts 3.7, Socket.IO Client 4.8, NextAuth.js 4.24, react-hook-form 7.71, nuqs 2.8, sonner 2.0 |
| Infrastructure | Docker Compose v2, Redis 7.4, MongoDB 8.0, Prometheus 3.x, Grafana 11.x, Caddy 2.9 |
