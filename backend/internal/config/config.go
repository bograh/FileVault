package config

import (
	"time"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	Server   ServerConfig
	DB       DatabaseConfig
	Redis    RedisConfig
	RabbitMQ RabbitMQConfig
	Storage  StorageConfig
	Auth     AuthConfig
	Billing  BillingConfig
}

type ServerConfig struct {
	Host            string        `env:"SERVER_HOST" envDefault:"0.0.0.0"`
	Port            int           `env:"SERVER_PORT" envDefault:"8080"`
	ReadTimeout     time.Duration `env:"SERVER_READ_TIMEOUT" envDefault:"15s"`
	WriteTimeout    time.Duration `env:"SERVER_WRITE_TIMEOUT" envDefault:"30s"`
	ShutdownTimeout time.Duration `env:"SERVER_SHUTDOWN_TIMEOUT" envDefault:"10s"`
	CORSOrigins     []string      `env:"CORS_ORIGINS" envSeparator:"," envDefault:"http://localhost:5173"`
}

type DatabaseConfig struct {
	URL             string `env:"DATABASE_URL" envDefault:"postgres://filevault:filevault@localhost:5432/filevault?sslmode=disable"`
	MaxOpenConns    int    `env:"DB_MAX_OPEN_CONNS" envDefault:"25"`
	MaxIdleConns    int    `env:"DB_MAX_IDLE_CONNS" envDefault:"5"`
	MigrationsPath  string `env:"DB_MIGRATIONS_PATH" envDefault:"migrations"`
}

type RedisConfig struct {
	URL string `env:"REDIS_URL" envDefault:"redis://localhost:6379/0"`
}

type RabbitMQConfig struct {
	URL string `env:"RABBITMQ_URL" envDefault:"amqp://guest:guest@localhost:5672/"`
}

type StorageConfig struct {
	Provider        string `env:"STORAGE_PROVIDER" envDefault:"s3"`
	Endpoint        string `env:"STORAGE_ENDPOINT" envDefault:""`
	Region          string `env:"STORAGE_REGION" envDefault:"us-east-1"`
	Bucket          string `env:"STORAGE_BUCKET" envDefault:"filevault-uploads"`
	AccessKeyID     string `env:"STORAGE_ACCESS_KEY_ID" envDefault:""`
	SecretAccessKey  string `env:"STORAGE_SECRET_ACCESS_KEY" envDefault:""`
	UsePathStyle    bool   `env:"STORAGE_USE_PATH_STYLE" envDefault:"true"`
	PresignTTL      time.Duration `env:"STORAGE_PRESIGN_TTL" envDefault:"15m"`
}

type AuthConfig struct {
	HMACSecret      string        `env:"AUTH_HMAC_SECRET" envDefault:"change-me-in-production"`
	SessionSecret   string        `env:"AUTH_SESSION_SECRET" envDefault:"change-session-secret"`
	SessionTTL      time.Duration `env:"AUTH_SESSION_TTL" envDefault:"24h"`
	TokenTTL        time.Duration `env:"AUTH_TOKEN_TTL" envDefault:"1h"`
}

type BillingConfig struct {
	StripeSecretKey    string `env:"STRIPE_SECRET_KEY" envDefault:""`
	StripeWebhookSecret string `env:"STRIPE_WEBHOOK_SECRET" envDefault:""`
	PaystackSecretKey  string `env:"PAYSTACK_SECRET_KEY" envDefault:""`
	PaystackWebhookSecret string `env:"PAYSTACK_WEBHOOK_SECRET" envDefault:""`
}

func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(&cfg.Server); err != nil {
		return nil, err
	}
	if err := env.Parse(&cfg.DB); err != nil {
		return nil, err
	}
	if err := env.Parse(&cfg.Redis); err != nil {
		return nil, err
	}
	if err := env.Parse(&cfg.RabbitMQ); err != nil {
		return nil, err
	}
	if err := env.Parse(&cfg.Storage); err != nil {
		return nil, err
	}
	if err := env.Parse(&cfg.Auth); err != nil {
		return nil, err
	}
	if err := env.Parse(&cfg.Billing); err != nil {
		return nil, err
	}
	return cfg, nil
}
