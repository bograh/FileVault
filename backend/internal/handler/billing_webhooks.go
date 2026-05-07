package handler

import (
	"io"
	"net/http"

	"github.com/filevault/backend/internal/billing"
)

// BillingWebhookHandler handles incoming webhooks from payment providers.
type BillingWebhookHandler struct {
	stripe   billing.BillingProvider
	paystack billing.BillingProvider
}

func NewBillingWebhookHandler(stripe, paystack billing.BillingProvider) *BillingWebhookHandler {
	return &BillingWebhookHandler{stripe: stripe, paystack: paystack}
}

// StripeWebhook handles POST /webhooks/stripe
func (h *BillingWebhookHandler) StripeWebhook(w http.ResponseWriter, r *http.Request) {
	if h.stripe == nil {
		Error(w, r, http.StatusNotImplemented, "NOT_CONFIGURED", "Stripe not configured.")
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 64*1024))
	if err != nil {
		BadRequest(w, r, "Failed to read request body.")
		return
	}

	sig := r.Header.Get("Stripe-Signature")
	if err := h.stripe.HandleWebhook(r.Context(), body, sig); err != nil {
		Error(w, r, http.StatusBadRequest, "WEBHOOK_ERROR", err.Error())
		return
	}

	JSON(w, r, http.StatusOK, map[string]string{"status": "ok"})
}

// PaystackWebhook handles POST /webhooks/paystack
func (h *BillingWebhookHandler) PaystackWebhook(w http.ResponseWriter, r *http.Request) {
	if h.paystack == nil {
		Error(w, r, http.StatusNotImplemented, "NOT_CONFIGURED", "Paystack not configured.")
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 64*1024))
	if err != nil {
		BadRequest(w, r, "Failed to read request body.")
		return
	}

	sig := r.Header.Get("X-Paystack-Signature")
	if err := h.paystack.HandleWebhook(r.Context(), body, sig); err != nil {
		Error(w, r, http.StatusBadRequest, "WEBHOOK_ERROR", err.Error())
		return
	}

	JSON(w, r, http.StatusOK, map[string]string{"status": "ok"})
}
