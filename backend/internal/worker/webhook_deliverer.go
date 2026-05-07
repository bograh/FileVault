package worker

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"time"

	"github.com/filevault/backend/internal/queue"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	webhookTimeout    = 10 * time.Second
	maxRetryAttempts  = 5
	maxResponseBodyKB = 4
)

// WebhookDeliverer delivers webhook events to registered endpoints with retries.
type WebhookDeliverer struct {
	db     *pgxpool.Pool
	client *http.Client
	logger *slog.Logger
}

func NewWebhookDeliverer(db *pgxpool.Pool, logger *slog.Logger) *WebhookDeliverer {
	return &WebhookDeliverer{
		db: db,
		client: &http.Client{
			Timeout: webhookTimeout,
		},
		logger: logger,
	}
}

type webhookDeliveryPayload struct {
	DeliveryID string `json:"delivery_id"`
	EndpointID string `json:"endpoint_id"`
}

// Handle delivers a single webhook.
func (d *WebhookDeliverer) Handle(ctx context.Context, job queue.Job) error {
	var payload webhookDeliveryPayload
	if err := json.Unmarshal(job.Payload, &payload); err != nil {
		return fmt.Errorf("unmarshaling payload: %w", err)
	}

	log := d.logger.With(
		slog.String("delivery_id", payload.DeliveryID),
		slog.String("endpoint_id", payload.EndpointID),
	)

	// Fetch delivery + endpoint data
	var url, secret, eventType, body string
	var attemptCount int
	err := d.db.QueryRow(ctx,
		`SELECT we.url, we.secret, wd.event_type, wd.payload, wd.attempt_count
		 FROM webhook_deliveries wd
		 JOIN webhook_endpoints we ON we.id = wd.endpoint_id
		 WHERE wd.id = $1 AND wd.endpoint_id = $2`,
		payload.DeliveryID, payload.EndpointID).Scan(
		&url, &secret, &eventType, &body, &attemptCount,
	)
	if err != nil {
		log.Error("delivery not found", slog.String("error", err.Error()))
		return nil // Don't retry
	}

	if attemptCount >= maxRetryAttempts {
		log.Warn("max retries exceeded, giving up")
		d.db.Exec(ctx,
			`UPDATE webhook_deliveries SET status = 'failed' WHERE id = $1`,
			payload.DeliveryID)
		return nil
	}

	// Sign the payload
	timestamp := time.Now().Unix()
	signature := signWebhookPayload(secret, body, timestamp)

	// Build HTTP request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBufferString(body))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "FileVault-Webhook/1.0")
	req.Header.Set("X-Webhook-ID", payload.DeliveryID)
	req.Header.Set("X-Webhook-Event", eventType)
	req.Header.Set("X-Webhook-Timestamp", fmt.Sprintf("%d", timestamp))
	req.Header.Set("X-Webhook-Signature", fmt.Sprintf("v1=%s", signature))

	// Deliver
	start := time.Now()
	resp, err := d.client.Do(req)
	durationMs := int(time.Since(start).Milliseconds())

	if err != nil {
		log.Warn("delivery failed (network)", slog.String("error", err.Error()), slog.Int("duration_ms", durationMs))
		d.recordAttempt(ctx, payload.DeliveryID, attemptCount+1, durationMs, nil, nil)
		return fmt.Errorf("delivering webhook: %w", err) // Will be retried
	}
	defer resp.Body.Close()

	// Read truncated response body
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, maxResponseBodyKB*1024))
	respBodyStr := string(respBody)
	statusCode := resp.StatusCode

	if statusCode >= 200 && statusCode < 300 {
		log.Info("delivery succeeded",
			slog.Int("status", statusCode),
			slog.Int("duration_ms", durationMs),
		)
		d.db.Exec(ctx,
			`UPDATE webhook_deliveries SET
			 status = 'succeeded', response_status = $2, response_body = $3,
			 attempt_count = $4, duration_ms = $5, delivered_at = NOW()
			 WHERE id = $1`,
			payload.DeliveryID, statusCode, respBodyStr, attemptCount+1, durationMs)
		return nil
	}

	// Non-2xx — record attempt and schedule retry
	log.Warn("delivery failed (non-2xx)",
		slog.Int("status", statusCode),
		slog.Int("duration_ms", durationMs),
		slog.Int("attempt", attemptCount+1),
	)
	d.recordAttempt(ctx, payload.DeliveryID, attemptCount+1, durationMs, &statusCode, &respBodyStr)

	if attemptCount+1 >= maxRetryAttempts {
		return nil // Give up
	}
	return fmt.Errorf("webhook returned %d", statusCode) // Will be retried via requeue
}

func (d *WebhookDeliverer) recordAttempt(ctx context.Context, deliveryID string, attempt, durationMs int, statusCode *int, body *string) {
	nextRetry := time.Now().Add(retryBackoff(attempt))
	status := "failed"
	if attempt < maxRetryAttempts {
		status = "pending"
	}

	d.db.Exec(ctx,
		`UPDATE webhook_deliveries SET
		 status = $2, response_status = $3, response_body = $4,
		 attempt_count = $5, duration_ms = $6, next_retry_at = $7
		 WHERE id = $1`,
		deliveryID, status, statusCode, body, attempt, durationMs, nextRetry)
}

// retryBackoff returns exponential backoff: 10s, 30s, 90s, 270s, 810s
func retryBackoff(attempt int) time.Duration {
	base := 10 * time.Second
	return time.Duration(float64(base) * math.Pow(3, float64(attempt-1)))
}

func signWebhookPayload(secret, body string, timestamp int64) string {
	signBody := fmt.Sprintf("%d.%s", timestamp, body)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signBody))
	return hex.EncodeToString(mac.Sum(nil))
}
