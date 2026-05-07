-- name: CreateUser :one
INSERT INTO users (id, name, email, password_hash, country, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: UpdateUser :one
UPDATE users
SET name = COALESCE(sqlc.narg('name'), name),
    email = COALESCE(sqlc.narg('email'), email),
    avatar_url = COALESCE(sqlc.narg('avatar_url'), avatar_url),
    two_factor_enabled = COALESCE(sqlc.narg('two_factor_enabled'), two_factor_enabled),
    two_factor_secret = COALESCE(sqlc.narg('two_factor_secret'), two_factor_secret),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CreateSession :one
INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
VALUES ($1, $2, $3, $4, NOW())
RETURNING *;

-- name: GetSessionByTokenHash :one
SELECT s.*, u.id as uid, u.name as uname, u.email as uemail, u.avatar_url as uavatar,
       u.country as ucountry, u.two_factor_enabled as u2fa, u.created_at as ucreated
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token_hash = $1 AND s.expires_at > NOW();

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = $1;

-- name: DeleteUserSessions :exec
DELETE FROM sessions WHERE user_id = $1;
