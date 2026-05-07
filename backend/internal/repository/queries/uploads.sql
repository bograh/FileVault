-- name: CreateUpload :one
INSERT INTO uploads (
    id, project_id, filename, content_type, size_bytes, storage_key,
    status, acl, folder, metadata, created_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
RETURNING *;

-- name: GetUploadByID :one
SELECT * FROM uploads WHERE id = $1 AND project_id = $2;

-- name: ListUploads :many
SELECT * FROM uploads
WHERE project_id = $1
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('folder')::text IS NULL OR folder = sqlc.narg('folder'))
  AND (sqlc.narg('search')::text IS NULL OR
       filename ILIKE '%' || sqlc.narg('search') || '%' OR
       content_type ILIKE '%' || sqlc.narg('search') || '%')
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountUploads :one
SELECT COUNT(*) FROM uploads
WHERE project_id = $1
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('folder')::text IS NULL OR folder = sqlc.narg('folder'))
  AND (sqlc.narg('search')::text IS NULL OR
       filename ILIKE '%' || sqlc.narg('search') || '%' OR
       content_type ILIKE '%' || sqlc.narg('search') || '%')
  AND deleted_at IS NULL;

-- name: UpdateUploadStatus :one
UPDATE uploads
SET status = $3,
    completed_at = CASE WHEN $3 = 'completed' THEN NOW() ELSE completed_at END,
    checksum_sha256 = COALESCE(sqlc.narg('checksum_sha256'), checksum_sha256)
WHERE id = $1 AND project_id = $2
RETURNING *;

-- name: SoftDeleteUpload :exec
UPDATE uploads SET deleted_at = NOW(), status = 'deleted'
WHERE id = $1 AND project_id = $2;

-- name: SoftDeleteUploads :exec
UPDATE uploads SET deleted_at = NOW(), status = 'deleted'
WHERE id = ANY($1::text[]) AND project_id = $2;

-- name: HardDeleteExpiredUploads :many
DELETE FROM uploads
WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'
RETURNING storage_key;

-- name: CountFilesByProject :one
SELECT COUNT(*) FROM uploads WHERE project_id = $1 AND status = 'completed' AND deleted_at IS NULL;

-- name: SumStorageByProject :one
SELECT COALESCE(SUM(size_bytes), 0)::bigint FROM uploads
WHERE project_id = $1 AND status = 'completed' AND deleted_at IS NULL;

-- name: GetRecentUploads :many
SELECT * FROM uploads
WHERE deleted_at IS NULL AND status != 'deleted'
ORDER BY created_at DESC
LIMIT $1;

-- name: GetRecentUploadsByOwner :many
SELECT u.* FROM uploads u
JOIN projects p ON p.id = u.project_id
WHERE p.owner_id = $1 AND u.deleted_at IS NULL AND u.status != 'deleted'
ORDER BY u.created_at DESC
LIMIT $2;
