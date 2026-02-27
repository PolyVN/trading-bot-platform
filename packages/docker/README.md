# trading-docker

Docker Compose configurations for deploying the trading bot platform to VPS / production.

For local development, see [`dev/README.md`](dev/README.md).

## Directory Structure

```
database/           MongoDB + Redis (+ Redis Sentinel HA overlay)
trading-engine/     TE Polymarket (Option A/B) + local Prometheus
trading-engine-okx/ TE OKX separate host (Option A)
cms/                CMS Backend + Frontend + Grafana + central Prometheus
dev/                Local development (see dev/README.md)
```

## Deployment

Each subdirectory deploys to a separate host. See [deployment guide](../../docs/06-infrastructure/deployment.md) for full setup.

### 1. Database Host

```bash
cd database
cp .env.example .env         # set MONGO_PASS, REDIS_PASSWORD
docker compose up -d
# Optional HA: docker compose -f docker-compose.yml -f docker-compose.ha.yml up -d
```

### 2. Trading Engine Host (Polymarket)

```bash
cd trading-engine
cp .env.example .env         # set DB_HOST, REDIS_PASSWORD, ENCRYPTION_KEY
docker compose up -d
docker compose --profile monitoring up -d   # + Prometheus
```

### 3. Trading Engine Host (OKX — Option A)

```bash
cd trading-engine-okx
cp .env.example .env
docker compose up -d
```

### 4. CMS Host

```bash
cd cms
cp .env.example .env         # set DB_HOST, MONGO_*, REDIS_PASSWORD, JWT_SECRET, etc.
docker compose up -d
```

## Deployment Options

| Option | Layout | Use Case |
|--------|--------|----------|
| A | 1 host per exchange | Production (resource isolation) |
| B | TEs co-located | Small deployments (fewer servers) |
| C | 1 host per strategy | Production (fault isolation per strategy) |

Option C: remove local Prometheus from TE hosts, use central Prometheus on CMS host. See `cms/prometheus.yml`.

## Port Map

| Port  | Service          | Host           |
|-------|------------------|----------------|
| 27017 | MongoDB          | Database       |
| 6379  | Redis            | Database       |
| 8081  | Redis Commander  | Database       |
| 3010  | Trading Engine   | TE             |
| 3001  | CMS Backend      | CMS            |
| 3000  | CMS Frontend     | CMS            |
| 9090  | Prometheus       | TE or CMS (C)  |
| 3002  | Grafana          | CMS            |
