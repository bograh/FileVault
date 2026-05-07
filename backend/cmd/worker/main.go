package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/filevault/backend/internal/config"
	"github.com/filevault/backend/internal/queue"
	"github.com/filevault/backend/internal/storage"
	"github.com/filevault/backend/internal/worker"
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
	db, err := pgxpool.New(context.Background(), cfg.DB.URL)
	if err != nil {
		logger.Error("failed to connect to database", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer db.Close()

	if err := db.Ping(context.Background()); err != nil {
		logger.Error("failed to ping database", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// Storage provider
	store, err := storage.NewS3Provider(cfg.Storage)
	if err != nil {
		logger.Warn("S3 storage unavailable — upload processing will fail", slog.String("error", err.Error()))
	}

	// RabbitMQ publisher (for chaining jobs, e.g. upload → webhook)
	publisher, err := queue.NewPublisher(cfg.RabbitMQ.URL, logger)
	if err != nil {
		logger.Error("failed to connect publisher to RabbitMQ", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer publisher.Close()

	// Create workers
	uploadProcessor := worker.NewUploadProcessor(db, store, publisher, logger)
	webhookDeliverer := worker.NewWebhookDeliverer(db, logger)
	usageFlusher := worker.NewUsageFlusher(db, logger)
	cleanupWorker := worker.NewCleanupWorker(db, store, logger)

	// Cancellable context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logger.Info("worker starting",
		slog.String("rabbitmq", cfg.RabbitMQ.URL),
	)

	// Start consumers — each in its own goroutine
	errCh := make(chan error, 4)

	startConsumer := func(queueName string, concurrency int, handler queue.HandlerFunc) {
		go func() {
			consumer, err := queue.NewConsumer(cfg.RabbitMQ.URL, logger)
			if err != nil {
				errCh <- err
				return
			}
			defer consumer.Close()
			logger.Info("consumer started", slog.String("queue", queueName), slog.Int("concurrency", concurrency))
			errCh <- consumer.Consume(ctx, queueName, concurrency, handler)
		}()
	}

	// Upload processing — validates objects, updates status, triggers webhooks
	startConsumer(queue.QueueUploadProcessing, 4, uploadProcessor.Handle)

	// Webhook delivery — delivers HTTP events to endpoints with retry
	startConsumer(queue.QueueUploadWebhooks, 8, webhookDeliverer.Handle)

	// Usage metering — flushes Redis counters to PostgreSQL
	startConsumer(queue.QueueBillingMetering, 2, usageFlusher.Handle)

	// Cleanup — multiplexes on job type
	startConsumer(queue.QueueBillingEvents, 2, func(ctx context.Context, job queue.Job) error {
		switch job.Type {
		case queue.JobCleanupExpired:
			return cleanupWorker.Handle(ctx, job)
		case queue.JobBillingEvent:
			logger.Info("billing event received (provider integration pending)", slog.String("type", string(job.Type)))
			return nil
		default:
			logger.Warn("unknown job type", slog.String("type", string(job.Type)))
			return nil
		}
	})

	logger.Info("all consumers started")

	// Wait for shutdown signal or consumer error
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-quit:
		logger.Info("shutdown signal received")
	case err := <-errCh:
		if err != nil {
			logger.Error("consumer error", slog.String("error", err.Error()))
		}
	}

	cancel() // Signal all consumers to stop
	logger.Info("worker shut down")
}
