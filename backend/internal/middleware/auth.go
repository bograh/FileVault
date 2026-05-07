package middleware

import (
	"context"
	"net/http"
	"strings"
)

type userContextKey struct{}
type projectContextKey struct{}

type AuthenticatedUser struct {
	UserID    string
	ProjectID string
	Scopes    []string
	AuthType  string // "session", "api_key", "project_token"
}

func SetUser(ctx context.Context, user *AuthenticatedUser) context.Context {
	return context.WithValue(ctx, userContextKey{}, user)
}

func GetUser(ctx context.Context) *AuthenticatedUser {
	if u, ok := ctx.Value(userContextKey{}).(*AuthenticatedUser); ok {
		return u
	}
	return nil
}

func SetProjectID(ctx context.Context, projectID string) context.Context {
	return context.WithValue(ctx, projectContextKey{}, projectID)
}

func GetProjectID(ctx context.Context) string {
	if id, ok := ctx.Value(projectContextKey{}).(string); ok {
		return id
	}
	return ""
}

// SessionAuth validates dashboard session cookies.
// It delegates to the AuthService for actual session validation.
type SessionAuthFunc func(token string) (*AuthenticatedUser, error)

func SessionAuth(validate SessionAuthFunc) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Try cookie first (dashboard)
			cookie, err := r.Cookie("session_token")
			if err != nil {
				// Try Authorization header
				auth := r.Header.Get("Authorization")
				if auth == "" {
					http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"Authentication required."}}`, http.StatusUnauthorized)
					return
				}
				token := strings.TrimPrefix(auth, "Bearer ")
				user, err := validate(token)
				if err != nil {
					http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"Invalid or expired token."}}`, http.StatusUnauthorized)
					return
				}
				ctx := SetUser(r.Context(), user)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			user, err := validate(cookie.Value)
			if err != nil {
				http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"Invalid or expired session."}}`, http.StatusUnauthorized)
				return
			}
			ctx := SetUser(r.Context(), user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// APIKeyAuth validates API key authentication from Authorization header.
type APIKeyAuthFunc func(key string) (*AuthenticatedUser, error)

func APIKeyAuth(validate APIKeyAuthFunc) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if auth == "" {
				// Try project token header
				token := r.Header.Get("X-Project-Token")
				if token == "" {
					http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"Authentication required."}}`, http.StatusUnauthorized)
					return
				}
				// Project token auth handled separately
				next.ServeHTTP(w, r)
				return
			}

			key := strings.TrimPrefix(auth, "Bearer ")
			user, err := validate(key)
			if err != nil {
				http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"Invalid API key."}}`, http.StatusUnauthorized)
				return
			}
			ctx := SetUser(r.Context(), user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireScope checks that the authenticated user has the required scope.
func RequireScope(scope string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := GetUser(r.Context())
			if user == nil {
				http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"Authentication required."}}`, http.StatusUnauthorized)
				return
			}

			// Admin scope has all permissions
			for _, s := range user.Scopes {
				if s == "admin" || s == scope {
					next.ServeHTTP(w, r)
					return
				}
			}

			http.Error(w, `{"error":{"code":"FORBIDDEN","message":"Insufficient permissions."}}`, http.StatusForbidden)
		})
	}
}
