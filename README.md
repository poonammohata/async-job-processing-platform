# Async Job Processing Platform

A scalable asynchronous job processing platform built with Node.js, TypeScript, and NestJS. Clients submit jobs through a REST API; work is persisted in PostgreSQL, queued in Redis via BullMQ, and processed by a separate worker process with automatic retries and operational visibility.

The design draws lightweight inspiration from concepts found in **AWS SQS**, **BullMQ**, and **Sidekiq**. External delivery (email, SMS, notifications) is **simulated** by logging payloads — the focus is queue mechanics, durability, and observability.

---

## Current Implementation Status

| Area | Status |
| ---- | ------ |
| Project workspace and NestJS scaffold | Initialized |
| Architecture design | Documented |
| API contract documentation | Documented |
| Prisma schema and initial migration | Implemented |
| Prisma module | Implemented |
| PostgreSQL and Redis development infrastructure | Implemented |
| Queue producer | Not implemented |
| Worker | Not implemented |
| Mandatory APIs | Not implemented |
| Bonus features | Not implemented |
| Bootstrap unit tests | Implemented |
| Platform integration tests | Not implemented |
| Docker Compose full application startup | Not implemented |

The repository contains a NestJS API scaffold under `apps/api` and local PostgreSQL/Redis via Docker Compose. Application containers, job APIs, and worker processing are **not yet built**.

---

## Features

### Mandatory features

- Submit jobs via REST API
- Persist job metadata in PostgreSQL
- Automatic asynchronous processing via BullMQ worker
- Simulated execution (payload logging)
- Lifecycle states: queued, processing, completed, failed
- Automatic retries with exponential backoff (3 total attempts)
- Get single job; list jobs with pagination, status filter, and sort
- Request validation (type, priority, payload)
- Structured lifecycle logging
- Docker Compose startup (planned)
- Architecture and API documentation

### Planned bonus features (initial implementation target)

- Priority queue (`high`, `normal`, `low`)
- Delayed and scheduled jobs
- Dead-letter visibility (PostgreSQL-backed view; dedicated BullMQ DLQ planned as future enhancement)
- Worker heartbeat
- Multiple workers
- Job cancellation (pre-processing)
- Queue pause and resume
- Health and metrics endpoints
- Swagger / OpenAPI
- Unit and integration tests
- Graceful shutdown

### Lower-priority optional features

- JWT authentication
- Rate limiting
- Optional web dashboard (`apps/web`)

---

## Tech Stack

| Technology | Role |
| ---------- | ---- |
| **Node.js** | Runtime |
| **TypeScript** | Type-safe application code |
| **NestJS** | API and worker application framework |
| **PostgreSQL** | Durable job and attempt storage |
| **Prisma** | ORM, schema, and migrations |
| **Redis** | BullMQ backend and worker heartbeat |
| **BullMQ** | Queue, retries, priority, delay, pause |
| **Docker Compose** | Local PostgreSQL and Redis (application containers planned) |
| **Swagger** | Interactive API docs (planned) |
| **Jest** | Unit and integration testing (planned) |

---

## Architecture

```mermaid
flowchart LR
    Client[Client] --> API[NestJS API]
    API --> PG[(PostgreSQL)]
    API --> BQ[BullMQ / Redis]
    Worker[NestJS Worker] --> BQ
    Worker --> PG
    API --> PG
```

- The **API** validates requests, writes to PostgreSQL, and enqueues jobs. It does **not** run long-running work.
- The **worker** consumes from BullMQ, simulates processing, and updates PostgreSQL.
- **PostgreSQL** is the durable source of truth for job history and queries.
- **Redis/BullMQ** manages queue state, retries, and delays.

Full design, lifecycle diagrams, and ADRs: **[docs/DESIGN.md](./docs/DESIGN.md)**

---

## Repository Structure

```text
async-job-processing-platform/
├── apps/
│   └── api/                 # NestJS API and worker source
│       ├── prisma/          # Schema and migrations
│       │   ├── schema.prisma
│       │   └── migrations/
│       └── src/
│           └── prisma/      # PrismaModule and PrismaService
├── docs/
│   ├── DESIGN.md            # System design and ADRs
│   └── API.md               # Planned API contracts
├── docker-compose.yml       # Local PostgreSQL and Redis
├── package.json             # Root workspace config
└── README.md
```

**Not yet present:** `apps/web/`

---

## Prerequisites

Planned development prerequisites:

- **Node.js** — use an LTS release compatible with NestJS 11 (exact `engines` field to be added during implementation)
- **npm** — package management (workspaces enabled)
- **Docker** — container runtime
- **Docker Compose** — multi-service local startup
- **Git** — version control

---

## Environment Configuration

1. Copy `apps/api/.env.example` to `apps/api/.env`.
2. **Never commit `.env`** — it is listed in `.gitignore`.

| Context | Hostnames |
| ------- | --------- |
| Local processes (outside Docker) | `localhost` for PostgreSQL and Redis |
| Docker Compose services | Service names such as `postgres` and `redis` |

### Planned environment variables

Operational values below are **environment-configurable defaults** (exact names subject to implementation):

| Variable | Description |
| -------- | ----------- |
| `PORT` | API HTTP port (default `3000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` | Redis hostname |
| `REDIS_PORT` | Redis port |
| `QUEUE_NAME` | BullMQ queue name |
| `MAX_JOB_ATTEMPTS` | Total attempts (default `3`) |
| `JOB_BACKOFF_DELAY_MS` | Initial exponential backoff in ms (default `1000`) |
| `WORKER_CONCURRENCY` | Parallel jobs per worker (default `1`) |
| `WORKER_HEARTBEAT_INTERVAL_MS` | Heartbeat refresh interval in ms (default `5000`) |
| `WORKER_HEARTBEAT_TTL_MS` | Heartbeat stale threshold in ms (default `15000`) |

---

## Running Locally

1. Install dependencies: `npm install`
2. Start PostgreSQL and Redis:

```bash
npm run infra:up
```

3. Copy `apps/api/.env.example` to `apps/api/.env`
4. Start API: `npm run dev:api`

Additional steps (Prisma migrations, worker) are planned and not yet implemented.

Useful infrastructure commands:

```bash
npm run infra:down    # stop containers
npm run infra:logs    # follow postgres and redis logs
npm run infra:reset   # stop containers and remove volumes
```

---

## Running with Docker

Docker Compose currently starts **PostgreSQL and Redis only**:

```bash
npm run infra:up
```

| Service | Host port | Purpose |
| ------- | --------- | ------- |
| **postgres** | 5432 | Durable storage (`jobs_db`) |
| **redis** | 6379 | Queue backend (future BullMQ) |

Full platform startup (`api`, `worker`, migrations) via `docker compose up --build` remains **planned** and is not implemented yet.

---

## Database Migrations

Prisma schema lives in `apps/api/prisma/`. Start PostgreSQL first:

```bash
npm run infra:up
```

Common commands from the repository root:

```bash
npm exec --workspace=apps/api -- prisma validate
npm exec --workspace=apps/api -- prisma format
npm exec --workspace=apps/api -- prisma generate
npm exec --workspace=apps/api -- prisma migrate dev -- --name <migration_name>
npm exec --workspace=apps/api -- prisma migrate deploy
npm exec --workspace=apps/api -- prisma migrate status
```

Or from `apps/api`:

```bash
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
```

Set `DATABASE_URL` in `apps/api/.env` (see `apps/api/.env.example`). Commit migration SQL files under `apps/api/prisma/migrations/`.

`prisma db push` is **not** used for deployment.

---

## API Documentation

| Resource | Location |
| -------- | -------- |
| Planned REST contracts | [docs/API.md](./docs/API.md) |
| Swagger UI (planned) | `http://localhost:3000/api/docs` |

Swagger is **not yet available**.

---

## Testing

Planned test categories (not yet implemented):

| Category | Scope |
| -------- | ----- |
| Unit tests | Validation, repositories, state transitions, metrics |
| Integration tests | API + DB + queue + worker flows |
| End-to-end lifecycle | Submit → process → complete / fail / retry |
| Docker smoke test | `docker compose up` and basic job submission |

Planned commands (subject to implementation):

```bash
npm run test:api          # unit tests
npm run test:e2e --workspace=apps/api   # integration/e2e
```

Platform-specific unit and integration tests are not yet implemented.

---

## Design Decisions

Architecture trade-offs and ADRs: **[docs/DESIGN.md#architecture-decision-records](./docs/DESIGN.md#architecture-decision-records)**

Endpoint contracts: **[docs/API.md](./docs/API.md)**

---

## Assumptions

See [docs/DESIGN.md — Assumptions](./docs/DESIGN.md#assumptions) for the full list. Key points: three total attempts, exponential backoff from 1000 ms, priorities `high` / `normal` / `low`, and `queueLength` = waiting jobs only.

---

## Known Limitations

Initial scope uses simulated processing, a PostgreSQL dead-letter view (not a separate queue), and no transactional outbox. See [docs/DESIGN.md — Known Limitations](./docs/DESIGN.md#known-limitations).

---

## Future Improvements

See [docs/DESIGN.md — Future Improvements](./docs/DESIGN.md#future-improvements). Planned production enhancements include transactional outbox, dedicated DLQ, idempotency keys, Prometheus metrics, and optional JWT/dashboard.

---

## Submission Checklist

- [x] GitHub repository
- [x] README
- [x] Architecture documentation (`docs/DESIGN.md`)
- [x] API contract documentation (`docs/API.md`)
- [ ] Swagger or Postman collection
- [ ] Docker Compose
- [x] Database schema
- [x] Migration files
- [x] `.env.example` (`apps/api/.env.example`)
- [ ] Mandatory APIs
- [ ] Worker
- [ ] Retry handling
- [ ] Validation
- [ ] Logging
- [ ] Unit tests
- [ ] Integration tests
- [ ] Clean Docker startup

---

## License

Private / UNLICENSED (see `apps/api/package.json`).
