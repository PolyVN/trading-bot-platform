# Contributing

## Project Structure

This is a multi-repo project. See [docs/00-overview.md](docs/00-overview.md) for full architecture.

| Repo | Language | Purpose |
|------|----------|---------|
| `trading-engine` | **Rust** | Trading engine, exchange adapters, strategies |
| `trading-cms-backend` | TypeScript | REST API, queue workers, Socket.IO relay |
| `trading-cms-frontend` | TypeScript | Next.js dashboard |
| `trading-shared-types` | JSON Schema | Source of truth → codegen to TypeScript (`@polyvn/shared-types`) + Rust (`polyvn-shared-types`) |
| `trading-docker` | YAML | Docker Compose per VPS |

## Development Setup

1. Clone all repos into the same parent directory
2. Start MongoDB + Redis locally (or use `trading-docker/vps3-database`)
3. **Trading Engine (Rust)**:
   - Install Rust toolchain: `rustup install stable`
   - Build: `cd trading-engine && cargo build`
   - Run: `cargo run` (or `cargo run --release` for optimized)
   - Test: `cargo test`
4. **Shared Types**:
   - `cd trading-shared-types && npm install && npm run generate`
   - Generates TypeScript (`dist/`) and Rust (`generated/`) types from JSON Schema
5. **CMS Backend/Frontend (Node.js)**:
   - `npm install && npm run dev` in each repo

## Code Conventions

### Trading Engine (Rust)
- **Rust 2021 edition**, async with `tokio`
- **`tracing`** for structured JSON logging (`tracing-subscriber` with JSON formatter)
- **`serde`** + `serde_json` for serialization (all Redis payloads)
- **`rust_decimal`** for precise financial calculations (never use `f64` for money)
- Naming: `snake_case` for fields/functions, `PascalCase` for types/traits
- Error handling: `thiserror` for library errors, `anyhow` for application-level
- Tests: built-in `#[cfg(test)]` modules + integration tests in `tests/`

### CMS Backend/Frontend (TypeScript)
- **TypeScript** strict mode
- **Pino** for structured JSON logging
- **Zod** for API request validation
- **Vitest** for unit/integration tests

### Cross-language
- Shared types defined as JSON Schema in `trading-shared-types` (never duplicate across repos)
- Redis channel names defined as constants (codegen'd from JSON Schema)
- All credentials encrypted with AES-256-GCM (`aes-gcm` crate in Rust, `crypto` in Node.js)

## Adding a New Exchange

1. Create adapter module: `src/exchanges/{exchange}/`
2. Implement traits: `OrderExecutor`, `FeedProvider`, `WalletAdapter`, `PositionAdapter`
3. Register in `ExchangeRegistry` at engine startup
4. Add exchange-specific docs in `docs/02-exchanges/{exchange}.md`
5. Update shared types: add to `Exchange` enum in JSON Schema, re-run codegen
6. CMS auto-discovers via engine registration (no CMS changes needed for basic support)

See [Exchange Abstraction](docs/01-trading-engine/exchange-abstraction.md) and [Exchange Registry](docs/02-exchanges/exchange-registry.md) for details.

## Adding a New Strategy

1. Create strategy module in `src/strategies/builtin/{name}/mod.rs`
2. Implement `Strategy` trait
3. Define `supported_exchanges()`, `config_schema()` (JSON Schema for CMS form)
4. Register in `StrategyRegistry`
5. Recompile engine: `cargo build --release`

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
