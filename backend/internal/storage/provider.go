package storage

import (
	"context"
	"time"
)

// PutOptions configures presigned PUT URL generation.
type PutOptions struct {
	ContentType    string
	ContentLength  int64
	MaxFileSize    int64
	ChecksumSHA256 string
}

// Part represents a completed multipart upload part.
type Part struct {
	PartNumber int
	ETag       string
}

// ObjectMeta holds metadata about a stored object.
type ObjectMeta struct {
	ContentType   string
	ContentLength int64
	ETag          string
	LastModified  time.Time
}

// Provider defines the storage abstraction interface per PRD section 14.
type Provider interface {
	GeneratePresignedPUT(ctx context.Context, key string, ttl time.Duration, opts PutOptions) (string, error)
	GeneratePresignedGET(ctx context.Context, key string, ttl time.Duration) (string, error)
	InitMultipartUpload(ctx context.Context, key string, contentType string) (string, error)
	PresignMultipartPart(ctx context.Context, key, uploadID string, partNumber int, ttl time.Duration) (string, error)
	CompleteMultipartUpload(ctx context.Context, key, uploadID string, parts []Part) error
	AbortMultipartUpload(ctx context.Context, key, uploadID string) error
	DeleteObject(ctx context.Context, key string) error
	HeadObject(ctx context.Context, key string) (*ObjectMeta, error)
}
