package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/filevault/backend/internal/middleware"
	"github.com/filevault/backend/internal/service"
)

type UploadHandler struct {
	uploads  *service.UploadService
	projects *service.ProjectService
}

func NewUploadHandler(uploads *service.UploadService, projects *service.ProjectService) *UploadHandler {
	return &UploadHandler{uploads: uploads, projects: projects}
}

type createUploadRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	Folder      string `json:"folder,omitempty"`
	Acl         string `json:"acl,omitempty"`
}

func (h *UploadHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	projectID := chi.URLParam(r, "projectId")
	if err := h.projects.CheckOwnership(r.Context(), projectID, user.UserID); err != nil {
		NotFound(w, r, "Project")
		return
	}

	var req createUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, r, "Invalid request body.")
		return
	}

	if req.Filename == "" || req.ContentType == "" {
		BadRequest(w, r, "Filename and content_type are required.")
		return
	}

	result, err := h.uploads.Create(r.Context(), service.CreateUploadParams{
		ProjectID:   projectID,
		Filename:    req.Filename,
		ContentType: req.ContentType,
		SizeBytes:   req.SizeBytes,
		Folder:      req.Folder,
		Acl:         req.Acl,
	})
	if err != nil {
		Error(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	// Return both the upload record and the presigned URL
	JSON(w, r, http.StatusCreated, result)
}

func (h *UploadHandler) List(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	projectID := chi.URLParam(r, "projectId")
	if err := h.projects.CheckOwnership(r.Context(), projectID, user.UserID); err != nil {
		NotFound(w, r, "Project")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	result, err := h.uploads.List(r.Context(), service.ListUploadsParams{
		ProjectID: projectID,
		Status:    r.URL.Query().Get("status"),
		Folder:    r.URL.Query().Get("folder"),
		Search:    r.URL.Query().Get("search"),
		Page:      page,
		PageSize:  pageSize,
	})
	if err != nil {
		InternalError(w, r)
		return
	}

	hasMore := (result.Page * result.PageSize) < result.Total
	var nextCursor *string
	if hasMore {
		next := strconv.Itoa(result.Page + 1)
		nextCursor = &next
	}

	JSON(w, r, http.StatusOK, Page{
		Items:      result.Items,
		Total:      result.Total,
		Page:       result.Page,
		PageSize:   result.PageSize,
		HasMore:    hasMore,
		NextCursor: nextCursor,
	})
}

func (h *UploadHandler) Get(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	projectID := chi.URLParam(r, "projectId")
	uploadID := chi.URLParam(r, "uploadId")

	if err := h.projects.CheckOwnership(r.Context(), projectID, user.UserID); err != nil {
		NotFound(w, r, "Project")
		return
	}

	upload, err := h.uploads.Get(r.Context(), projectID, uploadID)
	if err != nil {
		NotFound(w, r, "Upload")
		return
	}

	JSON(w, r, http.StatusOK, upload)
}

func (h *UploadHandler) Delete(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	projectID := chi.URLParam(r, "projectId")
	uploadID := chi.URLParam(r, "uploadId")

	if err := h.projects.CheckOwnership(r.Context(), projectID, user.UserID); err != nil {
		NotFound(w, r, "Project")
		return
	}

	if err := h.uploads.Delete(r.Context(), projectID, uploadID); err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, nil)
}

type deleteManyRequest struct {
	UploadIDs []string `json:"upload_ids"`
}

func (h *UploadHandler) DeleteMany(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	projectID := chi.URLParam(r, "projectId")
	if err := h.projects.CheckOwnership(r.Context(), projectID, user.UserID); err != nil {
		NotFound(w, r, "Project")
		return
	}

	var req deleteManyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, r, "Invalid request body.")
		return
	}

	if err := h.uploads.DeleteMany(r.Context(), projectID, req.UploadIDs); err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, nil)
}

func (h *UploadHandler) SignedURL(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	projectID := chi.URLParam(r, "projectId")
	uploadID := chi.URLParam(r, "uploadId")

	if err := h.projects.CheckOwnership(r.Context(), projectID, user.UserID); err != nil {
		NotFound(w, r, "Project")
		return
	}

	expiresIn := 3600
	if v := r.URL.Query().Get("expires_in"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			expiresIn = parsed
		}
	}

	result, err := h.uploads.GetSignedURL(r.Context(), projectID, uploadID, expiresIn)
	if err != nil {
		NotFound(w, r, "Upload")
		return
	}

	JSON(w, r, http.StatusOK, result)
}

func (h *UploadHandler) Complete(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	projectID := chi.URLParam(r, "projectId")
	uploadID := chi.URLParam(r, "uploadId")

	if err := h.projects.CheckOwnership(r.Context(), projectID, user.UserID); err != nil {
		NotFound(w, r, "Project")
		return
	}

	var req struct {
		Checksum *string `json:"checksum_sha256"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if err := h.uploads.MarkCompleted(r.Context(), projectID, uploadID, req.Checksum); err != nil {
		InternalError(w, r)
		return
	}

	upload, _ := h.uploads.Get(r.Context(), projectID, uploadID)
	JSON(w, r, http.StatusOK, upload)
}
