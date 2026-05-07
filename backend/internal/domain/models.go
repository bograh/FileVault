package domain

import "time"



type User struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Email            string    `json:"email"`
	PasswordHash     string    `json:"-"`
	AvatarURL        *string   `json:"avatar_url"`
	Country          string    `json:"country"`
	TwoFactorEnabled bool      `json:"two_factor_enabled"`
	TwoFactorSecret  *string   `json:"-"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"-"`
}

type Session struct {
	User      *User  `json:"user"`
	ExpiresAt string `json:"expires_at"`
}



type StorageRegion string

const (
	RegionUSEast1  StorageRegion = "us-east-1"
	RegionEUWest1  StorageRegion = "eu-west-1"
	RegionAFSouth1 StorageRegion = "af-south-1"
)

type StorageBackend string

const (
	BackendS3    StorageBackend = "s3"
	BackendR2    StorageBackend = "r2"
	BackendB2    StorageBackend = "b2"
	BackendMinIO StorageBackend = "minio"
)

type SubscriptionTier string

const (
	TierHobby      SubscriptionTier = "hobby"
	TierStarter    SubscriptionTier = "starter"
	TierPro        SubscriptionTier = "pro"
	TierEnterprise SubscriptionTier = "enterprise"
)

type SubscriptionStatus string

const (
	StatusActive   SubscriptionStatus = "active"
	StatusPastDue  SubscriptionStatus = "past_due"
	StatusCanceled SubscriptionStatus = "canceled"
	StatusTrialing SubscriptionStatus = "trialing"
)

type BillingProvider string

const (
	ProviderStripe   BillingProvider = "stripe"
	ProviderPaystack BillingProvider = "paystack"
)

type Project struct {
	ID                 string             `json:"id"`
	OwnerID            string             `json:"owner_id"`
	Name               string             `json:"name"`
	Slug               string             `json:"slug"`
	Description        string             `json:"description"`
	StorageRegion      StorageRegion      `json:"storage_region"`
	StorageBackend     StorageBackend     `json:"storage_backend"`
	BucketPrefix       string             `json:"bucket_prefix"`
	MaxFileSizeBytes   int64              `json:"max_file_size_bytes"`
	AllowedMimeTypes   []string           `json:"allowed_mime_types"`
	VersioningEnabled  bool               `json:"versioning_enabled"`
	CustomDomain       *string            `json:"custom_domain"`
	BillingProvider    BillingProvider    `json:"billing_provider"`
	SubscriptionTier   SubscriptionTier   `json:"subscription_tier"`
	SubscriptionStatus SubscriptionStatus `json:"subscription_status"`
	CreatedAt          time.Time          `json:"created_at"`
	UpdatedAt          time.Time          `json:"updated_at"`
}



type UploadStatus string

const (
	UploadPending    UploadStatus = "pending"
	UploadProcessing UploadStatus = "processing"
	UploadCompleted  UploadStatus = "completed"
	UploadFailed     UploadStatus = "failed"
	UploadDeleted    UploadStatus = "deleted"
)

type UploadAcl string

const (
	AclPrivate UploadAcl = "private"
	AclPublic  UploadAcl = "public"
	AclProject UploadAcl = "project"
)

type Upload struct {
	ID             string            `json:"id"`
	ProjectID      string            `json:"project_id"`
	Filename       string            `json:"filename"`
	ContentType    string            `json:"content_type"`
	SizeBytes      int64             `json:"size_bytes"`
	StorageKey     string            `json:"storage_key"`
	Status         UploadStatus      `json:"status"`
	ChecksumSHA256 *string           `json:"checksum_sha256"`
	Acl            UploadAcl         `json:"acl"`
	Folder         string            `json:"folder"`
	Metadata       map[string]string `json:"metadata"`
	CreatedAt      time.Time         `json:"created_at"`
	CompletedAt    *time.Time        `json:"completed_at"`
	DeletedAt      *time.Time        `json:"deleted_at"`
}



type ApiKeyScope string

const (
	ScopeRead   ApiKeyScope = "read"
	ScopeWrite  ApiKeyScope = "write"
	ScopeDelete ApiKeyScope = "delete"
	ScopeAdmin  ApiKeyScope = "admin"
)

type ApiKey struct {
	ID          string       `json:"id"`
	ProjectID   string       `json:"project_id"`
	Name        string       `json:"name"`
	KeyHash     string       `json:"-"`
	KeyPrefix   string       `json:"key_prefix"`
	FullKey     string       `json:"full_key,omitempty"` // Only on creation
	Scopes      []ApiKeyScope `json:"scopes"`
	Environment string       `json:"environment"`
	IPAllowlist []string     `json:"ip_allowlist"`
	LastUsedAt  *time.Time   `json:"last_used_at"`
	ExpiresAt   *time.Time   `json:"expires_at"`
	RevokedAt   *time.Time   `json:"revoked_at"`
	CreatedAt   time.Time    `json:"created_at"`
}



type WebhookEvent string

const (
	EventUploadCompleted      WebhookEvent = "upload.completed"
	EventUploadFailed         WebhookEvent = "upload.failed"
	EventFileDeleted          WebhookEvent = "file.deleted"
	EventQuotaWarning         WebhookEvent = "quota.warning"
	EventBillingInvoiceCreated WebhookEvent = "billing.invoice.created"
)

type WebhookEndpoint struct {
	ID           string         `json:"id"`
	ProjectID    string         `json:"project_id"`
	URL          string         `json:"url"`
	Events       []WebhookEvent `json:"events"`
	Secret       string         `json:"-"`
	SecretPrefix string         `json:"secret_prefix"`
	Enabled      bool           `json:"enabled"`
	CreatedAt    time.Time      `json:"created_at"`
}

type WebhookDeliveryStatus string

const (
	DeliveryPending   WebhookDeliveryStatus = "pending"
	DeliverySucceeded WebhookDeliveryStatus = "succeeded"
	DeliveryFailed    WebhookDeliveryStatus = "failed"
)

type WebhookDelivery struct {
	ID             string                `json:"id"`
	EndpointID     string                `json:"endpoint_id"`
	EventType      WebhookEvent          `json:"event_type"`
	ResponseStatus *int                  `json:"response_status"`
	ResponseBody   *string               `json:"response_body"`
	AttemptCount   int                   `json:"attempt_count"`
	Status         WebhookDeliveryStatus `json:"status"`
	DurationMs     int                   `json:"duration_ms"`
	NextRetryAt    *time.Time            `json:"next_retry_at"`
	DeliveredAt    *time.Time            `json:"delivered_at"`
	CreatedAt      time.Time             `json:"created_at"`
}



type Plan struct {
	ID            SubscriptionTier `json:"id"`
	Name          string           `json:"name"`
	PriceCents    int              `json:"price_cents"`
	PriceLabel    string           `json:"price_label"`
	Currency      string           `json:"currency"`
	StorageGB     *int             `json:"storage_gb"`
	BandwidthGB   *int             `json:"bandwidth_gb"`
	APIRequests   *int             `json:"api_requests"`
	Projects      *int             `json:"projects"`
	MaxFileSizeMB *int             `json:"max_file_size_mb"`
	Features      []string         `json:"features"`
	SLAPercent    *float64         `json:"sla_percent"`
	CTA           string           `json:"cta"`
	Highlight     bool             `json:"highlight,omitempty"`
}

type Subscription struct {
	ID                 string             `json:"id"`
	PlanID             SubscriptionTier   `json:"plan_id"`
	Status             SubscriptionStatus `json:"status"`
	CurrentPeriodStart string             `json:"current_period_start"`
	CurrentPeriodEnd   string             `json:"current_period_end"`
	CancelAtPeriodEnd  bool               `json:"cancel_at_period_end"`
	Provider           BillingProvider    `json:"provider"`
	AmountCents        int                `json:"amount_cents"`
	Currency           string             `json:"currency"`
}

type InvoiceStatus string

const (
	InvoicePaid          InvoiceStatus = "paid"
	InvoiceOpen          InvoiceStatus = "open"
	InvoiceVoid          InvoiceStatus = "void"
	InvoiceUncollectible InvoiceStatus = "uncollectible"
)

type Invoice struct {
	ID          string            `json:"id"`
	Number      string            `json:"number"`
	Status      InvoiceStatus     `json:"status"`
	AmountCents int               `json:"amount_cents"`
	Currency    string            `json:"currency"`
	PeriodStart string            `json:"period_start"`
	PeriodEnd   string            `json:"period_end"`
	IssuedAt    string            `json:"issued_at"`
	PaidAt      *string           `json:"paid_at"`
	HostedURL   string            `json:"hosted_url"`
	PDFURL      string            `json:"pdf_url"`
	LineItems   []InvoiceLineItem `json:"line_items"`
}

type InvoiceLineItem struct {
	Description    string `json:"description"`
	Quantity       int    `json:"quantity"`
	UnitAmountCents int   `json:"unit_amount_cents"`
	AmountCents    int    `json:"amount_cents"`
}



type ProjectUsage struct {
	ProjectID          string `json:"project_id"`
	StorageBytes       int64  `json:"storage_bytes"`
	StorageQuotaBytes  int64  `json:"storage_quota_bytes"`
	BandwidthBytes     int64  `json:"bandwidth_bytes"`
	BandwidthQuotaBytes int64 `json:"bandwidth_quota_bytes"`
	APIRequests        int64  `json:"api_requests"`
	APIRequestsQuota   int64  `json:"api_requests_quota"`
	FileCount          int64  `json:"file_count"`
	PeriodStart        string `json:"period_start"`
	PeriodEnd          string `json:"period_end"`
}

type ProjectStatPoint struct {
	Date           string `json:"date"`
	Uploads        int    `json:"uploads"`
	Downloads      int    `json:"downloads"`
	StorageBytes   int64  `json:"storage_bytes"`
	BandwidthBytes int64  `json:"bandwidth_bytes"`
	APIRequests    int    `json:"api_requests"`
}



type DashboardTotals struct {
	StorageBytes       int64 `json:"storage_bytes"`
	StorageQuotaBytes  int64 `json:"storage_quota_bytes"`
	BandwidthBytes     int64 `json:"bandwidth_bytes"`
	BandwidthQuotaBytes int64 `json:"bandwidth_quota_bytes"`
	APIRequests        int64 `json:"api_requests"`
	APIRequestsQuota   int64 `json:"api_requests_quota"`
	FileCount          int64 `json:"file_count"`
	ProjectCount       int   `json:"project_count"`
}

type DashboardOverview struct {
	Totals        DashboardTotals    `json:"totals"`
	Trend         []ProjectStatPoint `json:"trend"`
	RecentUploads []Upload           `json:"recent_uploads"`
}
