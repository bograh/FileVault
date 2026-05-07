-- name: CreateSubscription :one
INSERT INTO subscriptions (
    id, user_id, plan_id, status, provider, provider_subscription_id,
    provider_customer_id, current_period_start, current_period_end,
    cancel_at_period_end, amount_cents, currency, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
RETURNING *;

-- name: GetSubscriptionByUserID :one
SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1;

-- name: UpdateSubscription :one
UPDATE subscriptions
SET plan_id = COALESCE(sqlc.narg('plan_id'), plan_id),
    status = COALESCE(sqlc.narg('status'), status),
    provider_subscription_id = COALESCE(sqlc.narg('provider_subscription_id'), provider_subscription_id),
    current_period_start = COALESCE(sqlc.narg('current_period_start'), current_period_start),
    current_period_end = COALESCE(sqlc.narg('current_period_end'), current_period_end),
    cancel_at_period_end = COALESCE(sqlc.narg('cancel_at_period_end'), cancel_at_period_end),
    amount_cents = COALESCE(sqlc.narg('amount_cents'), amount_cents),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetSubscriptionByProviderID :one
SELECT * FROM subscriptions WHERE provider_subscription_id = $1;
