package service

import (
	"context"
	"fmt"
	"time"

	"github.com/filevault/backend/internal/domain"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oklog/ulid/v2"
)

type ProjectService struct {
	db *pgxpool.Pool
}

func NewProjectService(db *pgxpool.Pool) *ProjectService {
	return &ProjectService{db: db}
}

type CreateProjectParams struct {
	OwnerID        string
	Name           string
	Slug           string
	Description    string
	StorageRegion  string
	StorageBackend string
}

func (s *ProjectService) Create(ctx context.Context, params CreateProjectParams) (*domain.Project, error) {
	id := "proj_" + ulid.Make().String()
	bucketPrefix := "fv-" + params.Slug

	project := &domain.Project{
		ID:                 id,
		OwnerID:            params.OwnerID,
		Name:               params.Name,
		Slug:               params.Slug,
		Description:        params.Description,
		StorageRegion:      domain.StorageRegion(params.StorageRegion),
		StorageBackend:     domain.StorageBackend(params.StorageBackend),
		BucketPrefix:       bucketPrefix,
		MaxFileSizeBytes:   500 * 1024 * 1024, // 500MB default
		VersioningEnabled:  false,
		BillingProvider:    domain.ProviderStripe,
		SubscriptionTier:   domain.TierHobby,
		SubscriptionStatus: domain.StatusActive,
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	_, err := s.db.Exec(ctx,
		`INSERT INTO projects (id, owner_id, name, slug, description, storage_region, storage_backend,
		 bucket_prefix, max_file_size_bytes, versioning_enabled, billing_provider,
		 subscription_tier, subscription_status, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())`,
		id, params.OwnerID, params.Name, params.Slug, params.Description,
		params.StorageRegion, params.StorageBackend, bucketPrefix,
		project.MaxFileSizeBytes, false, "stripe", "hobby", "active")
	if err != nil {
		return nil, fmt.Errorf("creating project: %w", err)
	}

	return project, nil
}

func (s *ProjectService) Get(ctx context.Context, projectID string) (*domain.Project, error) {
	p := &domain.Project{}
	err := s.db.QueryRow(ctx,
		`SELECT id, owner_id, name, slug, description, storage_region, storage_backend,
		 bucket_prefix, max_file_size_bytes, allowed_mime_types, versioning_enabled,
		 custom_domain, billing_provider, subscription_tier, subscription_status,
		 created_at, updated_at
		 FROM projects WHERE id = $1`, projectID).Scan(
		&p.ID, &p.OwnerID, &p.Name, &p.Slug, &p.Description,
		&p.StorageRegion, &p.StorageBackend, &p.BucketPrefix,
		&p.MaxFileSizeBytes, &p.AllowedMimeTypes, &p.VersioningEnabled,
		&p.CustomDomain, &p.BillingProvider, &p.SubscriptionTier,
		&p.SubscriptionStatus, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("getting project: %w", err)
	}
	return p, nil
}

func (s *ProjectService) List(ctx context.Context, ownerID string) ([]domain.Project, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, owner_id, name, slug, description, storage_region, storage_backend,
		 bucket_prefix, max_file_size_bytes, allowed_mime_types, versioning_enabled,
		 custom_domain, billing_provider, subscription_tier, subscription_status,
		 created_at, updated_at
		 FROM projects WHERE owner_id = $1 ORDER BY created_at DESC`, ownerID)
	if err != nil {
		return nil, fmt.Errorf("listing projects: %w", err)
	}
	defer rows.Close()

	var projects []domain.Project
	for rows.Next() {
		var p domain.Project
		err := rows.Scan(
			&p.ID, &p.OwnerID, &p.Name, &p.Slug, &p.Description,
			&p.StorageRegion, &p.StorageBackend, &p.BucketPrefix,
			&p.MaxFileSizeBytes, &p.AllowedMimeTypes, &p.VersioningEnabled,
			&p.CustomDomain, &p.BillingProvider, &p.SubscriptionTier,
			&p.SubscriptionStatus, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning project: %w", err)
		}
		projects = append(projects, p)
	}
	if projects == nil {
		projects = []domain.Project{}
	}
	return projects, nil
}

type UpdateProjectParams struct {
	Name              *string
	Description       *string
	MaxFileSizeBytes  *int64
	AllowedMimeTypes  []string
	VersioningEnabled *bool
	CustomDomain      *string
}

func (s *ProjectService) Update(ctx context.Context, projectID string, params UpdateProjectParams) (*domain.Project, error) {
	// Build dynamic update - simple approach for now
	_, err := s.db.Exec(ctx,
		`UPDATE projects SET
		 name = COALESCE($2, name),
		 description = COALESCE($3, description),
		 max_file_size_bytes = COALESCE($4, max_file_size_bytes),
		 allowed_mime_types = COALESCE($5, allowed_mime_types),
		 versioning_enabled = COALESCE($6, versioning_enabled),
		 custom_domain = COALESCE($7, custom_domain),
		 updated_at = NOW()
		 WHERE id = $1`,
		projectID, params.Name, params.Description, params.MaxFileSizeBytes,
		params.AllowedMimeTypes, params.VersioningEnabled, params.CustomDomain)
	if err != nil {
		return nil, fmt.Errorf("updating project: %w", err)
	}

	return s.Get(ctx, projectID)
}

func (s *ProjectService) Delete(ctx context.Context, projectID string) error {
	_, err := s.db.Exec(ctx, "DELETE FROM projects WHERE id = $1", projectID)
	if err != nil {
		return fmt.Errorf("deleting project: %w", err)
	}
	return nil
}

func (s *ProjectService) GetUsage(ctx context.Context, projectID string) (*domain.ProjectUsage, error) {
	now := time.Now()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	periodEnd := periodStart.AddDate(0, 1, 0).Add(-time.Second)

	// Get current file count and storage
	var fileCount int64
	var storageBytes int64
	err := s.db.QueryRow(ctx,
		`SELECT COUNT(*), COALESCE(SUM(size_bytes), 0)
		 FROM uploads WHERE project_id = $1 AND status = 'completed' AND deleted_at IS NULL`,
		projectID).Scan(&fileCount, &storageBytes)
	if err != nil {
		return nil, fmt.Errorf("getting file stats: %w", err)
	}

	// Get usage record for current period
	var bandwidthBytes, apiRequests int64
	err = s.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(bandwidth_bytes), 0), COALESCE(SUM(api_requests), 0)
		 FROM usage_records WHERE project_id = $1 AND period_start >= $2 AND period_end <= $3`,
		projectID, periodStart, periodEnd).Scan(&bandwidthBytes, &apiRequests)
	if err != nil {
		// No usage records yet is fine
		bandwidthBytes = 0
		apiRequests = 0
	}

	// Get quota from subscription tier
	tier := domain.TierHobby
	s.db.QueryRow(ctx, "SELECT subscription_tier FROM projects WHERE id = $1", projectID).Scan(&tier)

	quotas := getQuotaForTier(tier)

	return &domain.ProjectUsage{
		ProjectID:           projectID,
		StorageBytes:        storageBytes,
		StorageQuotaBytes:   quotas.StorageBytes,
		BandwidthBytes:      bandwidthBytes,
		BandwidthQuotaBytes: quotas.BandwidthBytes,
		APIRequests:         apiRequests,
		APIRequestsQuota:    quotas.APIRequests,
		FileCount:           fileCount,
		PeriodStart:         periodStart.Format(time.RFC3339),
		PeriodEnd:           periodEnd.Format(time.RFC3339),
	}, nil
}

func (s *ProjectService) GetStats(ctx context.Context, projectID string) ([]domain.ProjectStatPoint, error) {
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -29)

	rows, err := s.db.Query(ctx,
		`SELECT date, uploads, downloads, storage_bytes, bandwidth_bytes, api_requests
		 FROM daily_stats WHERE project_id = $1 AND date >= $2 AND date <= $3
		 ORDER BY date ASC`,
		projectID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))
	if err != nil {
		return nil, fmt.Errorf("getting stats: %w", err)
	}
	defer rows.Close()

	statsMap := make(map[string]domain.ProjectStatPoint)
	for rows.Next() {
		var sp domain.ProjectStatPoint
		var date time.Time
		err := rows.Scan(&date, &sp.Uploads, &sp.Downloads, &sp.StorageBytes, &sp.BandwidthBytes, &sp.APIRequests)
		if err != nil {
			return nil, fmt.Errorf("scanning stat: %w", err)
		}
		sp.Date = date.Format("2006-01-02")
		statsMap[sp.Date] = sp
	}

	// Fill in missing dates with zeros
	var stats []domain.ProjectStatPoint
	for d := startDate; !d.After(endDate); d = d.AddDate(0, 0, 1) {
		dateStr := d.Format("2006-01-02")
		if sp, ok := statsMap[dateStr]; ok {
			stats = append(stats, sp)
		} else {
			stats = append(stats, domain.ProjectStatPoint{Date: dateStr})
		}
	}

	return stats, nil
}

// CheckOwnership verifies the user owns the project.
func (s *ProjectService) CheckOwnership(ctx context.Context, projectID, ownerID string) error {
	var id string
	err := s.db.QueryRow(ctx, "SELECT id FROM projects WHERE id = $1 AND owner_id = $2", projectID, ownerID).Scan(&id)
	if err != nil {
		return fmt.Errorf("project not found or access denied")
	}
	return nil
}

type tierQuota struct {
	StorageBytes   int64
	BandwidthBytes int64
	APIRequests    int64
}

func getQuotaForTier(tier domain.SubscriptionTier) tierQuota {
	switch tier {
	case domain.TierStarter:
		return tierQuota{
			StorageBytes:   50 * 1024 * 1024 * 1024,  // 50GB
			BandwidthBytes: 100 * 1024 * 1024 * 1024, // 100GB
			APIRequests:    100_000,
		}
	case domain.TierPro:
		return tierQuota{
			StorageBytes:   500 * 1024 * 1024 * 1024,  // 500GB
			BandwidthBytes: 1024 * 1024 * 1024 * 1024, // 1TB
			APIRequests:    1_000_000,
		}
	case domain.TierEnterprise:
		return tierQuota{
			StorageBytes:   10 * 1024 * 1024 * 1024 * 1024, // 10TB
			BandwidthBytes: 10 * 1024 * 1024 * 1024 * 1024,
			APIRequests:    100_000_000,
		}
	default: // hobby
		return tierQuota{
			StorageBytes:   5 * 1024 * 1024 * 1024,  // 5GB
			BandwidthBytes: 10 * 1024 * 1024 * 1024, // 10GB
			APIRequests:    10_000,
		}
	}
}
