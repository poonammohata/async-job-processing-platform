# API Reference (Planned)

This document defines the **planned** REST API contracts for the asynchronous job processing platform. Endpoints described here are **not yet implemented** unless explicitly marked otherwise in release notes.

For architecture and behavior, see [DESIGN.md](./DESIGN.md).

---

## API-Wide Conventions

| Convention | Value |
| ---------- | ----- |
| Base path | `/api` |
| Content type | `application/json` |
| Identifiers | UUID v4 |
| Request enums | Lowercase (e.g., `high`, `queued`) |
| Response status enums | Lowercase in JSON (mapped from internal uppercase storage) |
| Timestamps | ISO 8601 UTC (e.g., `2026-07-16T10:00:00.000Z`) |
| Async submission success | `202 Accepted` |
| Read / control success | `200 OK` |
| Cancellation success | `204 No Content` (see [Cancellation rationale](#delete-apijobsid)) |

### Pagination

List endpoints use **page-based** pagination:

| Query param | Type | Default | Constraints |
| ----------- | ---- | ------- | ----------- |
| `page` | integer | `1` | Minimum `1` |
| `limit` | integer | `20` | Minimum `1`, maximum **`100`** |

Response envelope:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### Common Error Response

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    {
      "field": "priority",
      "message": "priority must be one of: high, normal, low"
    }
  ],
  "timestamp": "2026-07-16T10:00:00.000Z",
  "path": "/api/jobs"
}
```

### Standard HTTP Status Codes

| Status | Usage |
| ------ | ----- |
| `200 OK` | Successful read or queue control |
| `202 Accepted` | Job accepted for asynchronous processing |
| `204 No Content` | Successful cancellation (no body) |
| `400 Bad Request` | Validation errors |
| `404 Not Found` | Unknown job ID |
| `409 Conflict` | Invalid state transition (e.g., cancel active job) |
| `429 Too Many Requests` | Rate limit exceeded (optional, lower priority) |
| `500 Internal Server Error` | Unexpected server failure |
| `503 Service Unavailable` | Dependency or queue unavailable (e.g., enqueue failure) |

### Authentication

Authentication is **not required** in the initial implementation. **JWT bearer authentication** is planned as an optional bonus feature.

Optional future headers:

| Header | Purpose |
| ------ | ------- |
| `Authorization: Bearer <token>` | JWT authentication (bonus) |
| `X-Correlation-Id` | Request tracing (future) |
| `Idempotency-Key` | Duplicate submission protection (future) |

---

## Supported Job Types

| Type | Description |
| ---- | ----------- |
| `email` | Simulated email delivery |
| `sms` | Simulated SMS delivery |
| `notification` | Simulated generic notification |

---

## Endpoints Overview

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `POST` | `/api/jobs` | Submit a job |
| `GET` | `/api/jobs/:id` | Get one job |
| `GET` | `/api/jobs` | List jobs |
| `DELETE` | `/api/jobs/:id` | Cancel a queued/delayed job |
| `GET` | `/api/jobs/:id/attempts` | Get attempt history |
| `GET` | `/api/dead-letter-jobs` | List permanently failed jobs |
| `POST` | `/api/queue/pause` | Pause queue consumption |
| `POST` | `/api/queue/resume` | Resume queue consumption |
| `GET` | `/api/queue/status` | Queue pause state and counts |
| `GET` | `/api/health` | Dependency and liveness checks |
| `GET` | `/api/metrics` | Historical and live metrics |

---

## POST /api/jobs

### Purpose

Submit a new job for asynchronous processing. The API persists the job, enqueues it to BullMQ, and returns immediately with a job identifier.

### HTTP Method

`POST`

### Path

`/api/jobs`

### Authentication

Not required initially. JWT optional (bonus).

### Request Headers

| Header | Required | Description |
| ------ | -------- | ----------- |
| `Content-Type: application/json` | Yes | Request body must be JSON |

### Request Body

#### Example

```json
{
  "type": "email",
  "priority": "normal",
  "payload": {
    "to": "user@example.com",
    "subject": "Welcome",
    "body": "Hello"
  }
}
```

#### With delay

```json
{
  "type": "notification",
  "priority": "high",
  "delay": 5000,
  "payload": {
    "userId": "abc-123",
    "message": "Delayed alert"
  }
}
```

#### With scheduled run time

```json
{
  "type": "sms",
  "priority": "low",
  "runAt": "2026-07-20T10:30:00.000Z",
  "payload": {
    "phone": "+15551234567",
    "text": "Scheduled message"
  }
}
```

#### Field table

| Field | Type | Required | Default | Allowed values | Description |
| ----- | ---- | -------- | ------- | -------------- | ----------- |
| `type` | string | Yes | — | `email`, `sms`, `notification` | Job type |
| `priority` | string | No | `normal` | `high`, `normal`, `low` | Processing priority among waiting jobs |
| `payload` | object | Yes | — | Non-empty object | Job-specific JSON payload |
| `delay` | integer | No | `0` | `>= 0` | Delay in milliseconds before job becomes eligible |
| `runAt` | string (ISO 8601 UTC) | No | — | Future timestamp | Scheduled execution time |

#### Cross-field rules

- `payload` must be a **non-empty** object (at least one property).
- `type` must be a supported job type.
- `priority` defaults to `normal` when omitted.
- `delay` must be a non-negative integer.
- `runAt` must be a **future** ISO 8601 UTC timestamp.
- **`delay` and `runAt` are mutually exclusive** — supply at most one.
- Unknown top-level properties are **rejected**.

#### Simulation fields (inside `payload`)

For **development and testing only**. The worker inspects these optional fields to simulate failures.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `shouldFail` | boolean | When `true`, **every** processing attempt fails (permanent failure after retries are exhausted) |
| `failUntilAttempt` | integer | Attempts **1 through N** fail; the **next** attempt succeeds. Must be an integer from **1** to **maxAttempts − 1** (allowed values **`1`** or **`2`** when maxAttempts is **3**) |

**Mutually exclusive:** Supply at most one simulation field per request. Validation rejects requests whose `payload` contains both `shouldFail` and `failUntilAttempt`.

##### Permanent failure example (`shouldFail`)

```json
{
  "type": "email",
  "payload": {
    "to": "test@example.com",
    "subject": "Permanent failure test",
    "shouldFail": true
  }
}
```

##### Temporary failure example (`failUntilAttempt`)

```json
{
  "type": "email",
  "payload": {
    "to": "test@example.com",
    "subject": "Retry test",
    "failUntilAttempt": 2
  }
}
```

With `failUntilAttempt: 2`, attempts 1 and 2 fail; attempt 3 succeeds (within the three total attempts limit).

### Success Response

**HTTP `202 Accepted`**

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `jobId` | UUID | Job identifier (same as BullMQ job ID and `id` in GET responses) |
| `status` | string | Initial status: `queued` |

Use `GET /api/jobs/:id` to retrieve full job details after submission.

### Validation Rules

- Reject empty body, non-object body, or empty `payload`.
- Reject unsupported `type` or `priority`.
- Reject negative `delay`.
- Reject past or invalid `runAt`.
- Reject simultaneous `delay` and `runAt`.
- Reject `payload` containing both `shouldFail` and `failUntilAttempt`.
- Reject `failUntilAttempt` unless it is an integer from **1** to **maxAttempts − 1** ( **`1`** or **`2`** with the default maxAttempts of **3**).
- Strip or reject unknown top-level keys (reject recommended for strict validation).

### Error Responses

| Status | Code | Cause | Example |
| ------ | ---- | ----- | ------- |
| `400` | `VALIDATION_ERROR` | Invalid fields | See common error format |
| `400` | `UNSUPPORTED_JOB_TYPE` | Unknown `type` | `"type must be one of: email, sms, notification"` |
| `400` | `INVALID_SCHEDULE` | Past `runAt` or both delay and runAt | `"runAt must be a future timestamp"` |
| `400` | `INVALID_SIMULATION` | Both `shouldFail` and `failUntilAttempt` in payload | `"shouldFail and failUntilAttempt are mutually exclusive"` |
| `400` | `INVALID_SIMULATION` | `failUntilAttempt` not in `1`..(`maxAttempts − 1`) | `"failUntilAttempt must be between 1 and 2"` |
| `429` | `RATE_LIMIT_EXCEEDED` | Too many submissions (optional) | Rate limit headers when enabled |
| `503` | `QUEUE_UNAVAILABLE` | Redis/BullMQ enqueue failed after DB write | Job marked failed in DB; client may retry submission |
| `500` | `INTERNAL_ERROR` | Unexpected failure | Generic message, no stack trace |

#### Enqueue infrastructure failure example

```json
{
  "statusCode": 503,
  "code": "QUEUE_UNAVAILABLE",
  "message": "Job persisted but could not be enqueued",
  "details": [],
  "timestamp": "2026-07-16T10:00:01.000Z",
  "path": "/api/jobs"
}
```

### HTTP Status Codes

| Status | When |
| ------ | ---- |
| `202` | Job accepted and enqueued |
| `400` | Validation failure |
| `429` | Rate limited (optional) |
| `503` | Enqueue or dependency failure |
| `500` | Unexpected error |

---

## GET /api/jobs/:id

### Purpose

Retrieve the current summary, timestamps, and **complete stored payload** for a single job.

### HTTP Method

`GET`

### Path

`/api/jobs/:id`

### Authentication

Not required initially.

### Path Parameters

| Name | Type | Required | Description | Validation |
| ---- | ---- | -------- | ----------- | ---------- |
| `id` | UUID | Yes | Job identifier | Must be valid UUID format |

### Success Response

**HTTP `200 OK`**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "email",
  "priority": "normal",
  "status": "completed",
  "retryCount": 1,
  "maxAttempts": 3,
  "payload": {
    "to": "user@example.com",
    "subject": "Welcome"
  },
  "createdAt": "2026-07-16T10:00:00.000Z",
  "startedAt": "2026-07-16T10:00:01.000Z",
  "completedAt": "2026-07-16T10:00:02.500Z",
  "failedAt": null,
  "cancelledAt": null,
  "lastError": null,
  "processingTimeMs": 1500
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | UUID | Job identifier |
| `type` | string | Job type |
| `priority` | string | Priority |
| `status` | string | `queued`, `processing`, `completed`, `failed`, `cancelled` |
| `retryCount` | integer | Number of failed attempts |
| `maxAttempts` | integer | Total allowed attempts |
| `payload` | object | Stored job payload |
| `createdAt` | string | Created timestamp |
| `startedAt` | string \| null | First processing start |
| `completedAt` | string \| null | Completion timestamp |
| `failedAt` | string \| null | Terminal failure timestamp |
| `cancelledAt` | string \| null | Cancellation timestamp |
| `lastError` | string \| null | Most recent error message |
| `processingTimeMs` | integer \| null | Duration of successful run (ms) |

Nullable timestamp fields are `null` when not applicable.

### Error Responses

| Status | Code | Cause |
| ------ | ---- | ----- |
| `400` | `VALIDATION_ERROR` | Invalid UUID format |
| `404` | `JOB_NOT_FOUND` | No job with given ID |
| `500` | `INTERNAL_ERROR` | Unexpected failure |

### HTTP Status Codes

| Status | When |
| ------ | ---- |
| `200` | Job found |
| `400` | Invalid ID format |
| `404` | Job not found |
| `500` | Server error |

---

## GET /api/jobs

### Purpose

List jobs with pagination, optional filters, and sort order by creation time. Returns **summary fields only** — not the full stored payload.

### HTTP Method

`GET`

### Path

`/api/jobs`

### Authentication

Not required initially.

### Query Parameters

| Name | Type | Required | Default | Allowed values | Description |
| ---- | ---- | -------- | ------- | -------------- | ----------- |
| `page` | integer | No | `1` | `>= 1` | Page number |
| `limit` | integer | No | `20` | `1`–`100` | Page size |
| `status` | string | No | — | `queued`, `processing`, `completed`, `failed`, `cancelled` | Filter by status |
| `priority` | string | No | — | `high`, `normal`, `low` | Filter by priority |
| `type` | string | No | — | `email`, `sms`, `notification` | Filter by job type |
| `sortOrder` | string | No | `desc` | `asc`, `desc` | Sort by `createdAt` |

### Success Response

**HTTP `200 OK`**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "email",
      "priority": "normal",
      "status": "queued",
      "retryCount": 0,
      "maxAttempts": 3,
      "createdAt": "2026-07-16T10:00:00.000Z",
      "startedAt": null,
      "completedAt": null,
      "failedAt": null,
      "cancelledAt": null,
      "lastError": null,
      "processingTimeMs": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

List items include job summary fields only (`id`, `type`, `priority`, `status`, `retryCount`, `maxAttempts`, timestamps, `lastError`, `processingTimeMs`). The **`payload` is excluded**. Use `GET /api/jobs/:id` for the complete stored payload.

### Validation Rules

- Reject invalid enum values for `status`, `priority`, `type`, `sortOrder`.
- Reject `limit` > 100 or `page` < 1.

### Error Responses

| Status | Code | Cause |
| ------ | ---- | ----- |
| `400` | `VALIDATION_ERROR` | Invalid query parameters |
| `500` | `INTERNAL_ERROR` | Unexpected failure |

### HTTP Status Codes

| Status | When |
| ------ | ---- |
| `200` | Success (possibly empty list) |
| `400` | Invalid query |
| `500` | Server error |

---

## DELETE /api/jobs/:id

### Purpose

Cancel a job that has **not yet started processing**. Removes the job from BullMQ and marks it cancelled in PostgreSQL.

### HTTP Method

`DELETE`

### Path

`/api/jobs/:id`

### Authentication

Not required initially.

### Path Parameters

| Name | Type | Required | Description | Validation |
| ---- | ---- | -------- | ----------- | ---------- |
| `id` | UUID | Yes | Job identifier | Valid UUID |

### Request Body

None.

### Success Response

**HTTP `204 No Content`**

No response body.

#### Cancellation rationale

`204 No Content` is selected for successful DELETE operations per REST conventions: the resource is removed from active processing (cancelled), and no representation body is required. Clients can call `GET /jobs/:id` afterward to read the cancelled record.

### Validation Rules

- Job must exist.
- Job status must be **`queued`** (including delayed jobs not yet active).
- Jobs in **`processing`**, **`completed`**, or **`failed`** state cannot be cancelled.

### Processing flow

1. Read job from PostgreSQL.
2. Verify cancellable status.
3. Attempt BullMQ job removal by UUID.
4. On removal success → update PostgreSQL to `cancelled`.
5. On removal failure (worker acquired job) → return `409` without updating to cancelled.

### Error Responses

| Status | Code | Cause | Example message |
| ------ | ---- | ----- | ----------------- |
| `400` | `VALIDATION_ERROR` | Invalid UUID | — |
| `404` | `JOB_NOT_FOUND` | Unknown job | — |
| `409` | `INVALID_STATE` | Job processing or terminal | `"Job cannot be cancelled in status: processing"` |
| `409` | `CANCELLATION_RACE` | Worker acquired job first | `"Job is already being processed"` |
| `500` | `INTERNAL_ERROR` | Unexpected failure | — |

#### Conflict example

```json
{
  "statusCode": 409,
  "code": "CANCELLATION_RACE",
  "message": "Job is already being processed and cannot be cancelled",
  "details": [],
  "timestamp": "2026-07-16T10:05:00.000Z",
  "path": "/api/jobs/550e8400-e29b-41d4-a716-446655440000"
}
```

### HTTP Status Codes

| Status | When |
| ------ | ---- |
| `204` | Cancelled successfully |
| `400` | Invalid ID |
| `404` | Job not found |
| `409` | Not cancellable or race lost |
| `500` | Server error |

---

## GET /api/jobs/:id/attempts

### Purpose

Return ordered execution history for a job, one record per attempt.

### HTTP Method

`GET`

### Path

`/api/jobs/:id/attempts`

### Authentication

Not required initially.

### Path Parameters

| Name | Type | Required | Description | Validation |
| ---- | ---- | -------- | ----------- | ---------- |
| `id` | UUID | Yes | Job identifier | Valid UUID |

### Success Response

**HTTP `200 OK`**

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "attempts": [
    {
      "attemptNumber": 1,
      "status": "failed",
      "startedAt": "2026-07-16T10:00:01.000Z",
      "completedAt": "2026-07-16T10:00:01.200Z",
      "processingTimeMs": 200,
      "errorMessage": "Simulated failure"
    },
    {
      "attemptNumber": 2,
      "status": "completed",
      "startedAt": "2026-07-16T10:00:03.000Z",
      "completedAt": "2026-07-16T10:00:03.150Z",
      "processingTimeMs": 150,
      "errorMessage": null
    }
  ]
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `jobId` | UUID | Parent job ID |
| `attempts` | array | Ordered by `attemptNumber` ascending |
| `attempts[].attemptNumber` | integer | 1-based attempt index |
| `attempts[].status` | string | Attempt outcome status |
| `attempts[].startedAt` | string | Attempt start (ISO 8601 UTC) |
| `attempts[].completedAt` | string \| null | Attempt completion time |
| `attempts[].processingTimeMs` | integer \| null | Processing duration (ms) |
| `attempts[].errorMessage` | string \| null | Error if failed |

### Error Responses

| Status | Code | Cause |
| ------ | ---- | ----- |
| `400` | `VALIDATION_ERROR` | Invalid UUID |
| `404` | `JOB_NOT_FOUND` | Unknown job |
| `500` | `INTERNAL_ERROR` | Unexpected failure |

### HTTP Status Codes

| Status | When |
| ------ | ---- |
| `200` | Success (empty attempts array if none yet) |
| `400` | Invalid ID |
| `404` | Job not found |
| `500` | Server error |

---

## GET /api/dead-letter-jobs

### Purpose

List jobs that permanently failed after exhausting all retry attempts. Queries the **PostgreSQL-backed dead-letter view** (see [DESIGN.md — Dead-Letter Handling](./DESIGN.md#dead-letter-handling)).

### HTTP Method

`GET`

### Path

`/api/dead-letter-jobs`

### Authentication

Not required initially.

### Query Parameters

| Name | Type | Required | Default | Constraints | Description |
| ---- | ---- | -------- | ------- | ----------- | ----------- |
| `page` | integer | No | `1` | `>= 1` | Page number |
| `limit` | integer | No | `20` | `1`–`100` | Page size |
| `type` | string | No | — | Supported job types | Optional filter |
| `sortOrder` | string | No | `desc` | `asc`, `desc` | Sort by `failedAt` or `createdAt` |

### Success Response

**HTTP `200 OK`**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "sms",
      "priority": "normal",
      "status": "failed",
      "retryCount": 3,
      "maxAttempts": 3,
      "lastError": "Simulated permanent failure",
      "failedAt": "2026-07-16T10:00:10.000Z",
      "createdAt": "2026-07-16T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

Only jobs with `status: failed` and exhausted attempts appear here.

### Error Responses

| Status | Code | Cause |
| ------ | ---- | ----- |
| `400` | `VALIDATION_ERROR` | Invalid query |
| `500` | `INTERNAL_ERROR` | Unexpected failure |

### HTTP Status Codes

| Status | When |
| ------ | ---- |
| `200` | Success |
| `400` | Invalid query |
| `500` | Server error |

---

## POST /api/queue/pause

### Purpose

Pause assignment of **waiting** jobs to workers. Active jobs continue until completion.

### HTTP Method

`POST`

### Path

`/api/queue/pause`

### Authentication

Not required initially (should be restricted in production).

### Request Body

None (empty body or `{}`).

### Success Response

**HTTP `200 OK`**

```json
{
  "paused": true,
  "message": "Queue paused. Active jobs will complete; waiting jobs will not start."
}
```

### Validation Rules

- Idempotent: pausing an already paused queue returns `paused: true`.

### Error Responses

| Status | Code | Cause |
| ------ | ---- | ----- |
| `503` | `QUEUE_UNAVAILABLE` | Redis/BullMQ unreachable |
| `500` | `INTERNAL_ERROR` | Unexpected failure |

### HTTP Status Codes

| Status | When |
| ------ | ---- |
| `200` | Queue paused (or already paused) |
| `503` | Queue dependency unavailable |
| `500` | Server error |

---

## POST /api/queue/resume

### Purpose

Resume assignment of waiting jobs to workers after a pause.

### HTTP Method

`POST`

### Path

`/api/queue/resume`

### Authentication

Not required initially.

### Request Body

None.

### Success Response

**HTTP `200 OK`**

```json
{
  "paused": false,
  "message": "Queue resumed. Waiting jobs are eligible for processing."
}
```

### Error Responses

| Status | Code | Cause |
| ------ | ---- | ----- |
| `503` | `QUEUE_UNAVAILABLE` | Redis/BullMQ unreachable |
| `500` | `INTERNAL_ERROR` | Unexpected failure |

### HTTP Status Codes

| Status | When |
| ------ | ---- |
| `200` | Queue resumed |
| `503` | Dependency unavailable |
| `500` | Server error |

---

## GET /api/queue/status

### Purpose

Return current queue pause state and live BullMQ job counts.

### HTTP Method

`GET`

### Path

`/api/queue/status`

### Authentication

Not required initially.

### Success Response

**HTTP `200 OK`**

```json
{
  "paused": false,
  "waiting": 12,
  "active": 1,
  "delayed": 3
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `paused` | boolean | Whether queue consumption is paused |
| `waiting` | integer | Jobs ready to be processed (`queueLength`) |
| `active` | integer | Jobs currently being processed |
| `delayed` | integer | Jobs waiting for delay or schedule |

### Error Responses

| Status | Code | Cause |
| ------ | ---- | ----- |
| `503` | `QUEUE_UNAVAILABLE` | Redis/BullMQ unreachable |
| `500` | `INTERNAL_ERROR` | Unexpected failure |

### HTTP Status Codes

| Status | When |
| ------ | ---- |
| `200` | Success |
| `503` | Queue unavailable |
| `500` | Server error |

---

## GET /api/health

### Purpose

Report overall system health including API liveness, dependency connectivity, worker heartbeat, and current queue counts.

### HTTP Method

`GET`

### Path

`/api/health`

### Authentication

Not required initially.

### Success Response

**HTTP `200 OK`** when healthy or degraded (implementation may use `200` with status field, or `503` when unavailable — planned: return `200` with `status` field for degraded; `503` when critical dependencies down).

```json
{
  "status": "healthy",
  "timestamp": "2026-07-16T10:00:00.000Z",
  "checks": {
    "api": { "status": "up" },
    "database": { "status": "up", "latencyMs": 5 },
    "redis": { "status": "up", "latencyMs": 2 },
    "worker": {
      "status": "up",
      "lastHeartbeatAt": "2026-07-16T09:59:58.000Z",
      "workerIds": ["worker-1"]
    },
    "queue": {
      "status": "up",
      "waiting": 5,
      "active": 1,
      "delayed": 0,
      "paused": false
    }
  }
}
```

### Status values

| Overall status | Condition |
| -------------- | --------- |
| `healthy` | API, PostgreSQL, Redis up; worker heartbeat recent; queue reachable |
| `degraded` | Non-critical issue (e.g., stale worker heartbeat, elevated queue depth — exact rules TBD) |
| `unavailable` | PostgreSQL or Redis unreachable; API cannot serve job operations reliably |

When overall status is `unavailable`, HTTP **`503 Service Unavailable`** may be returned with the same JSON body.

### Error Responses

| Status | Code | Cause |
| ------ | ---- | ----- |
| `503` | `SERVICE_UNAVAILABLE` | Critical dependency down |
| `500` | `INTERNAL_ERROR` | Health check failure |

### HTTP Status Codes

| Status | When |
| ------ | ---- |
| `200` | Healthy or degraded |
| `503` | Unavailable |
| `500` | Unexpected error |

---

## GET /api/metrics

### Purpose

Expose historical processing metrics from PostgreSQL and live queue metrics from BullMQ.

### HTTP Method

`GET`

### Path

`/api/metrics`

### Authentication

Not required initially.

### Success Response

**HTTP `200 OK`**

```json
{
  "timestamp": "2026-07-16T10:00:00.000Z",
  "historical": {
    "jobsProcessed": 150,
    "completedJobs": 140,
    "failedJobs": 10,
    "averageProcessingTimeMs": 245,
    "successRate": 93.33
  },
  "queue": {
    "queueLength": 5,
    "activeJobs": 1,
    "delayedJobs": 2,
    "paused": false
  }
}
```

### Metric definitions

| Metric | Source | Definition |
| ------ | ------ | ---------- |
| `jobsProcessed` | PostgreSQL | `completedJobs + failedJobs` |
| `completedJobs` | PostgreSQL | Count of jobs with status `completed` |
| `failedJobs` | PostgreSQL | Count of jobs with status `failed` (terminal) |
| `averageProcessingTimeMs` | PostgreSQL | Mean `processingTimeMs` for completed jobs |
| `successRate` | Derived | `(completedJobs / jobsProcessed) * 100`; **`0`** when `jobsProcessed = 0` |
| `queueLength` | BullMQ | Waiting jobs only |
| `activeJobs` | BullMQ | Currently processing |
| `delayedJobs` | BullMQ | Delayed or scheduled, not yet waiting |
| `paused` | BullMQ | Queue pause flag |

### Error Responses

| Status | Code | Cause |
| ------ | ---- | ----- |
| `503` | `METRICS_UNAVAILABLE` | Cannot reach DB or Redis |
| `500` | `INTERNAL_ERROR` | Unexpected failure |

### HTTP Status Codes

| Status | When |
| ------ | ---- |
| `200` | Metrics retrieved |
| `503` | Dependency unavailable |
| `500` | Server error |

---

## Planned Swagger

When implemented, OpenAPI documentation will be available at:

```
http://localhost:3000/api/docs
```

Exact path is subject to implementation. Swagger is **not yet available**.

---

## Related Documentation

- [System Design](./DESIGN.md) — architecture, lifecycle, ADRs
- [README](../README.md) — project overview and setup
