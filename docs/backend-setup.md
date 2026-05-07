# FileVault Backend — Local Development Setup

## Prerequisites

- Go 1.22+
- Docker & Docker Compose
- (Optional) sqlc CLI for regenerating queries

## Quick Start

```bash
# 1. Start infrastructure
docker compose up -d postgres redis rabbitmq minio minio-init

# 2. Run migrations
cd backend
cp .env.example .env  # adjust if needed
go run ./cmd/migrate up

# 3. Start the API server
go run ./cmd/api

# 4. Start the worker (separate terminal)
go run ./cmd/worker
```

The API is available at `http://localhost:8080`.

## Environment Variables

See `backend/.env.example` for the full list. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | 8080 | API server port |
| `DATABASE_URL` | postgres://filevault:filevault@localhost:5432/filevault?sslmode=disable | PostgreSQL connection |
| `REDIS_URL` | redis://localhost:6379/0 | Redis connection |
| `RABBITMQ_URL` | amqp://guest:guest@localhost:5672/ | RabbitMQ connection |
| `STORAGE_ENDPOINT` | http://localhost:9000 | S3/MinIO endpoint |
| `STORAGE_BUCKET` | filevault-uploads | Object storage bucket |
| `AUTH_HMAC_SECRET` | (change me) | Secret for HMAC key hashing |
| `CORS_ORIGINS` | http://localhost:5173 | Allowed CORS origins |

## Project Structure

```
backend/
├── cmd/
│   ├── api/            # HTTP API server entry point
│   ├── worker/         # Async job worker entry point
│   └── migrate/        # Database migration tool
├── internal/
│   ├── config/         # Environment-based configuration
│   ├── domain/         # Domain models (shared types)
│   ├── handler/        # HTTP handlers (controllers)
│   ├── middleware/     # Request ID, logging, auth
│   ├── router/         # Chi router setup
│   ├── service/        # Business logic layer
│   ├── storage/        # S3 storage abstraction
│   ├── queue/          # RabbitMQ publisher/consumer
│   └── repository/     # sqlc queries (data access)
├── migrations/         # PostgreSQL migration files
├── Dockerfile
├── Makefile
├── go.mod
└── .env.example
```

## API Endpoints

Base: `http://localhost:8080/v1`

### Auth
- `POST /v1/auth/signup` — Register
- `POST /v1/auth/login` — Login (supports 2FA)
- `GET /v1/auth/me` — Get current user
- `POST /v1/auth/logout` — Logout

### Projects
- `GET /v1/projects` — List user's projects
- `POST /v1/projects` — Create project
- `GET /v1/projects/:id` — Get project
- `PATCH /v1/projects/:id` — Update project
- `DELETE /v1/projects/:id` — Delete project
- `GET /v1/projects/:id/usage` — Current usage
- `GET /v1/projects/:id/stats` — 30-day stats

### Uploads
- `POST /v1/projects/:id/uploads` — Initiate upload (returns presigned URL)
- `GET /v1/projects/:id/uploads` — List uploads (paginated)
- `GET /v1/projects/:id/uploads/:uid` — Get upload
- `DELETE /v1/projects/:id/uploads/:uid` — Delete upload
- `POST /v1/projects/:id/uploads/:uid/complete` — Mark complete
- `GET /v1/projects/:id/uploads/:uid/url` — Get signed delivery URL
- `POST /v1/projects/:id/uploads/batch-delete` — Bulk delete

### API Keys
- `POST /v1/projects/:id/keys` — Create key
- `GET /v1/projects/:id/keys` — List keys
- `DELETE /v1/projects/:id/keys/:kid` — Revoke key

### Webhooks
- `POST /v1/projects/:id/webhooks` — Create webhook
- `GET /v1/projects/:id/webhooks` — List webhooks
- `PATCH /v1/projects/:id/webhooks/:wid` — Update webhook
- `DELETE /v1/projects/:id/webhooks/:wid` — Delete webhook
- `GET /v1/projects/:id/webhooks/:wid/deliveries` — Delivery log
- `POST /v1/projects/:id/webhooks/:wid/test` — Send test event

### Billing
- `GET /v1/billing/plans` — List plans
- `GET /v1/billing/subscription` — Current subscription
- `POST /v1/billing/change-plan` — Change plan
- `GET /v1/billing/invoices` — Invoice list
- `POST /v1/billing/checkout` — Checkout session
- `POST /v1/billing/portal` — Customer portal

### Health
- `GET /health` — Liveness
- `GET /health/ready` — Readiness (DB check)

## Response Format

All responses use the PRD envelope:

```json
{
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-05-07T10:00:00Z"
  }
}
```

Errors:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found.",
    "docs_url": "https://docs.filevault.io/errors/NOT_FOUND"
  },
  "meta": { "request_id": "req_abc123" }
}
```

## Running Tests

```bash
cd backend
go test ./... -v -race
```

## Database Migrations

```bash
go run ./cmd/migrate up    # Apply all pending
go run ./cmd/migrate down  # Rollback all
```

## Storage

Local dev uses MinIO (S3-compatible). Access the MinIO console at `http://localhost:9001` (minioadmin/minioadmin).

Production uses AWS S3 or any S3-compatible backend (R2, B2, etc.). Configure via `STORAGE_*` env vars.
