package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/filevault/backend/internal/middleware"
	"github.com/filevault/backend/internal/service"
)

type WebhookHandler struct {
	webhooks *service.WebhookService
	projects *service.ProjectService
}

func NewWebhookHandler(webhooks *service.WebhookService, projects *service.ProjectService) *WebhookHandler {
	return &WebhookHandler{webhooks: webhooks, projects: projects}
}

type createWebhookRequest struct {
	URL    string   `json:"url"`
	Events []string `json:"events"`
}

func (h *WebhookHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req createWebhookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, r, "Invalid request body.")
		return
	}

	if req.URL == "" || len(req.Events) == 0 {
		BadRequest(w, r, "URL and events are required.")
		return
	}

	endpoint, err := h.webhooks.Create(r.Context(), service.CreateWebhookParams{
		ProjectID: projectID,
		URL:       req.URL,
		Events:    req.Events,
	})
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusCreated, endpoint)
}

func (h *WebhookHandler) List(w http.ResponseWriter, r *http.Request) {
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

	endpoints, err := h.webhooks.List(r.Context(), projectID)
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, endpoints)
}

func (h *WebhookHandler) Update(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	projectID := chi.URLParam(r, "projectId")
	endpointID := chi.URLParam(r, "webhookId")

	if err := h.projects.CheckOwnership(r.Context(), projectID, user.UserID); err != nil {
		NotFound(w, r, "Project")
		return
	}

	var patch map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		BadRequest(w, r, "Invalid request body.")
		return
	}

	var url *string
	var events []string
	var enabled *bool

	if v, ok := patch["url"].(string); ok {
		url = &v
	}
	if v, ok := patch["events"].([]interface{}); ok {
		for _, e := range v {
			if s, ok := e.(string); ok {
				events = append(events, s)
			}
		}
	}
	if v, ok := patch["enabled"].(bool); ok {
		enabled = &v
	}

	endpoint, err := h.webhooks.Update(r.Context(), projectID, endpointID, url, events, enabled)
	if err != nil {
		NotFound(w, r, "Webhook")
		return
	}

	JSON(w, r, http.StatusOK, endpoint)
}

func (h *WebhookHandler) Delete(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	projectID := chi.URLParam(r, "projectId")
	endpointID := chi.URLParam(r, "webhookId")

	if err := h.projects.CheckOwnership(r.Context(), projectID, user.UserID); err != nil {
		NotFound(w, r, "Project")
		return
	}

	if err := h.webhooks.Delete(r.Context(), projectID, endpointID); err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, nil)
}

func (h *WebhookHandler) Deliveries(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	projectID := chi.URLParam(r, "projectId")
	endpointID := chi.URLParam(r, "webhookId")

	if err := h.projects.CheckOwnership(r.Context(), projectID, user.UserID); err != nil {
		NotFound(w, r, "Project")
		return
	}

	deliveries, err := h.webhooks.ListDeliveries(r.Context(), endpointID)
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, deliveries)
}

func (h *WebhookHandler) SendTest(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	projectID := chi.URLParam(r, "projectId")
	endpointID := chi.URLParam(r, "webhookId")

	if err := h.projects.CheckOwnership(r.Context(), projectID, user.UserID); err != nil {
		NotFound(w, r, "Project")
		return
	}

	delivery, err := h.webhooks.SendTest(r.Context(), projectID, endpointID)
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, delivery)
}
