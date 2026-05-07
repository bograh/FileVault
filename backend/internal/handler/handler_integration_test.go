package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/filevault/backend/internal/config"
	"github.com/filevault/backend/internal/handler"
	"github.com/filevault/backend/internal/router"
	"github.com/filevault/backend/internal/service"
	"github.com/jackc/pgx/v5/pgxpool"
)

// skipIfNoDatabase skips the test if DATABASE_URL is not set.
func skipIfNoDatabase(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set — skipping integration test")
	}

	db, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		t.Fatalf("connecting to database: %v", err)
	}
	if err := db.Ping(context.Background()); err != nil {
		t.Fatalf("pinging database: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func setupRouter(t *testing.T, db *pgxpool.Pool) http.Handler {
	t.Helper()

	cfg := &config.Config{
		Server: config.ServerConfig{
			CORSOrigins: []string{"*"},
		},
		Auth: config.AuthConfig{
			HMACSecret:    "test-secret-32-bytes-minimum!!!!",
			SessionSecret: "test-session-secret",
		},
	}

	authSvc := service.NewAuthService(db, cfg.Auth)
	projectSvc := service.NewProjectService(db)
	uploadSvc := service.NewUploadService(db, nil)
	apikeySvc := service.NewAPIKeyService(db, authSvc)
	webhookSvc := service.NewWebhookService(db)
	billingSvc := service.NewBillingService(db)
	dashboardSvc := service.NewDashboardService(db, projectSvc)
	healthH := handler.NewHealthHandler(db)

	return router.New(router.Deps{
		Config:    cfg,
		Logger:    nil,
		Auth:      authSvc,
		Projects:  projectSvc,
		Uploads:   uploadSvc,
		APIKeys:   apikeySvc,
		Webhooks:  webhookSvc,
		Billing:   billingSvc,
		Dashboard: dashboardSvc,
		Health:    healthH,
	})
}

func TestHealthEndpoints(t *testing.T) {
	db := skipIfNoDatabase(t)
	r := setupRouter(t, db)

	t.Run("liveness", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", w.Code)
		}
	})

	t.Run("readiness", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})
}

func TestAuthFlow(t *testing.T) {
	db := skipIfNoDatabase(t)
	r := setupRouter(t, db)

	// Cleanup test user
	t.Cleanup(func() {
		db.Exec(context.Background(), "DELETE FROM users WHERE email = 'integrationtest@filevault.io'")
	})

	var sessionCookie string

	t.Run("signup", func(t *testing.T) {
		body := map[string]string{
			"name":     "Integration Test",
			"email":    "integrationtest@filevault.io",
			"password": "SecurePass123!",
			"country":  "US",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/v1/auth/signup", bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
		}

		// Extract session cookie
		for _, c := range w.Result().Cookies() {
			if c.Name == "session_token" {
				sessionCookie = c.Value
			}
		}
		if sessionCookie == "" {
			t.Fatal("no session cookie returned on signup")
		}
	})

	t.Run("me", func(t *testing.T) {
		if sessionCookie == "" {
			t.Skip("no session from signup")
		}
		req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
		req.AddCookie(&http.Cookie{Name: "session_token", Value: sessionCookie})
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Data struct {
				Email string `json:"email"`
			} `json:"data"`
		}
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp.Data.Email != "integrationtest@filevault.io" {
			t.Errorf("unexpected email: %s", resp.Data.Email)
		}
	})

	t.Run("login_wrong_password", func(t *testing.T) {
		body := map[string]string{
			"email":    "integrationtest@filevault.io",
			"password": "WrongPass!",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/v1/auth/login", bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("login_correct", func(t *testing.T) {
		body := map[string]string{
			"email":    "integrationtest@filevault.io",
			"password": "SecurePass123!",
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/v1/auth/login", bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("unauthenticated_me", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", w.Code)
		}
	})
}

func TestProjectCRUD(t *testing.T) {
	db := skipIfNoDatabase(t)
	r := setupRouter(t, db)

	// Create a test user first
	t.Cleanup(func() {
		db.Exec(context.Background(), "DELETE FROM projects WHERE owner_id IN (SELECT id FROM users WHERE email = 'projecttest@filevault.io')")
		db.Exec(context.Background(), "DELETE FROM users WHERE email = 'projecttest@filevault.io'")
	})

	// Signup
	signupBody, _ := json.Marshal(map[string]string{
		"name": "Project Test", "email": "projecttest@filevault.io",
		"password": "TestPass123!", "country": "US",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/signup", bytes.NewReader(signupBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("signup failed: %d %s", w.Code, w.Body.String())
	}

	var sessionCookie string
	for _, c := range w.Result().Cookies() {
		if c.Name == "session_token" {
			sessionCookie = c.Value
		}
	}

	authedRequest := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		var b []byte
		if body != nil {
			b, _ = json.Marshal(body)
		}
		req := httptest.NewRequest(method, path, bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: "session_token", Value: sessionCookie})
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}

	var projectID string

	t.Run("create_project", func(t *testing.T) {
		w := authedRequest(http.MethodPost, "/v1/projects", map[string]interface{}{
			"name":            "Test Project",
			"slug":            "test-project-int",
			"storage_region":  "us-east-1",
			"storage_backend": "s3",
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Data struct {
				ID   string `json:"id"`
				Name string `json:"name"`
				Slug string `json:"slug"`
			} `json:"data"`
		}
		json.Unmarshal(w.Body.Bytes(), &resp)
		projectID = resp.Data.ID
		if projectID == "" {
			t.Fatal("project ID is empty")
		}
		if resp.Data.Slug != "test-project-int" {
			t.Errorf("unexpected slug: %s", resp.Data.Slug)
		}
	})

	t.Run("list_projects", func(t *testing.T) {
		w := authedRequest(http.MethodGet, "/v1/projects", nil)
		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", w.Code)
		}
	})

	t.Run("get_project", func(t *testing.T) {
		if projectID == "" {
			t.Skip("no project created")
		}
		w := authedRequest(http.MethodGet, "/v1/projects/"+projectID, nil)
		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("update_project", func(t *testing.T) {
		if projectID == "" {
			t.Skip("no project created")
		}
		w := authedRequest(http.MethodPatch, "/v1/projects/"+projectID, map[string]string{
			"name": "Updated Project",
		})
		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("delete_project", func(t *testing.T) {
		if projectID == "" {
			t.Skip("no project created")
		}
		w := authedRequest(http.MethodDelete, "/v1/projects/"+projectID, nil)
		if w.Code != http.StatusNoContent && w.Code != http.StatusOK {
			t.Errorf("expected 204 or 200, got %d: %s", w.Code, w.Body.String())
		}
	})
}

func TestBillingPlans(t *testing.T) {
	db := skipIfNoDatabase(t)
	r := setupRouter(t, db)

	// Signup for auth
	t.Cleanup(func() {
		db.Exec(context.Background(), "DELETE FROM users WHERE email = 'billingtest@filevault.io'")
	})
	signupBody, _ := json.Marshal(map[string]string{
		"name": "Billing Test", "email": "billingtest@filevault.io",
		"password": "TestPass123!", "country": "US",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/signup", bytes.NewReader(signupBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var sessionCookie string
	for _, c := range w.Result().Cookies() {
		if c.Name == "session_token" {
			sessionCookie = c.Value
		}
	}

	t.Run("list_plans", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/billing/plans", nil)
		req.AddCookie(&http.Cookie{Name: "session_token", Value: sessionCookie})
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Data []map[string]interface{} `json:"data"`
		}
		json.Unmarshal(w.Body.Bytes(), &resp)
		if len(resp.Data) != 4 {
			t.Errorf("expected 4 plans, got %d", len(resp.Data))
		}
	})

	t.Run("get_subscription", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/billing/subscription", nil)
		req.AddCookie(&http.Cookie{Name: "session_token", Value: sessionCookie})
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})
}
