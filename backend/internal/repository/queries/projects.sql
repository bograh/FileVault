-- name: CreateProject :one
INSERT INTO projects (
    id, owner_id, name, slug, description, storage_region, storage_backend,
    bucket_prefix, max_file_size_bytes, allowed_mime_types, versioning_enabled,
    billing_provider, subscription_tier, subscription_status, created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
)
RETURNING *;

-- name: GetProjectByID :one
SELECT * FROM projects WHERE id = $1;

-- name: GetProjectBySlug :one
SELECT * FROM projects WHERE slug = $1;

-- name: ListProjectsByOwner :many
SELECT * FROM projects WHERE owner_id = $1 ORDER BY created_at DESC;

-- name: UpdateProject :one
UPDATE projects
SET name = COALESCE(sqlc.narg('name'), name),
    description = COALESCE(sqlc.narg('description'), description),
    max_file_size_bytes = COALESCE(sqlc.narg('max_file_size_bytes'), max_file_size_bytes),
    allowed_mime_types = COALESCE(sqlc.narg('allowed_mime_types'), allowed_mime_types),
    versioning_enabled = COALESCE(sqlc.narg('versioning_enabled'), versioning_enabled),
    custom_domain = COALESCE(sqlc.narg('custom_domain'), custom_domain),
    subscription_tier = COALESCE(sqlc.narg('subscription_tier'), subscription_tier),
    subscription_status = COALESCE(sqlc.narg('subscription_status'), subscription_status),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteProject :exec
DELETE FROM projects WHERE id = $1;

-- name: CountProjectsByOwner :one
SELECT COUNT(*) FROM projects WHERE owner_id = $1;
