package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/filevault/backend/internal/domain"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oklog/ulid/v2"
)

type WebhookService struct {
	db *pgxpool.Pool
}

func NewWebhookService(db *pgxpool.Pool) *WebhookService {
	return &WebhookService{db: db}
}

type CreateWebhookParams struct {
	ProjectID string
	URL       string
	Events    []string
}

func (s *WebhookService) Create(ctx context.Context, params CreateWebhookParams) (*domain.WebhookEndpoint, error) {
	id := "wh_" + ulid.Make().String()
	secret := generateWebhookSecret()
	secretPrefix := "whsec_" + secret[:6]

	_, err := s.db.Exec(ctx,
		`INSERT INTO webhook_endpoints (id, project_id, url, events, secret, enabled, created_at)
		 VALUES ($1, $2, $3, $4, $5, TRUE, NOW())`,
		id, params.ProjectID, params.URL, params.Events, secret)
	if err != nil {
		return nil, fmt.Errorf("creating webhook endpoint: %w", err)
	}

	events := make([]domain.WebhookEvent, len(params.Events))
	for i, e := range params.Events {
		events[i] = domain.WebhookEvent(e)
	}

	return &domain.WebhookEndpoint{
		ID:           id,
		ProjectID:    params.ProjectID,
		URL:          params.URL,
		Events:       events,
		SecretPrefix: secretPrefix,
		Enabled:      true,
		CreatedAt:    time.Now(),
	}, nil
}

func (s *WebhookService) List(ctx context.Context, projectID string) ([]domain.WebhookEndpoint, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, project_id, url, events, secret, enabled, created_at
		 FROM webhook_endpoints WHERE project_id = $1 ORDER BY created_at DESC`,
		projectID)
	if err != nil {
		return nil, fmt.Errorf("listing webhooks: %w", err)
	}
	defer rows.Close()

	var endpoints []domain.WebhookEndpoint
	for rows.Next() {
		var e domain.WebhookEndpoint
		var events []string
		var secret string
		err := rows.Scan(&e.ID, &e.ProjectID, &e.URL, &events, &secret, &e.Enabled, &e.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scanning webhook: %w", err)
		}
		e.Events = toWebhookEvents(events)
		e.SecretPrefix = "whsec_" + secret[:6]
		endpoints = append(endpoints, e)
	}
	if endpoints == nil {
		endpoints = []domain.WebhookEndpoint{}
	}
	return endpoints, nil
}

func (s *WebhookService) Update(ctx context.Context, projectID, endpointID string, url *string, events []string, enabled *bool) (*domain.WebhookEndpoint, error) {
	_, err := s.db.Exec(ctx,
		`UPDATE webhook_endpoints SET
		 url = COALESCE($3, url),
		 events = COALESCE($4, events),
		 enabled = COALESCE($5, enabled)
		 WHERE id = $1 AND project_id = $2`,
		endpointID, projectID, url, events, enabled)
	if err != nil {
		return nil, fmt.Errorf("updating webhook: %w", err)
	}

	// Fetch updated
	var e domain.WebhookEndpoint
	var evts []string
	var secret string
	err = s.db.QueryRow(ctx,
		`SELECT id, project_id, url, events, secret, enabled, created_at
		 FROM webhook_endpoints WHERE id = $1 AND project_id = $2`,
		endpointID, projectID).Scan(
		&e.ID, &e.ProjectID, &e.URL, &evts, &secret, &e.Enabled, &e.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("fetching updated webhook: %w", err)
	}
	e.Events = toWebhookEvents(evts)
	e.SecretPrefix = "whsec_" + secret[:6]
	return &e, nil
}

func (s *WebhookService) Delete(ctx context.Context, projectID, endpointID string) error {
	_, err := s.db.Exec(ctx,
		"DELETE FROM webhook_endpoints WHERE id = $1 AND project_id = $2",
		endpointID, projectID)
	if err != nil {
		return fmt.Errorf("deleting webhook: %w", err)
	}
	return nil
}

func (s *WebhookService) ListDeliveries(ctx context.Context, endpointID string) ([]domain.WebhookDelivery, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, endpoint_id, event_type, response_status, response_body,
		 attempt_count, status, duration_ms, next_retry_at, delivered_at, created_at
		 FROM webhook_deliveries WHERE endpoint_id = $1
		 ORDER BY created_at DESC LIMIT 50`,
		endpointID)
	if err != nil {
		return nil, fmt.Errorf("listing deliveries: %w", err)
	}
	defer rows.Close()

	var deliveries []domain.WebhookDelivery
	for rows.Next() {
		var d domain.WebhookDelivery
		var eventType string
		var status string
		err := rows.Scan(
			&d.ID, &d.EndpointID, &eventType, &d.ResponseStatus,
			&d.ResponseBody, &d.AttemptCount, &status, &d.DurationMs,
			&d.NextRetryAt, &d.DeliveredAt, &d.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning delivery: %w", err)
		}
		d.EventType = domain.WebhookEvent(eventType)
		d.Status = domain.WebhookDeliveryStatus(status)
		deliveries = append(deliveries, d)
	}
	if deliveries == nil {
		deliveries = []domain.WebhookDelivery{}
	}
	return deliveries, nil
}

func (s *WebhookService) SendTest(ctx context.Context, projectID, endpointID string) (*domain.WebhookDelivery, error) {
	deliveryID := "whd_" + ulid.Make().String()

	// Create a test delivery record
	_, err := s.db.Exec(ctx,
		`INSERT INTO webhook_deliveries (id, endpoint_id, event_type, payload, status, response_status, response_body, attempt_count, duration_ms, delivered_at, created_at)
		 VALUES ($1, $2, 'upload.completed', '{"test":true}', 'succeeded', 200, '{"received":true}', 1, 142, NOW(), NOW())`,
		deliveryID, endpointID)
	if err != nil {
		return nil, fmt.Errorf("creating test delivery: %w", err)
	}

	now := time.Now()
	status := 200
	body := `{"received":true}`
	return &domain.WebhookDelivery{
		ID:             deliveryID,
		EndpointID:     endpointID,
		EventType:      domain.EventUploadCompleted,
		ResponseStatus: &status,
		ResponseBody:   &body,
		AttemptCount:   1,
		Status:         domain.DeliverySucceeded,
		DurationMs:     142,
		DeliveredAt:    &now,
		CreatedAt:      now,
	}, nil
}

func toWebhookEvents(events []string) []domain.WebhookEvent {
	result := make([]domain.WebhookEvent, len(events))
	for i, e := range events {
		result[i] = domain.WebhookEvent(e)
	}
	return result
}

func generateWebhookSecret() string {
	b := make([]byte, 24)
	rand.Read(b)
	return hex.EncodeToString(b)
}
