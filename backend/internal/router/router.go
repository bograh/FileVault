package router

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/filevault/backend/internal/billing"
	"github.com/filevault/backend/internal/config"
	"github.com/filevault/backend/internal/handler"
	"github.com/filevault/backend/internal/middleware"
	"github.com/filevault/backend/internal/service"
)

type Deps struct {
	Config    *config.Config
	Logger    *slog.Logger
	Auth      *service.AuthService
	Projects  *service.ProjectService
	Uploads   *service.UploadService
	APIKeys   *service.APIKeyService
	Webhooks  *service.WebhookService
	Billing   *service.BillingService
	Dashboard *service.DashboardService
	Health    *handler.HealthHandler
	Redis     middleware.RedisClient // nil = rate limiting disabled
	Stripe    billing.BillingProvider
	Paystack  billing.BillingProvider
}

func New(deps Deps) http.Handler {
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger(deps.Logger))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   deps.Config.Server.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID", "X-Project-Token", "X-CSRF-Token"},
		ExposedHeaders:   []string{"X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Global rate limit (IP-based, 100 req/min for unauthenticated)
	r.Use(middleware.RateLimit(deps.Redis, middleware.RateLimitConfig{
		Limit:   100,
		Window:  1 * time.Minute,
		KeyFunc: middleware.IPKeyFunc,
	}))

	// Handlers
	authHandler := handler.NewAuthHandler(deps.Auth)
	projectHandler := handler.NewProjectHandler(deps.Projects)
	uploadHandler := handler.NewUploadHandler(deps.Uploads, deps.Projects)
	apikeyHandler := handler.NewAPIKeyHandler(deps.APIKeys, deps.Projects)
	webhookHandler := handler.NewWebhookHandler(deps.Webhooks, deps.Projects)
	billingHandler := handler.NewBillingHandler(deps.Billing)
	dashboardHandler := handler.NewDashboardHandler(deps.Dashboard)
	billingWebhookHandler := handler.NewBillingWebhookHandler(deps.Stripe, deps.Paystack)

	// Documentation (no auth)
	docsHandler := handler.NewDocsHandler()
	r.Get("/docs", docsHandler.SwaggerUI)
	r.Get("/docs/openapi.yaml", docsHandler.Spec)

	// Health endpoints (no auth)
	r.Get("/health", deps.Health.Live)
	r.Get("/health/ready", deps.Health.Ready)

	// Billing provider webhooks (no auth — signature-verified internally)
	r.Post("/webhooks/stripe", billingWebhookHandler.StripeWebhook)
	r.Post("/webhooks/paystack", billingWebhookHandler.PaystackWebhook)

	// API v1 routes
	r.Route("/v1", func(r chi.Router) {
		// Auth routes (no auth required, stricter rate limit)
		r.Group(func(r chi.Router) {
			r.Use(middleware.RateLimit(deps.Redis, middleware.RateLimitConfig{
				Limit:   10,
				Window:  1 * time.Minute,
				KeyFunc: middleware.IPKeyFunc,
			}))
			r.Post("/auth/login", authHandler.Login)
			r.Post("/auth/signup", authHandler.Signup)
		})

		// Authenticated routes (session or API key)
		r.Group(func(r chi.Router) {
			r.Use(middleware.SessionAuth(deps.Auth.ValidateSession))
			r.Use(middleware.RateLimit(deps.Redis, middleware.RateLimitConfig{
				Limit:   1000,
				Window:  1 * time.Minute,
				KeyFunc: middleware.UserKeyFunc,
			}))

			// Auth
			r.Get("/auth/me", authHandler.Me)
			r.Post("/auth/logout", authHandler.Logout)

			// Dashboard
			r.Get("/dashboard/overview", dashboardHandler.Overview)

			// Projects
			r.Get("/projects", projectHandler.List)
			r.Post("/projects", projectHandler.Create)
			r.Get("/projects/{projectId}", projectHandler.Get)
			r.Patch("/projects/{projectId}", projectHandler.Update)
			r.Delete("/projects/{projectId}", projectHandler.Delete)
			r.Get("/projects/{projectId}/usage", projectHandler.Usage)
			r.Get("/projects/{projectId}/stats", projectHandler.Stats)

			// Uploads
			r.Get("/projects/{projectId}/uploads", uploadHandler.List)
			r.Post("/projects/{projectId}/uploads", uploadHandler.Create)
			r.Get("/projects/{projectId}/uploads/{uploadId}", uploadHandler.Get)
			r.Delete("/projects/{projectId}/uploads/{uploadId}", uploadHandler.Delete)
			r.Post("/projects/{projectId}/uploads/{uploadId}/complete", uploadHandler.Complete)
			r.Get("/projects/{projectId}/uploads/{uploadId}/url", uploadHandler.SignedURL)
			r.Post("/projects/{projectId}/uploads/batch-delete", uploadHandler.DeleteMany)

			// API Keys
			r.Get("/projects/{projectId}/keys", apikeyHandler.List)
			r.Post("/projects/{projectId}/keys", apikeyHandler.Create)
			r.Delete("/projects/{projectId}/keys/{keyId}", apikeyHandler.Revoke)

			// Webhooks
			r.Get("/projects/{projectId}/webhooks", webhookHandler.List)
			r.Post("/projects/{projectId}/webhooks", webhookHandler.Create)
			r.Patch("/projects/{projectId}/webhooks/{webhookId}", webhookHandler.Update)
			r.Delete("/projects/{projectId}/webhooks/{webhookId}", webhookHandler.Delete)
			r.Get("/projects/{projectId}/webhooks/{webhookId}/deliveries", webhookHandler.Deliveries)
			r.Post("/projects/{projectId}/webhooks/{webhookId}/test", webhookHandler.SendTest)

			// Billing
			r.Get("/billing/plans", billingHandler.Plans)
			r.Get("/billing/subscription", billingHandler.Subscription)
			r.Get("/billing/invoices", billingHandler.Invoices)
			r.Post("/billing/checkout", billingHandler.Checkout)
			r.Post("/billing/portal", billingHandler.Portal)
			r.Post("/billing/change-plan", billingHandler.ChangePlan)
		})
	})

	return r
}
