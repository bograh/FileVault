package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/filevault/backend/internal/config"
	"github.com/filevault/backend/internal/domain"
	"github.com/filevault/backend/internal/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oklog/ulid/v2"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserExists         = errors.New("user already exists")
	ErrSessionExpired     = errors.New("session expired")
	ErrInvalidAPIKey      = errors.New("invalid API key")
)

type AuthService struct {
	db     *pgxpool.Pool
	cfg    config.AuthConfig
	secret []byte
}

func NewAuthService(db *pgxpool.Pool, cfg config.AuthConfig) *AuthService {
	return &AuthService{
		db:     db,
		cfg:    cfg,
		secret: []byte(cfg.HMACSecret),
	}
}

func (s *AuthService) Signup(ctx context.Context, name, email, password, country string) (*domain.Session, error) {
	// Check if user exists
	var exists bool
	err := s.db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("checking user exists: %w", err)
	}
	if exists {
		return nil, ErrUserExists
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	userID := "usr_" + ulid.Make().String()
	user := &domain.User{
		ID:               userID,
		Name:             name,
		Email:            email,
		Country:          country,
		TwoFactorEnabled: false,
		CreatedAt:        time.Now(),
	}

	_, err = s.db.Exec(ctx,
		`INSERT INTO users (id, name, email, password_hash, country, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
		userID, name, email, string(hash), country)
	if err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}

	// Create default subscription (hobby tier)
	subID := "sub_" + ulid.Make().String()
	now := time.Now()
	periodEnd := now.AddDate(0, 1, 0)
	_, err = s.db.Exec(ctx,
		`INSERT INTO subscriptions (id, user_id, plan_id, status, provider, current_period_start, current_period_end, amount_cents, currency, created_at, updated_at)
		 VALUES ($1, $2, 'hobby', 'active', 'stripe', $3, $4, 0, 'usd', NOW(), NOW())`,
		subID, userID, now, periodEnd)
	if err != nil {
		return nil, fmt.Errorf("creating subscription: %w", err)
	}

	// Create session
	session, err := s.createSession(ctx, user)
	if err != nil {
		return nil, err
	}
	return session, nil
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*domain.Session, bool, error) {
	var user domain.User
	var passwordHash string
	err := s.db.QueryRow(ctx,
		`SELECT id, name, email, password_hash, avatar_url, country, two_factor_enabled, created_at
		 FROM users WHERE email = $1`, email).Scan(
		&user.ID, &user.Name, &user.Email, &passwordHash,
		&user.AvatarURL, &user.Country, &user.TwoFactorEnabled, &user.CreatedAt,
	)
	if err != nil {
		return nil, false, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return nil, false, ErrInvalidCredentials
	}

	// If 2FA enabled, return challenge indicator
	if user.TwoFactorEnabled {
		return nil, true, nil
	}

	session, err := s.createSession(ctx, &user)
	if err != nil {
		return nil, false, err
	}
	return session, false, nil
}

func (s *AuthService) GetMe(ctx context.Context, userID string) (*domain.User, error) {
	var user domain.User
	err := s.db.QueryRow(ctx,
		`SELECT id, name, email, avatar_url, country, two_factor_enabled, created_at
		 FROM users WHERE id = $1`, userID).Scan(
		&user.ID, &user.Name, &user.Email, &user.AvatarURL,
		&user.Country, &user.TwoFactorEnabled, &user.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("getting user: %w", err)
	}
	return &user, nil
}

func (s *AuthService) ValidateSession(token string) (*middleware.AuthenticatedUser, error) {
	tokenHash := s.hashToken(token)
	ctx := context.Background()

	var userID, userName, userEmail string
	var expiresAt time.Time
	err := s.db.QueryRow(ctx,
		`SELECT s.user_id, u.name, u.email, s.expires_at
		 FROM sessions s JOIN users u ON u.id = s.user_id
		 WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
		tokenHash).Scan(&userID, &userName, &userEmail, &expiresAt)
	if err != nil {
		return nil, ErrSessionExpired
	}

	return &middleware.AuthenticatedUser{
		UserID:   userID,
		Scopes:   []string{"admin"},
		AuthType: "session",
	}, nil
}

func (s *AuthService) ValidateAPIKey(key string) (*middleware.AuthenticatedUser, error) {
	keyHash := s.HashAPIKey(key)
	ctx := context.Background()

	var keyID, projectID string
	var scopes []string
	var revokedAt *time.Time
	var expiresAt *time.Time

	err := s.db.QueryRow(ctx,
		`SELECT id, project_id, scopes, revoked_at, expires_at
		 FROM api_keys WHERE key_hash = $1`,
		keyHash).Scan(&keyID, &projectID, &scopes, &revokedAt, &expiresAt)
	if err != nil {
		return nil, ErrInvalidAPIKey
	}

	if revokedAt != nil {
		return nil, ErrInvalidAPIKey
	}
	if expiresAt != nil && time.Now().After(*expiresAt) {
		return nil, ErrInvalidAPIKey
	}

	// Update last_used_at async
	go func() {
		s.db.Exec(context.Background(), "UPDATE api_keys SET last_used_at = NOW() WHERE id = $1", keyID)
	}()

	return &middleware.AuthenticatedUser{
		UserID:    "", // API keys don't have a user, they have a project
		ProjectID: projectID,
		Scopes:    scopes,
		AuthType:  "api_key",
	}, nil
}

func (s *AuthService) Logout(ctx context.Context, token string) error {
	tokenHash := s.hashToken(token)
	_, err := s.db.Exec(ctx, "DELETE FROM sessions WHERE token_hash = $1", tokenHash)
	return err
}

func (s *AuthService) createSession(ctx context.Context, user *domain.User) (*domain.Session, error) {
	token := generateToken(32)
	tokenHash := s.hashToken(token)
	sessionID := "sess_" + ulid.Make().String()
	expiresAt := time.Now().Add(s.cfg.SessionTTL)

	_, err := s.db.Exec(ctx,
		`INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
		 VALUES ($1, $2, $3, $4, NOW())`,
		sessionID, user.ID, tokenHash, expiresAt)
	if err != nil {
		return nil, fmt.Errorf("creating session: %w", err)
	}

	// Store the plain token in the session response — frontend stores it
	user.PasswordHash = token // Reuse field temporarily to pass token to handler

	return &domain.Session{
		User:      user,
		ExpiresAt: expiresAt.Format(time.RFC3339),
	}, nil
}

func (s *AuthService) HashAPIKey(key string) string {
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(key))
	return hex.EncodeToString(mac.Sum(nil))
}

func (s *AuthService) hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func generateToken(bytes int) string {
	b := make([]byte, bytes)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// GenerateAPIKeyPlaintext creates a new API key in the format fv_{env}_{random}
func GenerateAPIKeyPlaintext(environment string) string {
	b := make([]byte, 32)
	rand.Read(b)
	return fmt.Sprintf("fv_%s_%s", environment, hex.EncodeToString(b))
}
