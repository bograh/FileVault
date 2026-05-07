-- Reverse 002_add_unique_constraints.up.sql

DROP INDEX IF EXISTS idx_uploads_deleted_at;
DROP INDEX IF EXISTS idx_webhook_deliveries_next_retry;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS uq_subscriptions_user_id;
ALTER TABLE usage_records DROP CONSTRAINT IF EXISTS uq_usage_records_project_period;
