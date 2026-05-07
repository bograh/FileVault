package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

// mockRedis is an in-memory implementation for testing.
type mockRedis struct {
	mu      sync.Mutex
	data    map[string]int64
	expires map[string]time.Time
}

func newMockRedis() *mockRedis {
	return &mockRedis{
		data:    make(map[string]int64),
		expires: make(map[string]time.Time),
	}
}

func (m *mockRedis) Incr(_ context.Context, key string) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if expired
	if exp, ok := m.expires[key]; ok && time.Now().After(exp) {
		delete(m.data, key)
		delete(m.expires, key)
	}

	m.data[key]++
	return m.data[key], nil
}

func (m *mockRedis) Expire(_ context.Context, key string, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.expires[key] = time.Now().Add(ttl)
	return nil
}

func (m *mockRedis) TTL(_ context.Context, key string) (time.Duration, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	exp, ok := m.expires[key]
	if !ok {
		return -1, nil
	}
	remaining := time.Until(exp)
	if remaining < 0 {
		return 0, nil
	}
	return remaining, nil
}

func TestRateLimitMiddleware(t *testing.T) {
	redis := newMockRedis()
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	limiter := RateLimit(redis, RateLimitConfig{
		Limit:  5,
		Window: 1 * time.Minute,
		KeyFunc: func(r *http.Request) string {
			return "ip:" + r.RemoteAddr
		},
	})

	wrapped := limiter(handler)

	t.Run("allows_under_limit", func(t *testing.T) {
		for i := 0; i < 5; i++ {
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			w := httptest.NewRecorder()
			wrapped.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("request %d: expected 200, got %d", i+1, w.Code)
			}

			remaining := w.Header().Get("X-RateLimit-Remaining")
			if remaining == "" {
				t.Error("X-RateLimit-Remaining header missing")
			}
		}
	})

	t.Run("blocks_over_limit", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		w := httptest.NewRecorder()
		wrapped.ServeHTTP(w, req)

		if w.Code != http.StatusTooManyRequests {
			t.Errorf("expected 429, got %d", w.Code)
		}

		retryAfter := w.Header().Get("Retry-After")
		if retryAfter == "" {
			t.Error("Retry-After header missing")
		}
	})

	t.Run("nil_redis_allows_all", func(t *testing.T) {
		nilLimiter := RateLimit(nil, RateLimitConfig{
			Limit:  1,
			Window: 1 * time.Minute,
			KeyFunc: func(r *http.Request) string {
				return "test"
			},
		})
		wrapped := nilLimiter(handler)

		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			w := httptest.NewRecorder()
			wrapped.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("nil redis should allow all requests, got %d", w.Code)
			}
		}
	})
}
