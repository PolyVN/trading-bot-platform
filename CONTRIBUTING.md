# Contributing

## Project Structure

This is a multi-repo project. See [docs/00-overview.md](docs/00-overview.md) for full architecture.

| Repo | Purpose |
|------|---------|
| `polymarket-trading-engine` | Trading engine, exchange adapters, strategies |
| `polymarket-cms-backend` | REST API, queue workers, Socket.IO relay |
| `polymarket-cms-frontend` | Next.js dashboard |
| `polymarket-shared-types` | Shared TypeScript interfaces (`@polymarket/shared-types`) |
| `polymarket-docker` | Docker Compose per VPS |

## Development Setup

1. Clone all repos into the same parent directory
2. Start MongoDB + Redis locally (or use `polymarket-docker/vps3-database`)
3. Install dependencies in each repo: `npm install`
4. Run each service in dev mode: `npm run dev`

## Code Conventions

- **TypeScript** for all services (strict mode)
- **Pino** for structured JSON logging
- **Zod** for API request validation
- **Vitest** for unit/integration tests
- Shared types go in `@polymarket/shared-types` (never duplicate interfaces across repos)
- Redis channel names defined as constants (never hardcode strings)
- All credentials encrypted with AES-256-GCM

## Adding a New Exchange

1. Create adapter directory: `src/exchanges/{exchange}/`
2. Implement interfaces: `IOrderExecutor`, `IFeedProvider`, `IWalletAdapter`, `IPositionAdapter`
3. Register in `ExchangeRegistry` at engine startup
4. Add exchange-specific docs in `docs/02-exchanges/{exchange}.md`
5. Update shared types: add to `Exchange` union type
6. CMS auto-discovers via engine registration (no CMS changes needed for basic support)

See [Exchange Abstraction](docs/01-trading-engine/exchange-abstraction.md) and [Exchange Registry](docs/02-exchanges/exchange-registry.md) for details.

## Adding a New Strategy

1. Create strategy in `src/strategies/builtin/{name}/index.ts`
2. Extend `BaseStrategy` abstract class
3. Define `supportedExchanges`, `configSchema` (JSON Schema for CMS form)
4. Register in `StrategyRegistry`
5. Or: place in `plugins/` directory for hot-reload without engine restart

See [Strategies](docs/01-trading-engine/strategies.md) for details.

## Commit Messages

Use concise messages describing the change. Examples:
- `Add OKX perpetual feed provider`
- `Fix risk manager daily loss reset at UTC midnight`
- `Update CMS bot detail page for multi-exchange`

## Pull Requests

- Keep PRs focused on a single change
- Include context on what and why
- Reference relevant docs if the PR touches architecture
