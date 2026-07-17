# API Reference

This document describes the **implemented** REST API for the asynchronous job processing platform. Interactive OpenAPI documentation is available at `/api/docs` (JSON at `/api/docs-json`).

For architecture and behavior, see [DESIGN.md](./DESIGN.md).

---

## API-Wide Conventions

| Convention | Value |
| ---------- | ----- |
| Base path | `/api` |
| Content type | `application/json` |
| Identifiers | UUID v4 |
| Request enums | Uppercase (`EMAIL`, `HIGH`, …) |
| Response enums | Uppercase for job/attempt status and type/priority in GET responses |
| POST `/api/jobs` acknowledgement | Lowercase `"status": "queued"` |
| Timestamps | ISO 8601 UTC |
| Async submission success | `202 Accepted` |
| Read / control success | `200 OK` |
| Cancellation success | `204 No Content` |

### Authentication

Authentication is **not implemented**. All 10 API endpoints below are unauthenticated. JWT bearer tokens are a future optional enhancement.

### Pagination

List endpoints return:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "totalPages": 0
}
```

| Query param | Type | Default | Constraints |
| ----------- | ---- | ------- | ----------- |
| `page` | integer | `1` | Minimum `1` |
| `pageSize` | integer | `20` | Minimum `1`, maximum `100` |

### Error responses

NestJS standard format (no custom `code`, `details`, `timestamp`, or `path` fields):

```json
{
  "statusCode": 400,
  "message": ["priority must be one of the following values: HIGH, NORMAL, LOW"],
  "error": "Bad Request"
}
```

For single-message exceptions, `message` is a string:

```json
{
  "statusCode": 404,
  "message": "Job not found",
  "error": "Not Found"
}
```

### Standard HTTP status codes

| Status | Usage |
| ------ | ----- |
| `200 OK` | Successful read or queue control |
| `202 Accepted` | Job accepted for asynchronous processing |
| `204 No Content` | Successful cancellation |
| `400 Bad Request` | Validation or schedule errors |
| `404 Not Found` | Unknown job ID |
| `409 Conflict` | Job cannot be cancelled (wrong status or worker race) |
| `500 Internal Server Error` | Unexpected server failure |
| `503 Service Unavailable` | Critical dependency down (`GET /api/health` only when status is `down`) |

---

## Supported Job Types

| Type | Description |
| ---- | ----------- |
| `EMAIL` | Simulated email delivery |
| `SMS` | Simulated SMS delivery |
| `NOTIFICATION` | Simulated generic notification |

Priorities: `HIGH`, `NORMAL`, `LOW`.

Job statuses (GET responses): `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`.

---

## Endpoints Overview

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api` | API liveness |
| `POST` | `/api/jobs` | Submit a job |
| `GET` | `/api/jobs` | List jobs (summary) |
| `GET` | `/api/jobs/:id` | Get job detail with attempts |
| `DELETE` | `/api/jobs/:id` | Cancel a queued/delayed job |
| `GET` | `/api/dead-letter-jobs` | List permanently failed jobs |
| `POST` | `/api/queue/pause` | Pause queue consumption |
| `POST` | `/api/queue/resume` | Resume queue consumption |
| `GET` | `/api/health` | Dependency and liveness checks |
| `GET` | `/api/metrics` | Historical and live metrics |

The application exposes **10 API endpoints** (table above). Interactive documentation is also served at `/api/docs` (Swagger UI) and `/api/docs-json` (OpenAPI JSON); these are documentation paths, not job-processing API endpoints.

---

## GET /api

**200 OK**

```json
{
  "status": "ok",
  "service": "async-job-processing-api"
}
```

Used by Docker healthcheck and basic liveness probes.

---

## POST /api/jobs

Submit a new job. The API persists the job, enqueues it to BullMQ, and returns immediately.

### Request body

| Field | Type | Required | Allowed values | Description |
| ----- | ---- | -------- | -------------- | ----------- |
| `type` | string | Yes | `EMAIL`, `SMS`, `NOTIFICATION` | Job type |
| `priority` | string | Yes | `HIGH`, `NORMAL`, `LOW` | Processing priority among waiting jobs |
| `payload` | object | Yes | Non-null plain object | Job-specific JSON; `{}` is valid |
| `delay` | integer | No | `>= 0` | Delay in milliseconds before eligibility |
| `runAt` | string | No | Future ISO 8601 UTC | Scheduled execution time |

#### Cross-field rules

- `payload` must be a **non-null plain object** (not an array). Empty `{}` is valid.
- `priority` is **required** (no API default).
- `delay` and `runAt` are **mutually exclusive**.
- `runAt` must be a **future** timestamp.
- Unknown top-level properties are **rejected** (`forbidNonWhitelisted`).

#### Simulation fields (inside `payload`)

Optional fields evaluated by the worker during processing (not validated at the API layer):

| Field | Type | Behavior |
| ----- | ---- | -------- |
| `shouldFail` | boolean | When `true`, every attempt fails with a simulated permanent error |
| `failUntilAttempt` | integer | Attempts 1 through N fail; attempt N+1 succeeds |

If both are present, `shouldFail` is evaluated first and causes every attempt to fail.

Example with `failUntilAttempt: 2`: attempts 1 and 2 fail; attempt 3 succeeds (within the default max of 3 attempts).

### Success response — `202 Accepted`

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

Use `GET /api/jobs/:id` for full details after submission.

### Example

```json
{
  "type": "EMAIL",
  "priority": "NORMAL",
  "payload": {
    "to": "user@example.com",
    "subject": "Welcome",
    "body": "Hello"
  }
}
```

### Schedule error messages (`400`)

| Message | Cause |
| ------- | ----- |
| `delay and runAt cannot both be provided` | Both scheduling fields supplied |
| `runAt must be in the future` | Past or current `runAt` |
| `delay must not be less than 0` | Negative `delay` (class-validator `@Min(0)`) |

DTO validation also returns `400` with a string array `message` for other field errors (for example `payload must be a non-null object`, enum mismatches, unknown properties).

### Enqueue failure — `500 Internal Server Error`

If BullMQ enqueue fails after PostgreSQL write, the job is marked `FAILED` with `lastError: "Failed to enqueue job"` and the underlying error is rethrown as **500 Internal Server Error**.

---

## GET /api/jobs/:id

Retrieve full job details including payload and attempt history.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `id` | UUID | Job identifier |

### Success response — `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "EMAIL",
  "priority": "NORMAL",
  "status": "COMPLETED",
  "retryCount": 0,
  "maxAttempts": 3,
  "payload": {
    "to": "user@example.com",
    "subject": "Welcome"
  },
  "delayMs": null,
  "runAt": null,
  "createdAt": "2026-07-16T10:00:00.000Z",
  "startedAt": "2026-07-16T10:00:01.000Z",
  "completedAt": "2026-07-16T10:00:02.500Z",
  "failedAt": null,
  "cancelledAt": null,
  "lastError": null,
  "processingTimeMs": 1500,
  "updatedAt": "2026-07-16T10:00:02.500Z",
  "attempts": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "attemptNumber": 1,
      "status": "COMPLETED",
      "errorMessage": null,
      "startedAt": "2026-07-16T10:00:01.000Z",
      "completedAt": "2026-07-16T10:00:02.500Z",
      "processingTimeMs": 1500,
      "createdAt": "2026-07-16T10:00:01.000Z",
      "updatedAt": "2026-07-16T10:00:02.500Z"
    }
  ]
}
```

Attempts are ordered by `attemptNumber` ascending.

### Errors

| Status | Message (examples) |
| ------ | ------------------ |
| `400` | Invalid UUID format |
| `404` | `Job {uuid} not found` |

---

## GET /api/jobs

List jobs with pagination, filters, and sort. Returns **summary fields only** — no `payload`, `delayMs`, `runAt`, or `attempts`.

### Query parameters

| Name | Default | Allowed values | Description |
| ---- | ------- | -------------- | ----------- |
| `page` | `1` | `>= 1` | Page number |
| `pageSize` | `20` | `1`–`100` | Page size |
| `status` | — | `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` | Filter by status |
| `type` | — | `EMAIL`, `SMS`, `NOTIFICATION` | Filter by type |
| `priority` | — | `HIGH`, `NORMAL`, `LOW` | Filter by priority |
| `sortBy` | `createdAt` | `createdAt` | Sort field |
| `order` | `desc` | `asc`, `desc` | Sort direction |

### Success response — `200 OK`

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "EMAIL",
      "priority": "NORMAL",
      "status": "QUEUED",
      "retryCount": 0,
      "maxAttempts": 3,
      "createdAt": "2026-07-16T10:00:00.000Z",
      "startedAt": null,
      "completedAt": null,
      "failedAt": null,
      "cancelledAt": null,
      "lastError": null,
      "processingTimeMs": null,
      "updatedAt": "2026-07-16T10:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "totalPages": 1
}
```

---

## DELETE /api/jobs/:id

Cancel a job that has **not yet started processing**.

### Success — `204 No Content`

No response body.

### Rules

- Job must exist.
- Job status must be **`QUEUED`** (includes delayed/scheduled jobs not yet active).
- Jobs in `PROCESSING`, `COMPLETED`, `FAILED`, or `CANCELLED` cannot be cancelled.
- BullMQ removal happens **before** PostgreSQL is marked `CANCELLED`.
- Active processing is **not** interrupted.

### Errors

| Status | Message (examples) |
| ------ | ------------------ |
| `404` | `Job not found` |
| `409` | `Job cannot be cancelled in status: processing` |
| `409` | `Job has already started processing and cannot be cancelled` |

The second `409` indicates a cancellation race: the worker acquired the job before BullMQ removal succeeded.

---

## GET /api/dead-letter-jobs

List jobs that permanently failed after exhausting worker retries. Queries PostgreSQL — **not** a separate BullMQ dead-letter queue.

### Filter criteria (implicit)

- `status = FAILED`
- `retryCount > 0` (excludes enqueue failures where `retryCount = 0`)

### Query parameters

| Name | Default | Allowed values | Description |
| ---- | ------- | -------------- | ----------- |
| `page` | `1` | `>= 1` | Page number |
| `pageSize` | `20` | `1`–`100` | Page size |
| `type` | — | `EMAIL`, `SMS`, `NOTIFICATION` | Optional filter |
| `priority` | — | `HIGH`, `NORMAL`, `LOW` | Optional filter |
| `sortBy` | `failedAt` | `failedAt`, `createdAt` | Sort field |
| `order` | `desc` | `asc`, `desc` | Sort direction |

No `status` query parameter (unknown properties are rejected).

### Success response — `200 OK`

Same pagination shape as `GET /api/jobs`, with summary items only.

---

## POST /api/queue/pause

Pause assignment of **waiting** jobs to workers. Active jobs continue until completion.

### Success — `200 OK`

```json
{
  "status": "paused"
}
```

---

## POST /api/queue/resume

Resume assignment of waiting jobs after a pause.

### Success — `200 OK`

```json
{
  "status": "running"
}
```

---

## GET /api/health

Report API liveness, dependency connectivity, worker heartbeat, and live queue counts.

### Success — `200 OK` (status `ok` or `degraded`)

```json
{
  "status": "ok",
  "workerRunning": true,
  "database": "connected",
  "redis": "connected",
  "queue": {
    "waiting": 0,
    "active": 0,
    "delayed": 0,
    "completed": 0,
    "failed": 0
  }
}
```

### Status values

| `status` | HTTP | Condition |
| -------- | ---- | --------- |
| `ok` | 200 | PostgreSQL and Redis connected; worker heartbeat fresh |
| `degraded` | 200 | PostgreSQL and Redis connected; worker heartbeat stale or missing |
| `down` | **503** | PostgreSQL or Redis disconnected |

| Field | Values |
| ----- | ------ |
| `database`, `redis` | `connected`, `disconnected` |
| `workerRunning` | `true` if Redis key `worker:heartbeat` exists and age `< WORKER_HEARTBEAT_TTL_MS` |

If queue count retrieval fails, queue fields default to zero without changing overall status.

---

## GET /api/metrics

Historical processing metrics from PostgreSQL and live queue metrics from BullMQ.

### Success — `200 OK`

```json
{
  "jobsProcessed": 0,
  "completedJobs": 0,
  "failedJobs": 0,
  "queueLength": 0,
  "activeJobs": 0,
  "averageProcessingTimeMs": 0,
  "successRate": 0
}
```

### Metric definitions

| Metric | Source | Definition |
| ------ | ------ | ---------- |
| `completedJobs` | PostgreSQL | Count where `status = COMPLETED` |
| `failedJobs` | PostgreSQL | Count where `status = FAILED` |
| `jobsProcessed` | Derived | `completedJobs + failedJobs` |
| `queueLength` | BullMQ | Waiting jobs only |
| `activeJobs` | BullMQ | Currently processing |
| `averageProcessingTimeMs` | PostgreSQL | `AVG(processingTimeMs)` for completed jobs with non-null `processingTimeMs`; `0` when none |
| `successRate` | Derived | `(completedJobs / jobsProcessed) * 100`, rounded to 2 decimals; **`0`** when `jobsProcessed = 0` |

---

## Future API Enhancements

Not part of the current API:

- JWT authentication and authorization
- Rate limiting (`429`)
- `GET /api/queue/status` (pause state endpoint)
- Dedicated dead-letter queue replay endpoint
- Idempotency keys and correlation headers

---

## Related Documentation

- [System Design](./DESIGN.md) — architecture, lifecycle, ADRs
- [README](../README.md) — project overview and setup
