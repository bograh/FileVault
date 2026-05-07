package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/filevault/backend/internal/billing"
	"github.com/filevault/backend/internal/cache"
	"github.com/filevault/backend/internal/config"
	"github.com/filevault/backend/internal/handler"
	"github.com/filevault/backend/internal/middleware"
	"github.com/filevault/backend/internal/router"
	"github.com/filevault/backend/internal/service"
	"github.com/filevault/backend/internal/storage"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("failed to load config", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// Database connection
	poolCfg, err := pgxpool.ParseConfig(cfg.DB.URL)
	if err != nil {
		logger.Error("failed to parse database URL", slog.String("error", err.Error()))
		os.Exit(1)
	}
	poolCfg.MaxConns = int32(cfg.DB.MaxOpenConns)
	poolCfg.MinConns = int32(cfg.DB.MaxIdleConns)

	db, err := pgxpool.NewWithConfig(context.Background(), poolCfg)
	if err != nil {
		logger.Error("failed to connect to database", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer db.Close()

	if err := db.Ping(context.Background()); err != nil {
		logger.Error("failed to ping database", slog.String("error", err.Error()))
		os.Exit(1)
	}
	logger.Info("connected to database")

	// Redis client (for rate limiting and caching)
	var redisClient middleware.RedisClient
	redis, err := cache.NewRedisClient(cfg.Redis.URL)
	if err != nil {
		logger.Warn("Redis unavailable — rate limiting disabled", slog.String("error", err.Error()))
	} else {
		redisClient = redis
		defer redis.Close()
		logger.Info("connected to Redis")
	}

	// Storage provider
	storageProvider, err := storage.NewS3Provider(cfg.Storage)
	if err != nil {
		logger.Warn("failed to init S3 storage (presigned URLs will fail)", slog.String("error", err.Error()))
	}

	// Billing providers
	var stripeProvider billing.BillingProvider
	if cfg.Billing.StripeSecretKey != "" {
		stripeProvider = billing.NewStripeProvider(
			cfg.Billing.StripeSecretKey, cfg.Billing.StripeWebhookSecret, db, logger)
		logger.Info("Stripe billing provider configured")
	}

	var paystackProvider billing.BillingProvider
	if cfg.Billing.PaystackSecretKey != "" {
		paystackProvider = billing.NewPaystackProvider(
			cfg.Billing.PaystackSecretKey, cfg.Billing.PaystackWebhookSecret, db, logger)
		logger.Info("Paystack billing provider configured")
	}

	// Services
	authService := service.NewAuthService(db, cfg.Auth)
	projectService := service.NewProjectService(db)
	uploadService := service.NewUploadService(db, storageProvider)
	apikeyService := service.NewAPIKeyService(db, authService)
	webhookService := service.NewWebhookService(db)
	billingService := service.NewBillingService(db)
	dashboardService := service.NewDashboardService(db, projectService)
	healthHandler := handler.NewHealthHandler(db)

	// Router
	r := router.New(router.Deps{
		Config:    cfg,
		Logger:    logger,
		Auth:      authService,
		Projects:  projectService,
		Uploads:   uploadService,
		APIKeys:   apikeyService,
		Webhooks:  webhookService,
		Billing:   billingService,
		Dashboard: dashboardService,
		Health:    healthHandler,
		Redis:     redisClient,
		Stripe:    stripeProvider,
		Paystack:  paystackProvider,
	})

	// HTTP Server
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	// Graceful shutdown
	go func() {
		logger.Info("starting server", slog.String("addr", addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("server forced to shutdown", slog.String("error", err.Error()))
	}
	logger.Info("server stopped")
}
