# =============================================================================
# Trading Engine — Multi-stage build
# Build: rust:1.85 → Runtime: debian:bookworm-slim (~30MB final)
# =============================================================================

# --- Build stage ---
FROM rust:1.85-bookworm AS builder

WORKDIR /app

# Cache dependencies: copy manifests first
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src

# Build actual source
COPY . .
RUN touch src/main.rs && cargo build --release

# --- Runtime stage ---
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/trading-engine /usr/local/bin/trading-engine

EXPOSE 3010

ENTRYPOINT ["trading-engine"]
