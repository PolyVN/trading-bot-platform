# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-exchange event-driven trading bot system. Supports **Polymarket** (on-chain prediction markets), **OKX** (spot/futures/perpetuals), and **Kalshi** (CFTC-regulated prediction markets), extensible to more exchanges. Multi-repo architecture with 5 repositories, 3-4 VPS deployment. This repo is the root project containing architecture documentation and orchestration.

## Architecture (3-4 VPS, 5 Repos)

```
VPS 1: TE Polymarket (Rust/tokio) ──┐
VPS 4: TE OKX (Rust/tokio)         ├── VPS 3: MongoDB + Redis
  (or co-located on VPS 1)          │
VPS 2: CMS Backend (Fastify) +     ─┘
       CMS Frontend (Next.js 15)
```

| Repo | Purpose |
|------|---------|
| `trading-shared-types` | JSON Schema (source of truth) → generated TypeScript (`@polyvn/shared-types`) + Rust (`polyvn-shared-types` crate) |
| `trading-engine` | Rust trading engine: bot execution, exchange adapters (polymarket-client-sdk, OKX, Kalshi), strategies, data feeds |
| `trading-cms-backend` | Fastify REST API, BullMQ workers, Socket.IO relay (exchange-agnostic, Node.js/TypeScript) |
| `trading-cms-frontend` | Next.js 15 dashboard with shadcn/ui, exchange selector, realtime via Socket.IO |
| `trading-docker` | Docker Compose per VPS (vps1-trading, vps2-cms, vps3-database, vps4-okx) |

## Multi-Exchange Architecture

**Exchange type**: `'polymarket' | 'okx' | 'kalshi'` (extensible union type)

**Exchange Abstraction Layer**: Core traits decouple trading logic from exchange specifics:
- `OrderExecutor` trait - place/cancel/amend orders
- `FeedProvider` trait - market data feeds (orderbook, ticker, trades, klines)
- `WalletAdapter` trait - credential management, balance queries
- `PositionAdapter` trait - position tracking (binary shares vs leveraged contracts)
- `ExchangeAdapter` - composite struct combining all above (trait objects)

**ExchangeRegistry**: Factory singleton that registers exchange adapters at startup. BotRunner resolves adapter via `ExchangeRegistry::get_adapter(bot.exchange)`.

| Aspect | Polymarket | OKX | Kalshi |
|--------|-----------|-----|--------|
| Type | Prediction market (on-chain) | CEX (spot/futures/perp/options) | Prediction market (CFTC-regulated) |
| Auth | Proxy wallet + PK → CLOB creds | API Key + Secret + Passphrase | API Key (RSA sign) or session token |
| Currency | USDC only | Multi-currency (USDT, USDC, BTC...) | USD only (ACH) |
| Leverage | No | 1x-125x | No |
| Resolution | Yes (UMA oracle, 48–72h dispute) | No (continuous), but futures expire | Yes (Kalshi direct, no dispute) |
| Jurisdiction | Global | Global | US only (KYC required) |
| Order types | Limit, Market | Limit, Market, Stop, Trailing, TP/SL, Iceberg, TWAP | Limit, Market |
| Primary arb use | Cross-market (vs Kalshi) | Cross-exchange (vs Polymarket) | Cross-market (vs Polymarket) |

## Communication Flow

- **Trading Engine → CMS Backend**: Redis Pub/Sub (realtime) + Redis Streams in BullMQ-compatible format (persistent)
- **CMS Backend → Trading Engine**: Redis Pub/Sub with `{engineId}` routing
- **CMS Backend → CMS Frontend**: Socket.IO WebSocket + REST API
- **Persistence**: Only CMS Backend writes to MongoDB (via BullMQ workers). Trading Engine never touches DB directly. Rust TE writes jobs to Redis Streams using BullMQ's internal key format (`bull:{queueName}:wait` + XADD); CMS Backend BullMQ workers consume normally.
- **All payloads** include `exchange`, `engineId`, and `timestamp` fields. JSON serialized via `serde_json` on Rust side, parsed natively on Node.js side.

## Key Architectural Patterns

**Exchange abstraction**: All exchange-specific code lives in `src/exchanges/{exchange}/`. Core modules (BotRunner, FeedManager, RiskManager, StrategyContext) are exchange-agnostic and work through adapter traits.

**Event-driven trading engine**: Single process async (tokio runtime), each bot is a BotRunner instance with its own `CancellationToken`. Hybrid tick model: event-driven (`on_feed_update`) for fast reaction + periodic (`on_tick`) for maintenance. Uses `tokio::select!` for multiplexing feeds and cancellation.

**Shared data feeds (FeedManager)**: Singleton with `Arc` reference counting. Feed key format: `{exchange}:{feedType}:{params}`. Multiple bots on same feed share 1 WebSocket connection via `tokio-tungstenite`.

**Strategy system**: `Strategy` trait with `supported_exchanges() -> Vec<Exchange>`. Builtin strategies: Market Making, Signal-based, Arbitrage (cross-exchange), Grid Trading (OKX), Funding Rate Arb (OKX), DCA (OKX). Strategies are compiled into the engine binary; no hot-reload (recompile + restart for strategy changes).

**Multi-engine horizontal scaling**: Each TE instance has unique `engine_id` + `supported_exchanges`. Engines can specialize per exchange or handle multiple.

**Paper trading**: PaperExecutor wraps any exchange's `OrderExecutor` trait. Per-exchange simulation: Polymarket (binary fills), OKX spot (ticker-based), OKX perpetual (funding + liquidation simulation).

**Risk management**: Per-bot + optional cross-exchange aggregation. Universal limits (max_daily_loss, max_drawdown) + exchange-specific (max_leverage, liquidation_buffer for OKX). Currency normalization to USDC equivalent for cross-exchange risk.

## Important Conventions

- All Redis Pub/Sub payloads include `exchange`, `engine_id`, and `timestamp`
- All database models include `exchange` field with compound indexes
- Channel names defined as shared constants in JSON Schema package (never hardcode strings); Rust uses generated const definitions, TypeScript uses generated const objects
- Credentials encrypted with AES-256-GCM (`aes-gcm` crate in Rust, `crypto` module in Node.js)
- Wallet-bot binding enforced: `wallet.exchange` must match `bot.exchange`
- Order status never goes backwards (use `STATUS_ORDER` map for comparison)
- Pub/Sub payloads must stay < 10KB; large data goes through Redis Streams (BullMQ-compatible)
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
| Trading Engine | **Rust** (tokio async runtime), polymarket-client-sdk, redis-rs + deadpool-redis, tokio-tungstenite, serde/serde_json, tracing + tracing-subscriber, prometheus-client, aes-gcm, rust_decimal, reqwest |
| Shared Types | **JSON Schema** (source of truth) → codegen to TypeScript (`json-schema-to-typescript`) + Rust (`typify` / `schemafy`) |
| CMS Backend | Node.js/TypeScript: Fastify, Mongoose (MongoDB), Socket.IO, BullMQ workers, NextAuth-compatible JWT |
| CMS Frontend | Next.js 15, shadcn/ui, TanStack Query v5, TanStack Table, Recharts, Socket.IO Client, NextAuth.js v5 |
| Infrastructure | Docker Compose, Redis 7, MongoDB 7, Prometheus, Grafana, Caddy/nginx reverse proxy |
