package service

import (
	"context"
	"fmt"
	"time"

	"github.com/filevault/backend/internal/domain"
	"github.com/filevault/backend/internal/storage"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oklog/ulid/v2"
)

type UploadService struct {
	db      *pgxpool.Pool
	storage storage.Provider
}

func NewUploadService(db *pgxpool.Pool, storageProvider storage.Provider) *UploadService {
	return &UploadService{db: db, storage: storageProvider}
}

type CreateUploadParams struct {
	ProjectID   string
	Filename    string
	ContentType string
	SizeBytes   int64
	Folder      string
	Acl         string
}

type CreateUploadResult struct {
	Upload       *domain.Upload `json:"upload"`
	PresignedURL string         `json:"presigned_url"`
}

func (s *UploadService) Create(ctx context.Context, params CreateUploadParams) (*CreateUploadResult, error) {
	uploadID := "upl_" + ulid.Make().String()
	now := time.Now()

	folder := params.Folder
	if folder == "" {
		folder = "/"
	}

	acl := params.Acl
	if acl == "" {
		acl = "private"
	}

	// Get project for bucket prefix
	var bucketPrefix string
	err := s.db.QueryRow(ctx, "SELECT bucket_prefix FROM projects WHERE id = $1", params.ProjectID).Scan(&bucketPrefix)
	if err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}

	storageKey := fmt.Sprintf("%s/%d/%02d/%s/%s",
		bucketPrefix, now.Year(), now.Month(), uploadID, params.Filename)

	upload := &domain.Upload{
		ID:          uploadID,
		ProjectID:   params.ProjectID,
		Filename:    params.Filename,
		ContentType: params.ContentType,
		SizeBytes:   params.SizeBytes,
		StorageKey:  storageKey,
		Status:      domain.UploadPending,
		Acl:         domain.UploadAcl(acl),
		Folder:      folder,
		Metadata:    map[string]string{},
		CreatedAt:   now,
	}

	_, err = s.db.Exec(ctx,
		`INSERT INTO uploads (id, project_id, filename, content_type, size_bytes, storage_key, status, acl, folder, metadata, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '{}', NOW())`,
		uploadID, params.ProjectID, params.Filename, params.ContentType,
		params.SizeBytes, storageKey, "pending", acl, folder)
	if err != nil {
		return nil, fmt.Errorf("creating upload record: %w", err)
	}

	// Generate presigned PUT URL
	presignedURL, err := s.storage.GeneratePresignedPUT(ctx, storageKey, 15*time.Minute, storage.PutOptions{
		ContentType:   params.ContentType,
		ContentLength: params.SizeBytes,
	})
	if err != nil {
		return nil, fmt.Errorf("generating presigned URL: %w", err)
	}

	return &CreateUploadResult{
		Upload:       upload,
		PresignedURL: presignedURL,
	}, nil
}

func (s *UploadService) Get(ctx context.Context, projectID, uploadID string) (*domain.Upload, error) {
	u := &domain.Upload{}
	err := s.db.QueryRow(ctx,
		`SELECT id, project_id, filename, content_type, size_bytes, storage_key,
		 status, checksum_sha256, acl, folder, metadata, created_at, completed_at, deleted_at
		 FROM uploads WHERE id = $1 AND project_id = $2`,
		uploadID, projectID).Scan(
		&u.ID, &u.ProjectID, &u.Filename, &u.ContentType, &u.SizeBytes,
		&u.StorageKey, &u.Status, &u.ChecksumSHA256, &u.Acl, &u.Folder,
		&u.Metadata, &u.CreatedAt, &u.CompletedAt, &u.DeletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("getting upload: %w", err)
	}
	return u, nil
}

type ListUploadsParams struct {
	ProjectID string
	Status    string
	Folder    string
	Search    string
	Page      int
	PageSize  int
}

type ListUploadsResult struct {
	Items   []domain.Upload
	Total   int
	Page    int
	PageSize int
}

func (s *UploadService) List(ctx context.Context, params ListUploadsParams) (*ListUploadsResult, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 {
		params.PageSize = 20
	}
	offset := (params.Page - 1) * params.PageSize

	// Count total
	countQuery := `SELECT COUNT(*) FROM uploads WHERE project_id = $1 AND deleted_at IS NULL`
	args := []interface{}{params.ProjectID}
	argIdx := 2

	if params.Status != "" {
		countQuery += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, params.Status)
		argIdx++
	}
	if params.Folder != "" {
		countQuery += fmt.Sprintf(" AND folder = $%d", argIdx)
		args = append(args, params.Folder)
		argIdx++
	}
	if params.Search != "" {
		countQuery += fmt.Sprintf(" AND (filename ILIKE '%%' || $%d || '%%' OR content_type ILIKE '%%' || $%d || '%%')", argIdx, argIdx)
		args = append(args, params.Search)
		argIdx++
	}

	var total int
	err := s.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("counting uploads: %w", err)
	}

	// Fetch page
	selectQuery := `SELECT id, project_id, filename, content_type, size_bytes, storage_key,
		status, checksum_sha256, acl, folder, metadata, created_at, completed_at, deleted_at
		FROM uploads WHERE project_id = $1 AND deleted_at IS NULL`
	selectArgs := []interface{}{params.ProjectID}
	selectArgIdx := 2

	if params.Status != "" {
		selectQuery += fmt.Sprintf(" AND status = $%d", selectArgIdx)
		selectArgs = append(selectArgs, params.Status)
		selectArgIdx++
	}
	if params.Folder != "" {
		selectQuery += fmt.Sprintf(" AND folder = $%d", selectArgIdx)
		selectArgs = append(selectArgs, params.Folder)
		selectArgIdx++
	}
	if params.Search != "" {
		selectQuery += fmt.Sprintf(" AND (filename ILIKE '%%' || $%d || '%%' OR content_type ILIKE '%%' || $%d || '%%')", selectArgIdx, selectArgIdx)
		selectArgs = append(selectArgs, params.Search)
		selectArgIdx++
	}

	selectQuery += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", selectArgIdx, selectArgIdx+1)
	selectArgs = append(selectArgs, params.PageSize, offset)

	rows, err := s.db.Query(ctx, selectQuery, selectArgs...)
	if err != nil {
		return nil, fmt.Errorf("listing uploads: %w", err)
	}
	defer rows.Close()

	var uploads []domain.Upload
	for rows.Next() {
		var u domain.Upload
		err := rows.Scan(
			&u.ID, &u.ProjectID, &u.Filename, &u.ContentType, &u.SizeBytes,
			&u.StorageKey, &u.Status, &u.ChecksumSHA256, &u.Acl, &u.Folder,
			&u.Metadata, &u.CreatedAt, &u.CompletedAt, &u.DeletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning upload: %w", err)
		}
		if u.Metadata == nil {
			u.Metadata = map[string]string{}
		}
		uploads = append(uploads, u)
	}
	if uploads == nil {
		uploads = []domain.Upload{}
	}

	return &ListUploadsResult{
		Items:    uploads,
		Total:    total,
		Page:     params.Page,
		PageSize: params.PageSize,
	}, nil
}

func (s *UploadService) Delete(ctx context.Context, projectID, uploadID string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE uploads SET deleted_at = NOW(), status = 'deleted' WHERE id = $1 AND project_id = $2`,
		uploadID, projectID)
	if err != nil {
		return fmt.Errorf("soft deleting upload: %w", err)
	}
	return nil
}

func (s *UploadService) DeleteMany(ctx context.Context, projectID string, uploadIDs []string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE uploads SET deleted_at = NOW(), status = 'deleted' WHERE id = ANY($1) AND project_id = $2`,
		uploadIDs, projectID)
	if err != nil {
		return fmt.Errorf("bulk soft deleting uploads: %w", err)
	}
	return nil
}

func (s *UploadService) GetSignedURL(ctx context.Context, projectID, uploadID string, expiresIn int) (*SignedURLResult, error) {
	var storageKey string
	err := s.db.QueryRow(ctx,
		"SELECT storage_key FROM uploads WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL",
		uploadID, projectID).Scan(&storageKey)
	if err != nil {
		return nil, fmt.Errorf("upload not found: %w", err)
	}

	if expiresIn <= 0 {
		expiresIn = 3600
	}

	url, err := s.storage.GeneratePresignedGET(ctx, storageKey, time.Duration(expiresIn)*time.Second)
	if err != nil {
		return nil, fmt.Errorf("generating signed URL: %w", err)
	}

	return &SignedURLResult{
		URL:       url,
		ExpiresAt: time.Now().Add(time.Duration(expiresIn) * time.Second).Format(time.RFC3339),
	}, nil
}

type SignedURLResult struct {
	URL       string `json:"url"`
	ExpiresAt string `json:"expires_at"`
}

// MarkCompleted updates the upload status after successful S3 upload.
func (s *UploadService) MarkCompleted(ctx context.Context, projectID, uploadID string, checksum *string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE uploads SET status = 'completed', completed_at = NOW(), checksum_sha256 = $3
		 WHERE id = $1 AND project_id = $2`,
		uploadID, projectID, checksum)
	if err != nil {
		return fmt.Errorf("marking upload completed: %w", err)
	}
	return nil
}
