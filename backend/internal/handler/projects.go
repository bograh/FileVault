package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/filevault/backend/internal/middleware"
	"github.com/filevault/backend/internal/service"
)

type ProjectHandler struct {
	projects *service.ProjectService
}

func NewProjectHandler(projects *service.ProjectService) *ProjectHandler {
	return &ProjectHandler{projects: projects}
}

type createProjectRequest struct {
	Name           string `json:"name"`
	Slug           string `json:"slug"`
	Description    string `json:"description,omitempty"`
	StorageRegion  string `json:"storage_region"`
	StorageBackend string `json:"storage_backend"`
}

func (h *ProjectHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	var req createProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, r, "Invalid request body.")
		return
	}

	if req.Name == "" || req.Slug == "" {
		BadRequest(w, r, "Name and slug are required.")
		return
	}

	project, err := h.projects.Create(r.Context(), service.CreateProjectParams{
		OwnerID:        user.UserID,
		Name:           req.Name,
		Slug:           req.Slug,
		Description:    req.Description,
		StorageRegion:  req.StorageRegion,
		StorageBackend: req.StorageBackend,
	})
	if err != nil {
		Error(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	JSON(w, r, http.StatusCreated, project)
}

func (h *ProjectHandler) List(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	projects, err := h.projects.List(r.Context(), user.UserID)
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, projects)
}

func (h *ProjectHandler) Get(w http.ResponseWriter, r *http.Request) {
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

	project, err := h.projects.Get(r.Context(), projectID)
	if err != nil {
		NotFound(w, r, "Project")
		return
	}

	JSON(w, r, http.StatusOK, project)
}

func (h *ProjectHandler) Update(w http.ResponseWriter, r *http.Request) {
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

	var patch map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		BadRequest(w, r, "Invalid request body.")
		return
	}

	params := service.UpdateProjectParams{}
	if v, ok := patch["name"].(string); ok {
		params.Name = &v
	}
	if v, ok := patch["description"].(string); ok {
		params.Description = &v
	}
	if v, ok := patch["max_file_size_bytes"].(float64); ok {
		i := int64(v)
		params.MaxFileSizeBytes = &i
	}
	if v, ok := patch["versioning_enabled"].(bool); ok {
		params.VersioningEnabled = &v
	}
	if v, ok := patch["custom_domain"].(string); ok {
		params.CustomDomain = &v
	}

	project, err := h.projects.Update(r.Context(), projectID, params)
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, project)
}

func (h *ProjectHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

	if err := h.projects.Delete(r.Context(), projectID); err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, nil)
}

func (h *ProjectHandler) Usage(w http.ResponseWriter, r *http.Request) {
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

	usage, err := h.projects.GetUsage(r.Context(), projectID)
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, usage)
}

func (h *ProjectHandler) Stats(w http.ResponseWriter, r *http.Request) {
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

	stats, err := h.projects.GetStats(r.Context(), projectID)
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, stats)
}
