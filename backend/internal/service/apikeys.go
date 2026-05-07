package service

import (
	"context"
	"fmt"
	"time"

	"github.com/filevault/backend/internal/domain"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oklog/ulid/v2"
)

type APIKeyService struct {
	db   *pgxpool.Pool
	auth *AuthService
}

func NewAPIKeyService(db *pgxpool.Pool, auth *AuthService) *APIKeyService {
	return &APIKeyService{db: db, auth: auth}
}

type CreateAPIKeyParams struct {
	ProjectID   string
	Name        string
	Scopes      []string
	Environment string
}

func (s *APIKeyService) Create(ctx context.Context, params CreateAPIKeyParams) (*domain.ApiKey, error) {
	keyID := "key_" + ulid.Make().String()
	plaintext := GenerateAPIKeyPlaintext(params.Environment)
	keyHash := s.auth.HashAPIKey(plaintext)
	keyPrefix := plaintext[:11] // e.g. "fv_live_abc"

	_, err := s.db.Exec(ctx,
		`INSERT INTO api_keys (id, project_id, name, key_hash, key_prefix, scopes, environment, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
		keyID, params.ProjectID, params.Name, keyHash, keyPrefix, params.Scopes, params.Environment)
	if err != nil {
		return nil, fmt.Errorf("creating API key: %w", err)
	}

	return &domain.ApiKey{
		ID:          keyID,
		ProjectID:   params.ProjectID,
		Name:        params.Name,
		KeyPrefix:   keyPrefix,
		FullKey:     plaintext, // Only returned once
		Scopes:      toApiKeyScopes(params.Scopes),
		Environment: params.Environment,
		IPAllowlist: []string{},
		CreatedAt:   time.Now(),
	}, nil
}

func (s *APIKeyService) List(ctx context.Context, projectID string) ([]domain.ApiKey, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, project_id, name, key_prefix, scopes, environment,
		 ip_allowlist, last_used_at, expires_at, revoked_at, created_at
		 FROM api_keys WHERE project_id = $1 ORDER BY created_at DESC`,
		projectID)
	if err != nil {
		return nil, fmt.Errorf("listing API keys: %w", err)
	}
	defer rows.Close()

	var keys []domain.ApiKey
	for rows.Next() {
		var k domain.ApiKey
		var scopes []string
		err := rows.Scan(
			&k.ID, &k.ProjectID, &k.Name, &k.KeyPrefix, &scopes,
			&k.Environment, &k.IPAllowlist, &k.LastUsedAt, &k.ExpiresAt,
			&k.RevokedAt, &k.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning API key: %w", err)
		}
		k.Scopes = toApiKeyScopes(scopes)
		if k.IPAllowlist == nil {
			k.IPAllowlist = []string{}
		}
		keys = append(keys, k)
	}
	if keys == nil {
		keys = []domain.ApiKey{}
	}
	return keys, nil
}

func (s *APIKeyService) Revoke(ctx context.Context, projectID, keyID string) error {
	result, err := s.db.Exec(ctx,
		`UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND project_id = $2`,
		keyID, projectID)
	if err != nil {
		return fmt.Errorf("revoking API key: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("API key not found")
	}
	return nil
}

func toApiKeyScopes(scopes []string) []domain.ApiKeyScope {
	result := make([]domain.ApiKeyScope, len(scopes))
	for i, s := range scopes {
		result[i] = domain.ApiKeyScope(s)
	}
	return result
}
