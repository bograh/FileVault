package handler

import (
	"encoding/json"
	"net/http"

	"github.com/filevault/backend/internal/domain"
	"github.com/filevault/backend/internal/middleware"
	"github.com/filevault/backend/internal/service"
)

type BillingHandler struct {
	billing *service.BillingService
}

func NewBillingHandler(billing *service.BillingService) *BillingHandler {
	return &BillingHandler{billing: billing}
}

func (h *BillingHandler) Plans(w http.ResponseWriter, r *http.Request) {
	plans := h.billing.GetPlans()
	JSON(w, r, http.StatusOK, plans)
}

func (h *BillingHandler) Subscription(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	sub, err := h.billing.GetSubscription(r.Context(), user.UserID)
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, sub)
}

func (h *BillingHandler) Invoices(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	invoices, err := h.billing.GetInvoices(r.Context(), user.UserID)
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, invoices)
}

type changePlanRequest struct {
	PlanID string `json:"plan_id"`
}

func (h *BillingHandler) ChangePlan(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	var req changePlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, r, "Invalid request body.")
		return
	}

	sub, err := h.billing.ChangePlan(r.Context(), user.UserID, domain.SubscriptionTier(req.PlanID))
	if err != nil {
		Error(w, r, http.StatusBadRequest, "INVALID_PLAN", err.Error())
		return
	}

	JSON(w, r, http.StatusOK, sub)
}

func (h *BillingHandler) Checkout(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement Stripe/Paystack checkout session creation
	JSON(w, r, http.StatusOK, map[string]string{
		"url": "https://checkout.stripe.com/placeholder",
	})
}

func (h *BillingHandler) Portal(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement customer portal link generation
	JSON(w, r, http.StatusOK, map[string]string{
		"url": "https://billing.stripe.com/placeholder",
	})
}
