package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/filevault/backend/internal/queue"
	"github.com/filevault/backend/internal/storage"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CleanupWorker hard-deletes expired uploads and removes their S3 objects.
type CleanupWorker struct {
	db     *pgxpool.Pool
	store  storage.Provider
	logger *slog.Logger
}

func NewCleanupWorker(db *pgxpool.Pool, store storage.Provider, logger *slog.Logger) *CleanupWorker {
	return &CleanupWorker{db: db, store: store, logger: logger}
}

type cleanupPayload struct {
	RetentionDays int `json:"retention_days"`
}

// Handle processes a cleanup.expired job.
func (w *CleanupWorker) Handle(ctx context.Context, job queue.Job) error {
	var payload cleanupPayload
	if err := json.Unmarshal(job.Payload, &payload); err != nil {
		payload.RetentionDays = 30 // default
	}
	if payload.RetentionDays < 1 {
		payload.RetentionDays = 30
	}

	interval := fmt.Sprintf("%d days", payload.RetentionDays)

	rows, err := w.db.Query(ctx,
		`DELETE FROM uploads
		 WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - $1::interval
		 RETURNING storage_key`, interval)
	if err != nil {
		return fmt.Errorf("querying expired uploads: %w", err)
	}
	defer rows.Close()

	var deleted int
	var errors int
	for rows.Next() {
		var storageKey string
		rows.Scan(&storageKey)

		if err := w.store.DeleteObject(ctx, storageKey); err != nil {
			w.logger.Error("failed to delete S3 object",
				slog.String("key", storageKey),
				slog.String("error", err.Error()),
			)
			errors++
			continue
		}
		deleted++
	}

	w.logger.Info("cleanup complete",
		slog.Int("deleted", deleted),
		slog.Int("errors", errors),
		slog.Int("retention_days", payload.RetentionDays),
	)
	return nil
}
