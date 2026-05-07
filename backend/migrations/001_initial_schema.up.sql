-- FileVault initial schema
-- Matches PRD section 18 data models + frontend contract extensions

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== Users ====================
CREATE TABLE users (
    id                TEXT PRIMARY KEY,                -- usr_<ulid>
    name              TEXT NOT NULL,
    email             TEXT UNIQUE NOT NULL,
    password_hash     TEXT NOT NULL,
    avatar_url        TEXT,
    country           TEXT NOT NULL DEFAULT '',
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ==================== Sessions ====================
CREATE TABLE sessions (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    TEXT NOT NULL UNIQUE,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- ==================== Projects ====================
CREATE TABLE projects (
    id                  TEXT PRIMARY KEY,                -- proj_<ulid>
    owner_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    slug                TEXT UNIQUE NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    storage_region      TEXT NOT NULL DEFAULT 'us-east-1',
    storage_backend     TEXT NOT NULL DEFAULT 's3',
    bucket_prefix       TEXT NOT NULL,
    max_file_size_bytes BIGINT NOT NULL DEFAULT 52428800,       -- 50MB
    allowed_mime_types  TEXT[],                                   -- NULL = all allowed
    versioning_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    custom_domain       TEXT,
    billing_provider    TEXT NOT NULL DEFAULT 'stripe',
    stripe_customer_id  TEXT,
    paystack_customer_id TEXT,
    subscription_tier   TEXT NOT NULL DEFAULT 'hobby',
    subscription_status TEXT NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_slug ON projects(slug);

-- ==================== Uploads ====================
CREATE TABLE uploads (
    id              TEXT PRIMARY KEY,                 -- upl_<ulid>
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    content_type    TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL DEFAULT 0,
    storage_key     TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    checksum_sha256 TEXT,
    acl             TEXT NOT NULL DEFAULT 'private',
    folder          TEXT NOT NULL DEFAULT '/',
    metadata        JSONB NOT NULL DEFAULT '{}',
    version_of      TEXT REFERENCES uploads(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_uploads_project_id ON uploads(project_id);
CREATE INDEX idx_uploads_project_status ON uploads(project_id, status);
CREATE INDEX idx_uploads_project_folder ON uploads(project_id, folder);
CREATE INDEX idx_uploads_created_at ON uploads(created_at DESC);

-- ==================== API Keys ====================
CREATE TABLE api_keys (
    id            TEXT PRIMARY KEY,                   -- key_<ulid>
    project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    key_hash      TEXT NOT NULL UNIQUE,               -- HMAC-SHA256(key, secret)
    key_prefix    TEXT NOT NULL,                      -- First 8-11 chars for display
    scopes        TEXT[] NOT NULL,
    environment   TEXT NOT NULL DEFAULT 'live',       -- live | test
    ip_allowlist  TEXT[],
    last_used_at  TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_project_id ON api_keys(project_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- ==================== Usage Records ====================
CREATE TABLE usage_records (
    id              BIGSERIAL PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_start    TIMESTAMPTZ NOT NULL,
    period_end      TIMESTAMPTZ NOT NULL,
    storage_bytes   BIGINT NOT NULL DEFAULT 0,
    bandwidth_bytes BIGINT NOT NULL DEFAULT 0,
    api_requests    BIGINT NOT NULL DEFAULT 0,
    file_count      BIGINT NOT NULL DEFAULT 0,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_records_project_period ON usage_records(project_id, period_start, period_end);

-- ==================== Webhook Endpoints ====================
CREATE TABLE webhook_endpoints (
    id          TEXT PRIMARY KEY,                     -- wh_<ulid>
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    events      TEXT[] NOT NULL,
    secret      TEXT NOT NULL,                        -- HMAC signing secret (encrypted at rest)
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_endpoints_project_id ON webhook_endpoints(project_id);

-- ==================== Webhook Deliveries ====================
CREATE TABLE webhook_deliveries (
    id              TEXT PRIMARY KEY,                 -- whd_<ulid>
    endpoint_id     TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    payload         JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    response_status INT,
    response_body   TEXT,
    attempt_count   INT NOT NULL DEFAULT 0,
    duration_ms     INT NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_endpoint_id ON webhook_deliveries(endpoint_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);

-- ==================== Subscriptions ====================
CREATE TABLE subscriptions (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id               TEXT NOT NULL DEFAULT 'hobby',
    status                TEXT NOT NULL DEFAULT 'active',
    provider              TEXT NOT NULL DEFAULT 'stripe',
    provider_subscription_id TEXT,
    provider_customer_id  TEXT,
    current_period_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
    amount_cents          INT NOT NULL DEFAULT 0,
    currency              TEXT NOT NULL DEFAULT 'usd',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

-- ==================== Daily Stats (materialized for performance) ====================
CREATE TABLE daily_stats (
    id              BIGSERIAL PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    uploads         INT NOT NULL DEFAULT 0,
    downloads       INT NOT NULL DEFAULT 0,
    storage_bytes   BIGINT NOT NULL DEFAULT 0,
    bandwidth_bytes BIGINT NOT NULL DEFAULT 0,
    api_requests    INT NOT NULL DEFAULT 0,
    UNIQUE(project_id, date)
);

CREATE INDEX idx_daily_stats_project_date ON daily_stats(project_id, date DESC);
