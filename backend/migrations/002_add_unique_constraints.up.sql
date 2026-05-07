-- Add UNIQUE constraints required by worker consumers and billing providers

-- usage_flusher uses ON CONFLICT (project_id, period_start, period_end)
ALTER TABLE usage_records
  ADD CONSTRAINT uq_usage_records_project_period
  UNIQUE (project_id, period_start, period_end);

-- billing providers use ON CONFLICT (user_id) for subscription upserts
ALTER TABLE subscriptions
  ADD CONSTRAINT uq_subscriptions_user_id
  UNIQUE (user_id);

-- Add index for webhook delivery retry scheduling
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry
  ON webhook_deliveries(next_retry_at)
  WHERE status = 'pending' AND next_retry_at IS NOT NULL;

-- Add index for cleanup worker (soft-deleted uploads)
CREATE INDEX IF NOT EXISTS idx_uploads_deleted_at
  ON uploads(deleted_at)
  WHERE deleted_at IS NOT NULL;
