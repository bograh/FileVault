package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

// RedisClient is the minimal interface needed for rate limiting.
type RedisClient interface {
	Incr(ctx context.Context, key string) (int64, error)
	Expire(ctx context.Context, key string, ttl time.Duration) error
	TTL(ctx context.Context, key string) (time.Duration, error)
}

// RateLimitConfig defines rate limiting parameters.
type RateLimitConfig struct {
	// Requests per window
	Limit int
	// Window duration
	Window time.Duration
	// KeyFunc extracts the rate limit key from the request (e.g. IP, user ID).
	KeyFunc func(r *http.Request) string
}

// RateLimit returns middleware that applies Redis-backed sliding window rate limiting.
func RateLimit(redis RedisClient, cfg RateLimitConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if redis == nil {
				next.ServeHTTP(w, r)
				return
			}

			key := "rl:" + cfg.KeyFunc(r)
			ctx := r.Context()

			count, err := redis.Incr(ctx, key)
			if err != nil {
				// On Redis failure, allow the request (fail-open)
				next.ServeHTTP(w, r)
				return
			}

			// Set expiry on first request in window
			if count == 1 {
				redis.Expire(ctx, key, cfg.Window)
			}

			// Get remaining TTL for headers
			ttl, _ := redis.TTL(ctx, key)
			remaining := cfg.Limit - int(count)
			if remaining < 0 {
				remaining = 0
			}

			// Always set rate limit headers
			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(cfg.Limit))
			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(ttl).Unix(), 10))

			if int(count) > cfg.Limit {
				w.Header().Set("Retry-After", strconv.Itoa(int(ttl.Seconds())))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				fmt.Fprintf(w, `{"error":{"code":"RATE_LIMITED","message":"Too many requests. Try again in %d seconds.","docs_url":"https://docs.filevault.io/errors/RATE_LIMITED"}}`, int(ttl.Seconds()))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// IPKeyFunc extracts client IP for rate limiting.
func IPKeyFunc(r *http.Request) string {
	return "ip:" + r.RemoteAddr
}

// UserKeyFunc extracts user ID for rate limiting authenticated routes.
func UserKeyFunc(r *http.Request) string {
	user := GetUser(r.Context())
	if user != nil {
		return "user:" + user.UserID
	}
	return "ip:" + r.RemoteAddr
}

// APIKeyKeyFunc extracts the API key project for rate limiting.
func APIKeyKeyFunc(r *http.Request) string {
	user := GetUser(r.Context())
	if user != nil && user.ProjectID != "" {
		return "project:" + user.ProjectID
	}
	return "ip:" + r.RemoteAddr
}
