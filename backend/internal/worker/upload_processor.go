package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/filevault/backend/internal/queue"
	"github.com/filevault/backend/internal/storage"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UploadProcessor validates uploads after the client PUT completes.
// It verifies the object exists in S3, checks MIME type, updates status,
// and publishes webhook events.
type UploadProcessor struct {
	db        *pgxpool.Pool
	store     storage.Provider
	publisher *queue.Publisher
	logger    *slog.Logger
}

func NewUploadProcessor(db *pgxpool.Pool, store storage.Provider, pub *queue.Publisher, logger *slog.Logger) *UploadProcessor {
	return &UploadProcessor{db: db, store: store, publisher: pub, logger: logger}
}

type uploadProcessPayload struct {
	UploadID  string `json:"upload_id"`
	ProjectID string `json:"project_id"`
}

// Handle processes a single upload.process job.
func (p *UploadProcessor) Handle(ctx context.Context, job queue.Job) error {
	var payload uploadProcessPayload
	if err := json.Unmarshal(job.Payload, &payload); err != nil {
		return fmt.Errorf("unmarshaling payload: %w", err)
	}

	log := p.logger.With(
		slog.String("upload_id", payload.UploadID),
		slog.String("project_id", payload.ProjectID),
	)
	log.Info("processing upload")

	// 1. Get upload record
	var storageKey, expectedContentType string
	var expectedSize int64
	err := p.db.QueryRow(ctx,
		`SELECT storage_key, content_type, size_bytes FROM uploads
		 WHERE id = $1 AND project_id = $2 AND status IN ('pending', 'processing')`,
		payload.UploadID, payload.ProjectID).Scan(&storageKey, &expectedContentType, &expectedSize)
	if err != nil {
		log.Warn("upload not found or already processed", slog.String("error", err.Error()))
		return nil // Don't retry
	}

	// 2. Mark as processing
	p.db.Exec(ctx,
		`UPDATE uploads SET status = 'processing' WHERE id = $1 AND project_id = $2`,
		payload.UploadID, payload.ProjectID)

	// 3. Head the object to verify it exists and get actual size
	meta, err := p.store.HeadObject(ctx, storageKey)
	if err != nil {
		log.Error("object not found in storage", slog.String("error", err.Error()))
		p.markFailed(ctx, payload.UploadID, payload.ProjectID, "object_not_found")
		return nil // Don't retry — the client never uploaded
	}

	// 4. Validate content type
	if meta.ContentType != "" && meta.ContentType != expectedContentType {
		log.Warn("content type mismatch",
			slog.String("expected", expectedContentType),
			slog.String("actual", meta.ContentType),
		)
		// Allow it but log — the client may have set a different type
	}

	// 5. Validate size (allow small variance for encoding overhead)
	if expectedSize > 0 && meta.ContentLength > 0 {
		diff := meta.ContentLength - expectedSize
		if diff < 0 {
			diff = -diff
		}
		if diff > expectedSize/10 && diff > 1024 { // >10% or >1KB difference
			log.Warn("size mismatch",
				slog.Int64("expected", expectedSize),
				slog.Int64("actual", meta.ContentLength),
			)
		}
		// Update with actual size from storage
		p.db.Exec(ctx,
			`UPDATE uploads SET size_bytes = $3 WHERE id = $1 AND project_id = $2`,
			payload.UploadID, payload.ProjectID, meta.ContentLength)
	}

	// 6. Mark completed
	_, err = p.db.Exec(ctx,
		`UPDATE uploads SET status = 'completed', completed_at = NOW()
		 WHERE id = $1 AND project_id = $2`,
		payload.UploadID, payload.ProjectID)
	if err != nil {
		return fmt.Errorf("marking upload completed: %w", err)
	}

	// 7. Update daily stats
	today := time.Now().Format("2006-01-02")
	p.db.Exec(ctx,
		`INSERT INTO daily_stats (project_id, date, uploads, downloads, storage_bytes, bandwidth_bytes, api_requests)
		 VALUES ($1, $2, 1, 0, $3, 0, 0)
		 ON CONFLICT (project_id, date)
		 DO UPDATE SET uploads = daily_stats.uploads + 1, storage_bytes = daily_stats.storage_bytes + EXCLUDED.storage_bytes`,
		payload.ProjectID, today, meta.ContentLength)

	// 8. Enqueue webhook events for all matching endpoints
	p.publishWebhookEvents(ctx, payload.ProjectID, payload.UploadID, "upload.completed")

	log.Info("upload processed successfully",
		slog.Int64("size_bytes", meta.ContentLength),
		slog.String("content_type", meta.ContentType),
	)
	return nil
}

func (p *UploadProcessor) markFailed(ctx context.Context, uploadID, projectID, reason string) {
	p.db.Exec(ctx,
		`UPDATE uploads SET status = 'failed', metadata = metadata || jsonb_build_object('failure_reason', $3::text)
		 WHERE id = $1 AND project_id = $2`,
		uploadID, projectID, reason)

	p.publishWebhookEvents(ctx, projectID, uploadID, "upload.failed")
}

func (p *UploadProcessor) publishWebhookEvents(ctx context.Context, projectID, uploadID, eventType string) {
	if p.publisher == nil {
		return
	}

	rows, err := p.db.Query(ctx,
		`SELECT id FROM webhook_endpoints
		 WHERE project_id = $1 AND enabled = TRUE AND $2 = ANY(events)`,
		projectID, eventType)
	if err != nil {
		p.logger.Error("querying webhook endpoints", slog.String("error", err.Error()))
		return
	}
	defer rows.Close()

	for rows.Next() {
		var endpointID string
		rows.Scan(&endpointID)

		deliveryID := "whd_" + fmt.Sprintf("%d", time.Now().UnixNano())
		payloadJSON, _ := json.Marshal(map[string]string{
			"event":      eventType,
			"upload_id":  uploadID,
			"project_id": projectID,
		})

		p.db.Exec(ctx,
			`INSERT INTO webhook_deliveries (id, endpoint_id, event_type, payload, status, created_at)
			 VALUES ($1, $2, $3, $4, 'pending', NOW())`,
			deliveryID, endpointID, eventType, string(payloadJSON))

		p.publisher.PublishWebhookDelivery(ctx, deliveryID, endpointID)
	}
}
