package service

import (
	"context"
	"fmt"
	"time"

	"github.com/filevault/backend/internal/domain"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DashboardService struct {
	db       *pgxpool.Pool
	projects *ProjectService
}

func NewDashboardService(db *pgxpool.Pool, projects *ProjectService) *DashboardService {
	return &DashboardService{db: db, projects: projects}
}

func (s *DashboardService) GetOverview(ctx context.Context, userID string) (*domain.DashboardOverview, error) {
	// Get all user's projects
	projectList, err := s.projects.List(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("listing projects: %w", err)
	}

	totals := domain.DashboardTotals{
		ProjectCount: len(projectList),
	}

	// Aggregate usage across all projects
	for _, p := range projectList {
		usage, err := s.projects.GetUsage(ctx, p.ID)
		if err != nil {
			continue // skip projects with no usage data
		}
		totals.StorageBytes += usage.StorageBytes
		totals.StorageQuotaBytes += usage.StorageQuotaBytes
		totals.BandwidthBytes += usage.BandwidthBytes
		totals.BandwidthQuotaBytes += usage.BandwidthQuotaBytes
		totals.APIRequests += usage.APIRequests
		totals.APIRequestsQuota += usage.APIRequestsQuota
		totals.FileCount += usage.FileCount
	}

	// Get 30-day trend aggregated across all projects
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -29)

	rows, err := s.db.Query(ctx,
		`SELECT ds.date, SUM(ds.uploads), SUM(ds.downloads), SUM(ds.storage_bytes),
		 SUM(ds.bandwidth_bytes), SUM(ds.api_requests)
		 FROM daily_stats ds
		 JOIN projects p ON p.id = ds.project_id
		 WHERE p.owner_id = $1 AND ds.date >= $2 AND ds.date <= $3
		 GROUP BY ds.date ORDER BY ds.date ASC`,
		userID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))

	trendMap := make(map[string]domain.ProjectStatPoint)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var sp domain.ProjectStatPoint
			var date time.Time
			rows.Scan(&date, &sp.Uploads, &sp.Downloads, &sp.StorageBytes, &sp.BandwidthBytes, &sp.APIRequests)
			sp.Date = date.Format("2006-01-02")
			trendMap[sp.Date] = sp
		}
	}

	// Fill missing dates
	var trend []domain.ProjectStatPoint
	for d := startDate; !d.After(endDate); d = d.AddDate(0, 0, 1) {
		dateStr := d.Format("2006-01-02")
		if sp, ok := trendMap[dateStr]; ok {
			trend = append(trend, sp)
		} else {
			trend = append(trend, domain.ProjectStatPoint{Date: dateStr})
		}
	}

	// Get recent uploads
	var recentUploads []domain.Upload
	uploadRows, err := s.db.Query(ctx,
		`SELECT u.id, u.project_id, u.filename, u.content_type, u.size_bytes, u.storage_key,
		 u.status, u.checksum_sha256, u.acl, u.folder, u.metadata, u.created_at, u.completed_at, u.deleted_at
		 FROM uploads u
		 JOIN projects p ON p.id = u.project_id
		 WHERE p.owner_id = $1 AND u.deleted_at IS NULL AND u.status != 'deleted'
		 ORDER BY u.created_at DESC LIMIT 8`, userID)
	if err == nil {
		defer uploadRows.Close()
		for uploadRows.Next() {
			var u domain.Upload
			uploadRows.Scan(
				&u.ID, &u.ProjectID, &u.Filename, &u.ContentType, &u.SizeBytes,
				&u.StorageKey, &u.Status, &u.ChecksumSHA256, &u.Acl, &u.Folder,
				&u.Metadata, &u.CreatedAt, &u.CompletedAt, &u.DeletedAt,
			)
			if u.Metadata == nil {
				u.Metadata = map[string]string{}
			}
			recentUploads = append(recentUploads, u)
		}
	}
	if recentUploads == nil {
		recentUploads = []domain.Upload{}
	}

	return &domain.DashboardOverview{
		Totals:        totals,
		Trend:         trend,
		RecentUploads: recentUploads,
	}, nil
}
