package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/filevault/backend/internal/queue"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UsageFlusher flushes accumulated usage counters from Redis to PostgreSQL.
// In production, the API layer increments counters in Redis for performance,
// and this worker periodically flushes them to the usage_records table.
type UsageFlusher struct {
	db     *pgxpool.Pool
	logger *slog.Logger
}

func NewUsageFlusher(db *pgxpool.Pool, logger *slog.Logger) *UsageFlusher {
	return &UsageFlusher{db: db, logger: logger}
}

type usageFlushPayload struct {
	ProjectID      string `json:"project_id"`
	StorageBytes   int64  `json:"storage_bytes"`
	BandwidthBytes int64  `json:"bandwidth_bytes"`
	APIRequests    int64  `json:"api_requests"`
	FileCount      int64  `json:"file_count"`
}

// Handle processes a usage flush job.
func (f *UsageFlusher) Handle(ctx context.Context, job queue.Job) error {
	var payload usageFlushPayload
	if err := json.Unmarshal(job.Payload, &payload); err != nil {
		return fmt.Errorf("unmarshaling payload: %w", err)
	}

	log := f.logger.With(slog.String("project_id", payload.ProjectID))

	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	periodEnd := periodStart.AddDate(0, 1, 0).Add(-time.Second)

	_, err := f.db.Exec(ctx,
		`INSERT INTO usage_records (project_id, period_start, period_end, storage_bytes, bandwidth_bytes, api_requests, file_count)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (project_id, period_start, period_end)
		 DO UPDATE SET
		   storage_bytes = usage_records.storage_bytes + EXCLUDED.storage_bytes,
		   bandwidth_bytes = usage_records.bandwidth_bytes + EXCLUDED.bandwidth_bytes,
		   api_requests = usage_records.api_requests + EXCLUDED.api_requests,
		   file_count = EXCLUDED.file_count,
		   recorded_at = NOW()`,
		payload.ProjectID, periodStart, periodEnd,
		payload.StorageBytes, payload.BandwidthBytes,
		payload.APIRequests, payload.FileCount)
	if err != nil {
		return fmt.Errorf("flushing usage: %w", err)
	}

	log.Info("usage flushed",
		slog.Int64("storage_bytes", payload.StorageBytes),
		slog.Int64("bandwidth_bytes", payload.BandwidthBytes),
		slog.Int64("api_requests", payload.APIRequests),
	)
	return nil
}
