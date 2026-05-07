package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

// Exchange and queue names per PRD section 13.
const (
	ExchangeUploads = "filevault.uploads"
	ExchangeBilling = "filevault.billing"

	QueueUploadProcessing = "filevault.uploads.processing"
	QueueUploadWebhooks   = "filevault.uploads.webhooks"
	QueueUploadDLQ        = "filevault.uploads.dlq"
	QueueBillingMetering  = "filevault.billing.metering"
	QueueBillingEvents    = "filevault.billing.events"
)

// JobType identifies async job types.
type JobType string

const (
	JobUploadProcess    JobType = "upload.process"
	JobWebhookDeliver   JobType = "webhook.deliver"
	JobUsageFlush       JobType = "usage.flush"
	JobBillingEvent     JobType = "billing.event"
	JobCleanupExpired   JobType = "cleanup.expired"
)

// Job represents a message published to RabbitMQ.
type Job struct {
	Type      JobType         `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	CreatedAt time.Time       `json:"created_at"`
	Attempt   int             `json:"attempt"`
}

// Publisher publishes messages to RabbitMQ exchanges.
type Publisher struct {
	conn    *amqp.Connection
	channel *amqp.Channel
	logger  *slog.Logger
}

func NewPublisher(url string, logger *slog.Logger) (*Publisher, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("connecting to RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("opening channel: %w", err)
	}

	p := &Publisher{conn: conn, channel: ch, logger: logger}
	if err := p.declareTopology(); err != nil {
		p.Close()
		return nil, err
	}

	return p, nil
}

func (p *Publisher) declareTopology() error {
	// Declare exchanges
	if err := p.channel.ExchangeDeclare(ExchangeUploads, "topic", true, false, false, false, nil); err != nil {
		return fmt.Errorf("declaring uploads exchange: %w", err)
	}
	if err := p.channel.ExchangeDeclare(ExchangeBilling, "direct", true, false, false, false, nil); err != nil {
		return fmt.Errorf("declaring billing exchange: %w", err)
	}

	// Declare queues with DLQ
	dlqArgs := amqp.Table{
		"x-dead-letter-exchange":    ExchangeUploads,
		"x-dead-letter-routing-key": "dlq",
	}

	if _, err := p.channel.QueueDeclare(QueueUploadProcessing, true, false, false, false, dlqArgs); err != nil {
		return fmt.Errorf("declaring processing queue: %w", err)
	}
	if _, err := p.channel.QueueDeclare(QueueUploadWebhooks, true, false, false, false, dlqArgs); err != nil {
		return fmt.Errorf("declaring webhooks queue: %w", err)
	}
	if _, err := p.channel.QueueDeclare(QueueUploadDLQ, true, false, false, false, nil); err != nil {
		return fmt.Errorf("declaring DLQ: %w", err)
	}
	if _, err := p.channel.QueueDeclare(QueueBillingMetering, true, false, false, false, nil); err != nil {
		return fmt.Errorf("declaring metering queue: %w", err)
	}
	if _, err := p.channel.QueueDeclare(QueueBillingEvents, true, false, false, false, nil); err != nil {
		return fmt.Errorf("declaring billing events queue: %w", err)
	}

	// Bind queues to exchanges
	p.channel.QueueBind(QueueUploadProcessing, "processing", ExchangeUploads, false, nil)
	p.channel.QueueBind(QueueUploadWebhooks, "webhooks", ExchangeUploads, false, nil)
	p.channel.QueueBind(QueueUploadDLQ, "dlq", ExchangeUploads, false, nil)
	p.channel.QueueBind(QueueBillingMetering, "metering", ExchangeBilling, false, nil)
	p.channel.QueueBind(QueueBillingEvents, "events", ExchangeBilling, false, nil)

	return nil
}

// Publish sends a job to the specified exchange with routing key.
func (p *Publisher) Publish(ctx context.Context, exchange, routingKey string, job Job) error {
	body, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("marshaling job: %w", err)
	}

	err = p.channel.PublishWithContext(ctx, exchange, routingKey, false, false, amqp.Publishing{
		ContentType:  "application/json",
		Body:         body,
		DeliveryMode: amqp.Persistent,
		Timestamp:    time.Now(),
	})
	if err != nil {
		return fmt.Errorf("publishing message: %w", err)
	}

	p.logger.Debug("published job",
		slog.String("exchange", exchange),
		slog.String("routing_key", routingKey),
		slog.String("type", string(job.Type)),
	)
	return nil
}

// PublishUploadProcess enqueues an upload for post-upload processing.
func (p *Publisher) PublishUploadProcess(ctx context.Context, uploadID, projectID string) error {
	payload, _ := json.Marshal(map[string]string{
		"upload_id":  uploadID,
		"project_id": projectID,
	})
	return p.Publish(ctx, ExchangeUploads, "processing", Job{
		Type:      JobUploadProcess,
		Payload:   payload,
		CreatedAt: time.Now(),
	})
}

// PublishWebhookDelivery enqueues a webhook for delivery.
func (p *Publisher) PublishWebhookDelivery(ctx context.Context, deliveryID, endpointID string) error {
	payload, _ := json.Marshal(map[string]string{
		"delivery_id":  deliveryID,
		"endpoint_id":  endpointID,
	})
	return p.Publish(ctx, ExchangeUploads, "webhooks", Job{
		Type:      JobWebhookDeliver,
		Payload:   payload,
		CreatedAt: time.Now(),
	})
}

func (p *Publisher) Close() {
	if p.channel != nil {
		p.channel.Close()
	}
	if p.conn != nil {
		p.conn.Close()
	}
}

// Consumer consumes messages from a queue and processes them.
type Consumer struct {
	conn    *amqp.Connection
	channel *amqp.Channel
	logger  *slog.Logger
}

func NewConsumer(url string, logger *slog.Logger) (*Consumer, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("connecting to RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("opening channel: %w", err)
	}

	return &Consumer{conn: conn, channel: ch, logger: logger}, nil
}

// HandlerFunc processes a single job. Return error to nack/requeue.
type HandlerFunc func(ctx context.Context, job Job) error

// Consume starts consuming from the given queue.
func (c *Consumer) Consume(ctx context.Context, queueName string, concurrency int, handler HandlerFunc) error {
	if err := c.channel.Qos(concurrency, 0, false); err != nil {
		return fmt.Errorf("setting QoS: %w", err)
	}

	msgs, err := c.channel.Consume(queueName, "", false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("consuming from %s: %w", queueName, err)
	}

	for i := 0; i < concurrency; i++ {
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case msg, ok := <-msgs:
					if !ok {
						return
					}
					var job Job
					if err := json.Unmarshal(msg.Body, &job); err != nil {
						c.logger.Error("failed to unmarshal job", slog.String("error", err.Error()))
						msg.Nack(false, false)
						continue
					}

					if err := handler(ctx, job); err != nil {
						c.logger.Error("job processing failed",
							slog.String("type", string(job.Type)),
							slog.String("error", err.Error()),
							slog.Int("attempt", job.Attempt),
						)
						// Requeue if under retry limit
						if job.Attempt < 5 {
							msg.Nack(false, true)
						} else {
							msg.Nack(false, false) // Goes to DLQ
						}
						continue
					}

					msg.Ack(false)
				}
			}
		}()
	}

	<-ctx.Done()
	return nil
}

func (c *Consumer) Close() {
	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}
}
