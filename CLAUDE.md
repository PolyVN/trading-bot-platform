# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is the **architecture documentation repository** for the Polymarket Trading Bot System. It contains 32 design docs covering a multi-repo system (5 repos, 3 services, 3 VPS deployment). No source code exists yet — the docs serve as the implementation blueprint.

## Documentation Structure

```
docs/
├── 00-overview.md                     # System architecture, decisions log, communication flow
├── 01-trading-engine/                 # 12 files: core modules, strategies, feeds, execution, risk
├── 02-cms-backend/                    # 5 files: API routes, DB schemas, RBAC, queues, websocket
├── 03-cms-frontend/                   # 3 files: architecture, pages, realtime hooks
├── 04-communication/                  # 3 files: Redis Pub/Sub, BullMQ, WebSocket protocol
├── 05-infrastructure/                 # 4 files: Docker, deployment, monitoring, security
├── 06-shared-types/                   # 1 file: all TypeScript interfaces
└── 07-implementation/                 # 2 files: roadmap (5 phases), verification checklist
```

## System Architecture (Summary)

**3 services across 3 VPS** connected via private network:
- **VPS 1 - Trading Engine** (Node.js/TypeScript): Bot execution, order management, risk, feeds
- **VPS 2 - CMS** (Fastify backend + Next.js 15 frontend): Dashboard, API, BullMQ workers
- **VPS 3 - Database** (MongoDB + Redis): Shared data layer, Pub/Sub, queues

**Communication**: TE ↔ CMS via Redis Pub/Sub (realtime events) + BullMQ (persistence jobs). CMS Backend ↔ Frontend via Socket.IO + REST API.

**5 repos**: `polymarket-shared-types`, `polymarket-trading-engine`, `polymarket-cms-backend`, `polymarket-cms-frontend`, `polymarket-docker`

## Key Technical Decisions

- **Decimal precision**: `decimal.js` for all monetary values, stored as strings in DB
- **Events**: TypedEventEmitter (internal), Redis Pub/Sub (inter-service)
- **Errors**: `PolyError` hierarchy, never plain `Error`
- **Logging**: Pino structured JSON, never `console.log`
- **Strategies**: Plugin-based with hot-reload (dynamic import)
- **Paper trading**: Default ON for safety
- **Risk management**: Fail-closed (if risk check errors, reject the order)
- **Feed sharing**: FeedManager singleton with reference counting
- **Bot model**: Hybrid tick (event-driven + periodic maintenance)
- **Market data cache**: 3-tier (Hot: in-memory, Warm: Redis TTL, Cold: MongoDB permanent)

## Documentation Conventions

- All docs are in **English only** (no Vietnamese mixing)
- Edge cases follow the format: **Scenario → Impact → Solution** with TypeScript code examples
- Every module doc includes an "Edge Cases & Error Handling" section
- Interface definitions use TypeScript notation
- Architecture diagrams use ASCII art

## Working With These Docs

| Task | Start reading |
|------|--------------|
| Understand the full system | `docs/00-overview.md` |
| Trading Engine internals | `docs/01-trading-engine/architecture.md` |
| Database schemas & API | `docs/02-cms-backend/database-schemas.md`, `api-routes.md` |
| Frontend pages & realtime | `docs/03-cms-frontend/pages.md`, `realtime.md` |
| Inter-service communication | `docs/04-communication/redis-pubsub.md` |
| Deployment & Docker | `docs/05-infrastructure/docker-compose.md` |
| All TypeScript interfaces | `docs/06-shared-types/type-definitions.md` |
| Implementation plan | `docs/07-implementation/roadmap.md` |

## Autonomy Rules

- Fix typos, formatting issues, and broken cross-references in docs immediately.
- When adding new docs, follow existing structure: overview section, interface definitions, edge cases section.
- Prioritize: safety (paper trade defaults) > correctness (decimal precision) > observability (logging/metrics).
