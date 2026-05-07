-- name: CreateWebhookEndpoint :one
INSERT INTO webhook_endpoints (id, project_id, url, events, secret, enabled, created_at)
VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
RETURNING *;

-- name: GetWebhookEndpointByID :one
SELECT * FROM webhook_endpoints WHERE id = $1 AND project_id = $2;

-- name: ListWebhookEndpointsByProject :many
SELECT * FROM webhook_endpoints WHERE project_id = $1 ORDER BY created_at DESC;

-- name: UpdateWebhookEndpoint :one
UPDATE webhook_endpoints
SET url = COALESCE(sqlc.narg('url'), url),
    events = COALESCE(sqlc.narg('events'), events),
    enabled = COALESCE(sqlc.narg('enabled'), enabled)
WHERE id = $1 AND project_id = $2
RETURNING *;

-- name: DeleteWebhookEndpoint :exec
DELETE FROM webhook_endpoints WHERE id = $1 AND project_id = $2;

-- name: GetWebhookEndpointsByEvent :many
SELECT * FROM webhook_endpoints
WHERE project_id = $1 AND enabled = TRUE AND $2 = ANY(events);

-- name: CreateWebhookDelivery :one
INSERT INTO webhook_deliveries (id, endpoint_id, event_type, payload, status, created_at)
VALUES ($1, $2, $3, $4, 'pending', NOW())
RETURNING *;

-- name: UpdateWebhookDelivery :one
UPDATE webhook_deliveries
SET status = $2,
    response_status = $3,
    response_body = $4,
    attempt_count = attempt_count + 1,
    duration_ms = $5,
    delivered_at = CASE WHEN $2 = 'succeeded' THEN NOW() ELSE delivered_at END,
    next_retry_at = $6
WHERE id = $1
RETURNING *;

-- name: ListWebhookDeliveriesByEndpoint :many
SELECT * FROM webhook_deliveries
WHERE endpoint_id = $1
ORDER BY created_at DESC
LIMIT 50;

-- name: GetPendingWebhookDeliveries :many
SELECT wd.*, we.url, we.secret
FROM webhook_deliveries wd
JOIN webhook_endpoints we ON we.id = wd.endpoint_id
WHERE wd.status = 'pending'
   OR (wd.status = 'failed' AND wd.attempt_count < 5 AND wd.next_retry_at <= NOW())
ORDER BY wd.created_at ASC
LIMIT 100;
