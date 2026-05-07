package handler

import (
	"net/http"

	"github.com/filevault/backend/internal/middleware"
	"github.com/filevault/backend/internal/service"
)

type DashboardHandler struct {
	dashboard *service.DashboardService
}

func NewDashboardHandler(dashboard *service.DashboardService) *DashboardHandler {
	return &DashboardHandler{dashboard: dashboard}
}

func (h *DashboardHandler) Overview(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	overview, err := h.dashboard.GetOverview(r.Context(), user.UserID)
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, overview)
}
