package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/filevault/backend/internal/middleware"
	"github.com/filevault/backend/internal/service"
)

type APIKeyHandler struct {
	apikeys  *service.APIKeyService
	projects *service.ProjectService
}

func NewAPIKeyHandler(apikeys *service.APIKeyService, projects *service.ProjectService) *APIKeyHandler {
	return &APIKeyHandler{apikeys: apikeys, projects: projects}
}

type createAPIKeyRequest struct {
	Name        string   `json:"name"`
	Scopes      []string `json:"scopes"`
	Environment string   `json:"environment"`
}

func (h *APIKeyHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req createAPIKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, r, "Invalid request body.")
		return
	}

	if req.Name == "" {
		BadRequest(w, r, "Name is required.")
		return
	}
	if req.Environment == "" {
		req.Environment = "live"
	}
	if len(req.Scopes) == 0 {
		req.Scopes = []string{"read", "write"}
	}

	key, err := h.apikeys.Create(r.Context(), service.CreateAPIKeyParams{
		ProjectID:   projectID,
		Name:        req.Name,
		Scopes:      req.Scopes,
		Environment: req.Environment,
	})
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusCreated, key)
}

func (h *APIKeyHandler) List(w http.ResponseWriter, r *http.Request) {
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

	keys, err := h.apikeys.List(r.Context(), projectID)
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, keys)
}

func (h *APIKeyHandler) Revoke(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	projectID := chi.URLParam(r, "projectId")
	keyID := chi.URLParam(r, "keyId")

	if err := h.projects.CheckOwnership(r.Context(), projectID, user.UserID); err != nil {
		NotFound(w, r, "Project")
		return
	}

	if err := h.apikeys.Revoke(r.Context(), projectID, keyID); err != nil {
		NotFound(w, r, "API key")
		return
	}

	JSON(w, r, http.StatusOK, nil)
}
