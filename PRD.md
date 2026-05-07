# Product Requirements Document
## FileVault — S3-Powered File Upload Service

**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** 2026-05-06  
**Owner:** Product Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Target Audience](#4-target-audience)
5. [System Architecture](#5-system-architecture)
6. [Tech Stack](#6-tech-stack)
7. [Core Features](#7-core-features)
8. [API Design](#8-api-design)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [Pricing & Billing](#10-pricing--billing)
11. [SDK Specifications](#11-sdk-specifications)
12. [Dashboard (Frontend)](#12-dashboard-frontend)
13. [Queue & Async Processing](#13-queue--async-processing)
14. [Storage Layer](#14-storage-layer)
15. [Documentation (Mintlify)](#15-documentation-mintlify)
16. [Security & Compliance](#16-security--compliance)
17. [Observability & Monitoring](#17-observability--monitoring)
18. [Data Models](#18-data-models)
19. [Milestones & Roadmap](#19-milestones--roadmap)
20. [Open Questions](#20-open-questions)

---

## 1. Executive Summary

**FileVault** is a developer-first, multi-tenant file upload service that abstracts the complexity of S3-compatible object storage behind a clean REST API. It offers direct and resumable uploads, real-time processing hooks, fine-grained access control via API keys and project tokens, and a usage-based billing model powered by Stripe (global) and Paystack (Africa/emerging markets).

Developers integrate FileVault in minutes via REST or official SDKs, manage everything from a React dashboard, and read comprehensive docs on Mintlify. The service is designed to be the "Cloudinary for raw files" — minus the heavy transformation layer, plus superior DX.

---

## 2. Problem Statement

Building a robust file upload pipeline is a solved but painful problem. Teams repeatedly implement:

- S3 presigned URL generation and lifecycle management
- Virus/MIME scanning pipelines
- Resumable upload support (TUS protocol)
- Per-tenant storage quotas and rate limiting
- CDN-backed delivery URLs
- Per-file access policies

FileVault eliminates this boilerplate so product teams can ship faster.

---

## 3. Goals & Success Metrics

### Business Goals

| Goal | KPI | Target (12 months) |
|---|---|---|
| Developer adoption | Registered projects | 500 |
| Revenue | MRR | $15,000 |
| Retention | Churn rate | < 5% monthly |
| Reliability | Uptime | 99.9% |

### Product Goals

- Time-to-first-upload < 5 minutes for a new developer
- SDK coverage for the 3 most popular languages at launch
- P99 upload API latency < 200ms (excluding transfer time)
- Billing accuracy: 100% (no over/under charges)

---

## 4. Target Audience

### Primary — Developers / Engineering Teams

Solo developers and startup engineering teams building products that need file storage without the overhead. They want a great API, good docs, and predictable pricing.

### Secondary — Agencies / ISVs

Agencies building client products who want to white-label or resell storage capacity. They need multi-project isolation and consolidated billing.

### Tertiary — Enterprise IT

Teams that need compliance guarantees, SSO, audit logs, and SLAs. This segment is a Phase 2 focus.

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│   SDK (Go/JS/Python)   │   REST API   │   Dashboard (React)    │
└──────────────┬──────────────────────────────────────┬──────────┘
               │                                      │
               ▼                                      ▼
┌─────────────────────────┐              ┌────────────────────────┐
│      API Gateway        │              │   Dashboard API        │
│  (Chi Router, Go)       │              │   (Chi Router, Go)     │
│  - Auth Middleware      │              │   - Session Auth        │
│  - Rate Limiting        │              │   - CSRF Protection    │
│  - Request Validation   │              └────────────┬───────────┘
└──────────┬──────────────┘                           │
           │                                          │
           ▼                                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER (Go)                         │
│  UploadService │ ProjectService │ BillingService │ AuthService   │
└───────┬────────────────┬────────────────┬───────────────┬────────┘
        │                │                │               │
        ▼                ▼                ▼               ▼
┌───────────┐   ┌────────────────┐ ┌──────────┐  ┌─────────────┐
│ PostgreSQL│   │  AWS S3 /      │ │  Redis   │  │  RabbitMQ   │
│           │   │  S3-Compatible │ │  Cache   │  │  Job Queue  │
└───────────┘   └────────────────┘ └──────────┘  └─────────────┘
                                                        │
                                                        ▼
                                              ┌──────────────────┐
                                              │  Worker Pool     │
                                              │ - Virus Scan     │
                                              │ - MIME Validate  │
                                              │ - Webhooks       │
                                              │ - Usage Metering │
                                              └──────────────────┘
```

### Key Design Decisions

- **Presigned URLs:** The API server generates presigned S3 URLs. Files upload directly from client to S3, never passing through the API server. This keeps the API stateless and reduces bandwidth costs.
- **Post-upload hooks:** After S3 receives a file, an S3 event triggers an SQS/SNS message or webhook that enqueues a RabbitMQ job for processing.
- **Redis** is used for rate limiting (sliding window counters), idempotency keys, and short-lived presigned URL metadata.
- **PostgreSQL** stores all persistent state: projects, uploads metadata, API keys, usage records, billing events.

---

## 6. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Backend Language** | Go | Performance, strong concurrency, small binary |
| **HTTP Framework** | Chi | Lightweight, idiomatic Go router; composable middleware |
| **Frontend** | React + Vite | Fast HMR, modern build tooling |
| **Frontend State/Data** | TanStack Query + TanStack Router | Type-safe, powerful async state |
| **Database** | PostgreSQL 16+ | ACID, JSONB for metadata, row-level security |
| **ORM/Query Builder** | sqlc + pgx | Type-safe SQL generation, no magic |
| **Object Storage** | AWS S3 (default), S3-compatible (Cloudflare R2, MinIO, Backblaze B2) | Pluggable via interface |
| **Cache / Rate Limiter** | Redis 7+ | Fast, atomic ops for counters |
| **Message Queue** | RabbitMQ | Reliable async job processing, dead-letter queues |
| **Billing (Global)** | Stripe | Industry standard, excellent webhooks |
| **Billing (Africa/EM)** | Paystack | Local card/mobile money support |
| **Auth** | API Keys + Project Tokens (HMAC-SHA256) | Stateless, easy to rotate |
| **Docs** | Mintlify | Beautiful developer docs, OpenAPI support |
| **Container** | Docker + Docker Compose | Local dev parity |
| **CI/CD** | GitHub Actions | Lint, test, deploy |

---

## 7. Core Features

### 7.1 Projects

A **Project** is the top-level resource. Each project has its own:

- Storage bucket (or prefix within a shared bucket)
- API keys and project tokens
- Usage quotas
- Allowed MIME types and max file size policies
- Webhook endpoints
- Billing subscription

### 7.2 File Uploads

#### Standard Upload (via Presigned URL)
1. Client requests a presigned URL from the FileVault API
2. FileVault validates quota, generates presigned PUT URL (15-minute TTL)
3. Client uploads directly to S3
4. S3 triggers post-upload event → RabbitMQ job
5. Worker validates file, updates DB record, fires webhook

#### Multipart / Resumable Upload (TUS-compatible)
- For files > 5 MB
- Client initiates upload, gets an upload ID
- Chunks uploaded sequentially or concurrently
- Server tracks progress in Redis
- Supports resume after connection drop

#### Server-Side Upload
- Clients POST a URL; FileVault fetches and stores the remote resource
- Useful for ingest pipelines

### 7.3 File Management

- List files with cursor-based pagination
- Soft delete + hard delete
- Move/copy between folders
- File versioning (optional, per project config)
- Folder/prefix organization

### 7.4 Access Control & Delivery

- **Public files:** Served via CDN-backed public URL
- **Private files:** Served via time-limited signed delivery URLs
- **Per-file ACL:** owner, project, public
- Custom domain support (CNAME to FileVault CDN)

### 7.5 Webhooks

Projects configure webhook endpoints for events:

- `upload.completed`
- `upload.failed`
- `file.deleted`
- `quota.warning` (80%, 100%)
- `billing.invoice.created`

Webhooks are signed with HMAC-SHA256. Delivery retried up to 5× with exponential backoff via RabbitMQ dead-letter queue.

### 7.6 Usage & Metering

Per project, per billing cycle:

- Total storage used (GB)
- Bandwidth egress (GB)
- API request count
- Number of files stored

Usage metered in real-time via Redis counters, flushed to PostgreSQL every 5 minutes by a background worker.

---

## 8. API Design

**Base URL:** `https://api.filevault.io/v1`

All requests require either `Authorization: Bearer <api_key>` or `X-Project-Token: <token>`.

### Endpoints

#### Projects

```
POST   /projects                    Create project
GET    /projects/:id                Get project
PATCH  /projects/:id                Update project settings
DELETE /projects/:id                Delete project
GET    /projects/:id/usage          Get current usage
GET    /projects/:id/stats          Get upload stats (last 30 days)
```

#### Uploads

```
POST   /projects/:id/uploads        Initiate upload → returns presigned URL
GET    /projects/:id/uploads        List uploads (paginated)
GET    /projects/:id/uploads/:uid   Get upload metadata
DELETE /projects/:id/uploads/:uid   Delete file
POST   /projects/:id/uploads/:uid/complete   Mark multipart upload complete
GET    /projects/:id/uploads/:uid/url        Get signed delivery URL
```

#### Multipart

```
POST   /projects/:id/multipart/init          Init multipart upload
POST   /projects/:id/multipart/:id/part      Get presigned URL for a part
POST   /projects/:id/multipart/:id/complete  Complete multipart upload
DELETE /projects/:id/multipart/:id/abort     Abort multipart upload
```

#### API Keys

```
POST   /projects/:id/keys           Create API key
GET    /projects/:id/keys           List API keys
DELETE /projects/:id/keys/:kid      Revoke API key
```

#### Webhooks

```
POST   /projects/:id/webhooks       Register webhook endpoint
GET    /projects/:id/webhooks       List webhooks
DELETE /projects/:id/webhooks/:wid  Delete webhook
GET    /projects/:id/webhooks/:wid/deliveries  List recent deliveries
```

#### Billing

```
GET    /billing/plans               List available plans
GET    /billing/subscription        Get current subscription
POST   /billing/checkout            Create checkout session (Stripe/Paystack)
POST   /billing/portal              Customer portal link
GET    /billing/invoices            List invoices
```

### Standard Response Envelope

```json
{
  "data": { ... },
  "meta": {
    "request_id": "req_01HXK...",
    "timestamp": "2026-05-06T10:00:00Z"
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Storage quota for this project has been exceeded.",
    "docs_url": "https://docs.filevault.io/errors/QUOTA_EXCEEDED"
  },
  "meta": {
    "request_id": "req_01HXK..."
  }
}
```

---

## 9. Authentication & Authorization

### API Keys

- Format: `fv_live_<base62(32 bytes)>` or `fv_test_<base62(32 bytes)>`
- Stored as `HMAC-SHA256(key, secret)` in PostgreSQL — plaintext never stored
- Scopes: `read`, `write`, `delete`, `admin`
- Per-key IP allowlist (optional)
- Key rotation: new key issued, old key deprecated with configurable grace period

### Project Tokens

- Short-lived (configurable TTL, default 1 hour)
- Scoped to a single project
- Intended for frontend/client use — generated server-side, passed to client
- Cannot be used to manage project settings or billing
- Stored in Redis with TTL for fast validation

### Authentication Flow

```
Client ──► API ──► Auth Middleware
                        │
                        ├─ Extract Bearer or X-Project-Token
                        ├─ HMAC verify key hash against DB
                        ├─ Check key not revoked
                        ├─ Check key scopes match required scope
                        ├─ Attach project context to request
                        └─ Rate limit check (Redis sliding window)
```

### Dashboard Auth

- Email + password with bcrypt hashing
- TOTP-based 2FA (Google Authenticator compatible)
- HTTP-only session cookies
- CSRF tokens on all state-changing requests

---

## 10. Pricing & Billing

### Pricing Tiers

| Feature | **Hobby** | **Starter** | **Pro** | **Enterprise** |
|---|---|---|---|---|
| **Price** | Free | $19/mo | $79/mo | Custom |
| Storage | 5 GB | 50 GB | 500 GB | Unlimited |
| Bandwidth | 10 GB/mo | 100 GB/mo | 1 TB/mo | Custom |
| API Requests | 10,000/mo | 100,000/mo | 1,000,000/mo | Unlimited |
| Projects | 1 | 5 | 25 | Unlimited |
| Max file size | 50 MB | 500 MB | 5 GB | Custom |
| Webhooks | — | ✓ | ✓ | ✓ |
| Custom domain | — | — | ✓ | ✓ |
| File versioning | — | — | ✓ | ✓ |
| SLA | — | 99.5% | 99.9% | 99.99% |
| Support | Community | Email | Priority | Dedicated |

### Overage Pricing

| Resource | Rate |
|---|---|
| Additional storage | $0.023 / GB / month |
| Additional bandwidth | $0.09 / GB |
| Additional API requests | $0.40 / 10,000 requests |

### Billing Provider Selection

Selection is automatic based on the user's billing country at signup:

- **Africa (NG, GH, KE, ZA, and others):** Paystack — supports NGN, GHS, KES, ZAR; local card rails + mobile money
- **Rest of world:** Stripe — supports 135+ currencies, all major cards, SEPA, ACH

Both providers use a webhook-driven event system. A unified `BillingService` interface in Go abstracts both:

```go
type BillingProvider interface {
    CreateCheckoutSession(ctx context.Context, req CheckoutRequest) (*CheckoutSession, error)
    CreateCustomerPortalLink(ctx context.Context, customerID string) (string, error)
    GetInvoices(ctx context.Context, customerID string) ([]Invoice, error)
    HandleWebhook(ctx context.Context, payload []byte, sig string) error
}
```

### Billing Lifecycle

1. User signs up → Hobby tier activated (no payment required)
2. User upgrades → redirected to Stripe/Paystack checkout
3. On successful payment webhook → subscription activated in DB
4. Monthly → usage snapshot taken → invoice generated
5. On overage → charge calculated and applied to next invoice
6. On cancellation → service continues until end of billing period

---

## 11. SDK Specifications

### Target Languages at Launch

| SDK | Repo | Package Manager |
|---|---|---|
| Go | `filevault/filevault-go` | `go get` |
| JavaScript / TypeScript | `filevault/filevault-js` | npm / yarn |
| Python | `filevault/filevault-python` | pip |

### SDK Feature Parity (All SDKs)

- Initiate and complete standard uploads
- Multipart / resumable uploads with progress callbacks
- List, delete, get signed delivery URLs
- Project and API key management
- Typed error classes mapping to API error codes
- Automatic retry with exponential backoff (configurable)
- Configurable base URL for S3-compatible self-hosted deployments

### JavaScript/TypeScript SDK — Highlights

```typescript
import { FileVault } from '@filevault/sdk';

const fv = new FileVault({ apiKey: 'fv_live_...' });

// Simple upload
const file = await fv.projects('proj_abc').uploads.create({
  file: fileBlob,
  filename: 'report.pdf',
  onProgress: (pct) => console.log(`${pct}%`),
});

// Get signed delivery URL
const url = await fv.projects('proj_abc').uploads.getUrl(file.id, { expiresIn: 3600 });
```

### Go SDK — Highlights

```go
client := filevault.NewClient("fv_live_...")

upload, err := client.Uploads.Create(ctx, "proj_abc", &filevault.UploadParams{
    Filename:    "report.pdf",
    ContentType: "application/pdf",
    Size:        fileSize,
})
// upload.PresignedURL → PUT directly to S3
```

### Python SDK — Highlights

```python
from filevault import FileVault

fv = FileVault(api_key="fv_live_...")

upload = fv.projects("proj_abc").uploads.create(
    file=open("report.pdf", "rb"),
    filename="report.pdf",
)
url = fv.projects("proj_abc").uploads.get_url(upload.id, expires_in=3600)
```

---

## 12. Dashboard (Frontend)

**Stack:** React 19, Vite, TanStack Query v5, TanStack Router v1, Tailwind CSS, Shadcn/ui

### Pages & Routes

```
/                          → Marketing / landing page
/signup                    → Signup
/login                     → Login + 2FA
/dashboard                 → Overview (usage charts, recent uploads)
/dashboard/projects        → Project list
/dashboard/projects/new    → Create project
/dashboard/projects/:id    → Project overview
/dashboard/projects/:id/uploads    → File browser (upload, search, delete)
/dashboard/projects/:id/settings   → Project settings (MIME policy, size limits, custom domain)
/dashboard/projects/:id/keys       → API key management
/dashboard/projects/:id/webhooks   → Webhook endpoints + delivery log
/dashboard/billing         → Plan, usage breakdown, invoices
/dashboard/settings        → Account settings, 2FA, password
/docs                      → Redirects to Mintlify docs site
```

### Key UI Components

- **File Browser:** Drag-and-drop upload, folder navigation, file preview, bulk delete
- **Usage Widgets:** Storage gauge, bandwidth bar, requests chart (TanStack Query + Recharts)
- **API Key Manager:** Create key with scope selection, copy-once display, revoke
- **Webhook Tester:** Fire test event, view delivery attempts and response bodies
- **Billing Portal:** Plan comparison table, upgrade/downgrade CTA, invoice history

### Data Fetching Strategy

- TanStack Query for all server state (uploads list, usage, etc.)
- Optimistic updates for file deletes and renames
- Infinite query for paginated file list
- Polling for upload status (1s interval, stops on terminal state)

---

## 13. Queue & Async Processing

### RabbitMQ Exchanges & Queues

```
Exchange: filevault.uploads (topic)
  └── filevault.uploads.processing   ← post-upload validation jobs
  └── filevault.uploads.webhooks     ← outbound webhook delivery jobs
  └── filevault.uploads.dlq          ← dead-letter queue (after 5 retries)

Exchange: filevault.billing (direct)
  └── filevault.billing.metering     ← usage flush jobs
  └── filevault.billing.events       ← stripe/paystack webhook events
```

### Worker Types

| Worker | Responsibility | Concurrency |
|---|---|---|
| `upload-processor` | MIME validation, virus scan, metadata extraction | 10 goroutines |
| `webhook-dispatcher` | HTTP delivery of webhook events, retry logic | 5 goroutines |
| `usage-meter` | Flush Redis counters to PostgreSQL | 1 goroutine (cron-like) |
| `billing-event` | Process Stripe/Paystack webhook events | 3 goroutines |
| `cleanup` | Hard delete expired/soft-deleted files from S3 | 1 goroutine |

### Redis Usage

| Key Pattern | Purpose | TTL |
|---|---|---|
| `rl:{project_id}:{window}` | Rate limit counter (sliding window) | 60s |
| `upload:{upload_id}:meta` | Pending upload metadata | 20 min |
| `usage:{project_id}:storage` | Running storage counter | Flushed every 5 min |
| `usage:{project_id}:bandwidth` | Running bandwidth counter | Flushed every 5 min |
| `token:{project_token}` | Project token validation cache | Matches token TTL |

---

## 14. Storage Layer

### S3 Abstraction Interface

```go
type StorageProvider interface {
    GeneratePresignedPUT(ctx context.Context, key string, ttl time.Duration, opts PutOptions) (string, error)
    GeneratePresignedGET(ctx context.Context, key string, ttl time.Duration) (string, error)
    InitMultipartUpload(ctx context.Context, key string) (string, error)
    PresignMultipartPart(ctx context.Context, key, uploadID string, part int) (string, error)
    CompleteMultipartUpload(ctx context.Context, key, uploadID string, parts []Part) error
    AbortMultipartUpload(ctx context.Context, key, uploadID string) error
    DeleteObject(ctx context.Context, key string) error
    HeadObject(ctx context.Context, key string) (*ObjectMeta, error)
}
```

### Supported Storage Backends

| Backend | Notes |
|---|---|
| AWS S3 | Default, production-recommended |
| Cloudflare R2 | S3-compatible, zero egress fees — recommended cost optimization |
| Backblaze B2 | S3-compatible, low cost |
| MinIO | Self-hosted option; useful for enterprise on-prem deployments |

Backend selected per project via config; defaults to global provider setting.

### Object Key Structure

```
{project_id}/{year}/{month}/{upload_id}/{filename}
```

Example: `proj_abc123/2026/05/upl_xyz789/report.pdf`

### Lifecycle Policies

- Soft-deleted files → moved to `_trash/` prefix → hard deleted after 30 days (configurable)
- Incomplete multipart uploads → aborted after 24 hours via S3 lifecycle rule
- Versioned files → previous versions retained for configurable retention window

---

## 15. Documentation (Mintlify)

**Docs URL:** `https://docs.filevault.io`

### Documentation Structure

```
Getting Started
  ├── Introduction
  ├── Quick Start (5-minute guide)
  └── Core Concepts

API Reference
  ├── Authentication
  ├── Projects
  ├── Uploads
  ├── Multipart Uploads
  ├── Webhooks
  ├── API Keys
  └── Billing

SDKs
  ├── JavaScript / TypeScript
  ├── Go
  └── Python

Guides
  ├── Uploading Files from a Browser
  ├── Resumable Uploads
  ├── Secure File Delivery
  ├── Custom Domains
  ├── Webhook Security
  └── Migrating from S3

Self-Hosting
  ├── Docker Compose Setup
  ├── Environment Variables
  └── S3-Compatible Providers

Billing & Plans
  ├── Pricing Overview
  ├── Overages & Limits
  └── Paystack vs Stripe FAQ

Errors
  └── Error Code Reference
```

### OpenAPI Integration

- API spec generated via `swaggo/swag` annotations in Go source
- Mintlify auto-renders interactive API playground from OpenAPI 3.1 spec
- Spec published at `/openapi.json` and `https://docs.filevault.io/openapi.json`

---

## 16. Security & Compliance

### API Security

- All API traffic over TLS 1.2+
- Request signing optional for enhanced security (HMAC-SHA256 signature over request body)
- API key plaintext never stored; HMAC hash only
- Rate limiting: per-API-key, per-IP sliding window (Redis)
- Presigned URLs are single-use validated via Redis idempotency key

### Upload Security

- MIME type validation: magic byte inspection, not just Content-Type header
- Optional ClamAV virus scanning (worker step, configurable per project)
- Max file size enforced at presigned URL generation (S3 rejects oversized uploads via policy)
- Allowed MIME type allowlist per project
- Files stored with AES-256 server-side encryption in S3

### Application Security

- Secrets managed via environment variables; no secrets in source
- PostgreSQL row-level security for multi-tenant data isolation
- All DB queries parameterized (sqlc eliminates string interpolation)
- CORS configured per project's allowed origins
- CSP headers on all dashboard responses
- OWASP Top 10 considered in design review

### Compliance

- GDPR: data deletion endpoint; data processing agreements available
- SOC 2 Type II: target for Phase 2
- Data residency: region selection at project creation (us-east-1, eu-west-1, af-south-1)

---

## 17. Observability & Monitoring

### Logging

- Structured JSON logs (Go `slog`)
- Log levels: DEBUG, INFO, WARN, ERROR
- Request logs include: `request_id`, `project_id`, `duration_ms`, `status_code`
- Shipped to structured log aggregator (e.g., Loki, Datadog, CloudWatch)

### Metrics (Prometheus)

```
filevault_uploads_total{project_id, status}
filevault_upload_bytes_total{project_id}
filevault_api_request_duration_seconds{route, method, status}
filevault_queue_depth{queue}
filevault_worker_jobs_total{worker, status}
filevault_storage_bytes{project_id}
```

### Tracing

- OpenTelemetry instrumentation on all HTTP handlers and DB calls
- Traces exported to Jaeger or OTLP-compatible backend

### Alerting

| Alert | Threshold | Channel |
|---|---|---|
| API error rate | > 1% over 5 min | PagerDuty |
| Queue depth (upload-processor) | > 1,000 for 5 min | Slack |
| Worker crash | Any | PagerDuty |
| DB connection pool exhaustion | > 90% | PagerDuty |
| Storage quota webhook failure | 3× retries exhausted | Slack |

---

## 18. Data Models

### projects

```sql
CREATE TABLE projects (
  id            TEXT PRIMARY KEY,           -- proj_<ulid>
  owner_id      TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  storage_region TEXT NOT NULL DEFAULT 'us-east-1',
  bucket_prefix TEXT NOT NULL,
  max_file_size_bytes BIGINT NOT NULL DEFAULT 52428800,
  allowed_mime_types  TEXT[] DEFAULT NULL,  -- NULL = all allowed
  versioning_enabled  BOOLEAN DEFAULT FALSE,
  custom_domain TEXT,
  billing_provider TEXT NOT NULL DEFAULT 'stripe',
  stripe_customer_id  TEXT,
  paystack_customer_id TEXT,
  subscription_tier   TEXT NOT NULL DEFAULT 'hobby',
  subscription_status TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### uploads

```sql
CREATE TABLE uploads (
  id            TEXT PRIMARY KEY,           -- upl_<ulid>
  project_id    TEXT NOT NULL REFERENCES projects(id),
  filename      TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  size_bytes    BIGINT,
  storage_key   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  -- pending | processing | completed | failed | deleted
  checksum_sha256 TEXT,
  metadata      JSONB DEFAULT '{}',
  acl           TEXT NOT NULL DEFAULT 'private',
  version_of    TEXT REFERENCES uploads(id),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);
```

### api_keys

```sql
CREATE TABLE api_keys (
  id            TEXT PRIMARY KEY,           -- key_<ulid>
  project_id    TEXT NOT NULL REFERENCES projects(id),
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,       -- HMAC-SHA256(key, secret)
  key_prefix    TEXT NOT NULL,              -- First 8 chars for display
  scopes        TEXT[] NOT NULL,
  environment   TEXT NOT NULL DEFAULT 'live', -- live | test
  ip_allowlist  INET[],
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### usage_records

```sql
CREATE TABLE usage_records (
  id            BIGSERIAL PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id),
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  storage_bytes BIGINT NOT NULL DEFAULT 0,
  bandwidth_bytes BIGINT NOT NULL DEFAULT 0,
  api_requests  BIGINT NOT NULL DEFAULT 0,
  file_count    BIGINT NOT NULL DEFAULT 0,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### webhook_endpoints

```sql
CREATE TABLE webhook_endpoints (
  id            TEXT PRIMARY KEY,           -- wh_<ulid>
  project_id    TEXT NOT NULL REFERENCES projects(id),
  url           TEXT NOT NULL,
  events        TEXT[] NOT NULL,
  secret        TEXT NOT NULL,              -- HMAC signing secret (encrypted at rest)
  enabled       BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### webhook_deliveries

```sql
CREATE TABLE webhook_deliveries (
  id            TEXT PRIMARY KEY,
  endpoint_id   TEXT NOT NULL REFERENCES webhook_endpoints(id),
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  response_status INT,
  response_body TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 19. Milestones & Roadmap

### Phase 1 — MVP (Weeks 1–8)

- [ ] Core Go backend: Chi router, middleware, project + upload API
- [ ] PostgreSQL schema + sqlc codegen
- [ ] S3 presigned URL upload flow (AWS S3)
- [ ] Redis rate limiting + upload metadata caching
- [ ] RabbitMQ worker: MIME validation, upload completion hook
- [ ] API key authentication
- [ ] Basic React dashboard: login, project management, file browser
- [ ] Stripe billing integration (Hobby → Starter upgrade)
- [ ] JavaScript SDK (alpha)
- [ ] Mintlify docs (Getting Started, API Reference)

### Phase 2 — Growth (Weeks 9–16)

- [ ] Multipart / resumable uploads
- [ ] Paystack billing integration
- [ ] Webhook endpoints + delivery log in dashboard
- [ ] Project tokens for browser-side uploads
- [ ] Go SDK + Python SDK
- [ ] Usage dashboard with charts
- [ ] Cloudflare R2 + MinIO backend support
- [ ] Custom domain support
- [ ] ClamAV virus scanning worker
- [ ] File versioning
- [ ] Self-hosted Docker Compose guide

### Phase 3 — Enterprise (Weeks 17–24)

- [ ] SSO (SAML 2.0, OIDC)
- [ ] Audit log
- [ ] Role-based access control within projects
- [ ] Data residency (EU region)
- [ ] SOC 2 Type II preparation
- [ ] Enterprise plan + custom contracts
- [ ] Dedicated support tier
- [ ] SLA dashboard

---

## 20. Open Questions

| # | Question | Owner | Due |
|---|---|---|---|
| 1 | Should Hobby tier require a credit card on file (to prevent abuse)? | Product | Sprint 1 |
| 2 | Do we support server-side upload (fetch by URL) at launch or Phase 2? | Engineering | Sprint 1 |
| 3 | ClamAV adds ~2–3s per file. Is this acceptable for the default processing path, or should scanning be opt-in? | Product | Sprint 2 |
| 4 | Which African countries should auto-route to Paystack vs Stripe? Define the exact country list. | Finance | Sprint 3 |
| 5 | File versioning storage counts against quota — is this intuitive to users? Consider versioned storage discount. | Product | Sprint 2 |
| 6 | Should we expose an S3-compatible API endpoint so clients can use any S3 SDK to talk to FileVault? | Engineering | Phase 2 |
| 7 | What is the right retention window for webhook delivery logs? 30 days? | Engineering | Sprint 2 |

---

*This document is a living artifact. All section owners should update it as decisions are finalized. Major changes require a review from Engineering Lead and Product Lead before merging.*