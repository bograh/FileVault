-- name: UpsertUsageRecord :one
INSERT INTO usage_records (project_id, period_start, period_end, storage_bytes, bandwidth_bytes, api_requests, file_count)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (project_id, period_start, period_end)
DO UPDATE SET
    storage_bytes = usage_records.storage_bytes + EXCLUDED.storage_bytes,
    bandwidth_bytes = usage_records.bandwidth_bytes + EXCLUDED.bandwidth_bytes,
    api_requests = usage_records.api_requests + EXCLUDED.api_requests,
    file_count = EXCLUDED.file_count,
    recorded_at = NOW()
RETURNING *;

-- name: GetCurrentUsage :one
SELECT * FROM usage_records
WHERE project_id = $1 AND period_start <= NOW() AND period_end >= NOW()
ORDER BY recorded_at DESC
LIMIT 1;

-- name: UpsertDailyStat :exec
INSERT INTO daily_stats (project_id, date, uploads, downloads, storage_bytes, bandwidth_bytes, api_requests)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (project_id, date)
DO UPDATE SET
    uploads = daily_stats.uploads + EXCLUDED.uploads,
    downloads = daily_stats.downloads + EXCLUDED.downloads,
    storage_bytes = EXCLUDED.storage_bytes,
    bandwidth_bytes = daily_stats.bandwidth_bytes + EXCLUDED.bandwidth_bytes,
    api_requests = daily_stats.api_requests + EXCLUDED.api_requests;

-- name: GetDailyStats :many
SELECT * FROM daily_stats
WHERE project_id = $1 AND date >= $2 AND date <= $3
ORDER BY date ASC;

-- name: GetDailyStatsByOwner :many
SELECT ds.* FROM daily_stats ds
JOIN projects p ON p.id = ds.project_id
WHERE p.owner_id = $1 AND ds.date >= $2 AND ds.date <= $3
ORDER BY ds.date ASC;
