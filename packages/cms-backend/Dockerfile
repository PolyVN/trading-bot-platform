# =============================================================================
# CMS Backend — Multi-stage build
# Build: node:22-slim → Runtime: node:22-slim (~180MB final)
# =============================================================================

# --- Build stage ---
FROM node:22-slim AS builder

WORKDIR /app

# Cache dependencies: copy manifests first
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Build actual source
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# --- Production dependencies ---
FROM node:22-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# --- Runtime stage ---
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER node

EXPOSE 3001

CMD ["node", "dist/server.js"]
