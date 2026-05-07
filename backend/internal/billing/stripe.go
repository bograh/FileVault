package billing

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/filevault/backend/internal/domain"
	"github.com/jackc/pgx/v5/pgxpool"
)

const stripeAPIBase = "https://api.stripe.com/v1"

// StripeProvider implements the BillingProvider interface for Stripe.
type StripeProvider struct {
	secretKey     string
	webhookSecret string
	db            *pgxpool.Pool
	client        *http.Client
	logger        *slog.Logger
}

func NewStripeProvider(secretKey, webhookSecret string, db *pgxpool.Pool, logger *slog.Logger) *StripeProvider {
	return &StripeProvider{
		secretKey:     secretKey,
		webhookSecret: webhookSecret,
		db:            db,
		client:        &http.Client{Timeout: 15 * time.Second},
		logger:        logger,
	}
}

// CreateCheckoutSession creates a Stripe Checkout session for plan subscription.
func (s *StripeProvider) CreateCheckoutSession(ctx context.Context, req CheckoutRequest) (*CheckoutSession, error) {
	form := url.Values{}
	form.Set("mode", "subscription")
	form.Set("success_url", req.SuccessURL)
	form.Set("cancel_url", req.CancelURL)
	form.Set("client_reference_id", req.UserID)
	form.Set("metadata[user_id]", req.UserID)
	form.Set("metadata[plan_id]", req.PlanID)

	// Map plan to Stripe price ID
	priceID := s.priceIDForPlan(req.PlanID)
	if priceID == "" {
		return nil, fmt.Errorf("no Stripe price configured for plan %s", req.PlanID)
	}
	form.Set("line_items[0][price]", priceID)
	form.Set("line_items[0][quantity]", "1")

	// Check if user already has a Stripe customer
	customerID, _ := s.getCustomerID(ctx, req.UserID)
	if customerID != "" {
		form.Set("customer", customerID)
	} else {
		form.Set("customer_creation", "always")
	}

	body, err := s.stripeRequest(ctx, http.MethodPost, "/checkout/sessions", form)
	if err != nil {
		return nil, fmt.Errorf("creating checkout session: %w", err)
	}

	var result struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decoding checkout response: %w", err)
	}

	return &CheckoutSession{URL: result.URL}, nil
}

// CreateCustomerPortalLink creates a Stripe Customer Portal session.
func (s *StripeProvider) CreateCustomerPortalLink(ctx context.Context, customerID string) (string, error) {
	form := url.Values{}
	form.Set("customer", customerID)

	body, err := s.stripeRequest(ctx, http.MethodPost, "/billing_portal/sessions", form)
	if err != nil {
		return "", fmt.Errorf("creating portal session: %w", err)
	}

	var result struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("decoding portal response: %w", err)
	}

	return result.URL, nil
}

// GetInvoices retrieves invoices for a Stripe customer.
func (s *StripeProvider) GetInvoices(ctx context.Context, customerID string) ([]domain.Invoice, error) {
	form := url.Values{}
	form.Set("customer", customerID)
	form.Set("limit", "20")
	form.Set("status", "paid")

	body, err := s.stripeRequest(ctx, http.MethodGet, "/invoices?"+form.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("fetching invoices: %w", err)
	}

	var result struct {
		Data []struct {
			ID                 string `json:"id"`
			Number             string `json:"number"`
			Status             string `json:"status"`
			AmountPaid         int    `json:"amount_paid"`
			Currency           string `json:"currency"`
			PeriodStart        int64  `json:"period_start"`
			PeriodEnd          int64  `json:"period_end"`
			Created            int64  `json:"created"`
			StatusTransitions  struct {
				PaidAt *int64 `json:"paid_at"`
			} `json:"status_transitions"`
			HostedInvoiceURL   string `json:"hosted_invoice_url"`
			InvoicePDF         string `json:"invoice_pdf"`
			Lines struct {
				Data []struct {
					Description string `json:"description"`
					Quantity    int    `json:"quantity"`
					Amount      int    `json:"amount"`
					Price       struct {
						UnitAmount int `json:"unit_amount"`
					} `json:"price"`
				} `json:"data"`
			} `json:"lines"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decoding invoices response: %w", err)
	}

	invoices := make([]domain.Invoice, 0, len(result.Data))
	for _, inv := range result.Data {
		invoice := domain.Invoice{
			ID:          inv.ID,
			Number:      inv.Number,
			Status:      domain.InvoiceStatus(inv.Status),
			AmountCents: inv.AmountPaid,
			Currency:    inv.Currency,
			PeriodStart: time.Unix(inv.PeriodStart, 0).Format(time.RFC3339),
			PeriodEnd:   time.Unix(inv.PeriodEnd, 0).Format(time.RFC3339),
			IssuedAt:    time.Unix(inv.Created, 0).Format(time.RFC3339),
			HostedURL:   inv.HostedInvoiceURL,
			PDFURL:      inv.InvoicePDF,
		}
		if inv.StatusTransitions.PaidAt != nil {
			paidAt := time.Unix(*inv.StatusTransitions.PaidAt, 0).Format(time.RFC3339)
			invoice.PaidAt = &paidAt
		}
		for _, li := range inv.Lines.Data {
			invoice.LineItems = append(invoice.LineItems, domain.InvoiceLineItem{
				Description:     li.Description,
				Quantity:        li.Quantity,
				UnitAmountCents: li.Price.UnitAmount,
				AmountCents:     li.Amount,
			})
		}
		invoices = append(invoices, invoice)
	}

	return invoices, nil
}

// HandleWebhook verifies and processes a Stripe webhook event.
func (s *StripeProvider) HandleWebhook(ctx context.Context, payload []byte, sig string) error {
	if err := s.verifySignature(payload, sig); err != nil {
		return fmt.Errorf("invalid signature: %w", err)
	}

	var event struct {
		Type string          `json:"type"`
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(payload, &event); err != nil {
		return fmt.Errorf("decoding event: %w", err)
	}

	s.logger.Info("stripe webhook received", slog.String("type", event.Type))

	switch event.Type {
	case "checkout.session.completed":
		return s.handleCheckoutCompleted(ctx, event.Data)
	case "customer.subscription.updated":
		return s.handleSubscriptionUpdated(ctx, event.Data)
	case "customer.subscription.deleted":
		return s.handleSubscriptionDeleted(ctx, event.Data)
	case "invoice.paid":
		s.logger.Info("invoice paid event received")
		return nil
	default:
		s.logger.Debug("unhandled stripe event", slog.String("type", event.Type))
		return nil
	}
}

func (s *StripeProvider) handleCheckoutCompleted(ctx context.Context, data json.RawMessage) error {
	var obj struct {
		Object struct {
			ClientReferenceID string `json:"client_reference_id"`
			Customer          string `json:"customer"`
			Subscription      string `json:"subscription"`
			Metadata          struct {
				UserID string `json:"user_id"`
				PlanID string `json:"plan_id"`
			} `json:"metadata"`
		} `json:"object"`
	}
	if err := json.Unmarshal(data, &obj); err != nil {
		return fmt.Errorf("decoding checkout object: %w", err)
	}

	userID := obj.Object.Metadata.UserID
	planID := obj.Object.Metadata.PlanID
	customerID := obj.Object.Customer
	subID := obj.Object.Subscription

	// Find the plan price
	plans := planPrices()
	price, ok := plans[planID]
	if !ok {
		price = 0
	}

	now := time.Now()
	periodEnd := now.AddDate(0, 1, 0)

	_, err := s.db.Exec(ctx,
		`INSERT INTO subscriptions (id, user_id, plan_id, status, provider, provider_subscription_id, provider_customer_id,
		 current_period_start, current_period_end, amount_cents, currency, created_at, updated_at)
		 VALUES ($1, $2, $3, 'active', 'stripe', $4, $5, $6, $7, $8, 'usd', NOW(), NOW())
		 ON CONFLICT (user_id) DO UPDATE SET
		   plan_id = EXCLUDED.plan_id,
		   status = 'active',
		   provider_subscription_id = EXCLUDED.provider_subscription_id,
		   provider_customer_id = EXCLUDED.provider_customer_id,
		   current_period_start = EXCLUDED.current_period_start,
		   current_period_end = EXCLUDED.current_period_end,
		   amount_cents = EXCLUDED.amount_cents,
		   updated_at = NOW()`,
		"sub_"+subID[:12], userID, planID, subID, customerID,
		now.Format(time.RFC3339), periodEnd.Format(time.RFC3339), price)
	if err != nil {
		return fmt.Errorf("upserting subscription: %w", err)
	}

	s.logger.Info("subscription created from checkout",
		slog.String("user_id", userID),
		slog.String("plan_id", planID),
	)
	return nil
}

func (s *StripeProvider) handleSubscriptionUpdated(ctx context.Context, data json.RawMessage) error {
	var obj struct {
		Object struct {
			ID                 string `json:"id"`
			Status             string `json:"status"`
			CancelAtPeriodEnd  bool   `json:"cancel_at_period_end"`
			CurrentPeriodStart int64  `json:"current_period_start"`
			CurrentPeriodEnd   int64  `json:"current_period_end"`
		} `json:"object"`
	}
	if err := json.Unmarshal(data, &obj); err != nil {
		return fmt.Errorf("decoding subscription object: %w", err)
	}

	_, err := s.db.Exec(ctx,
		`UPDATE subscriptions SET
		 status = $2, cancel_at_period_end = $3,
		 current_period_start = $4, current_period_end = $5, updated_at = NOW()
		 WHERE provider_subscription_id = $1`,
		obj.Object.ID, obj.Object.Status, obj.Object.CancelAtPeriodEnd,
		time.Unix(obj.Object.CurrentPeriodStart, 0).Format(time.RFC3339),
		time.Unix(obj.Object.CurrentPeriodEnd, 0).Format(time.RFC3339),
	)
	return err
}

func (s *StripeProvider) handleSubscriptionDeleted(ctx context.Context, data json.RawMessage) error {
	var obj struct {
		Object struct {
			ID string `json:"id"`
		} `json:"object"`
	}
	if err := json.Unmarshal(data, &obj); err != nil {
		return fmt.Errorf("decoding subscription deletion: %w", err)
	}

	_, err := s.db.Exec(ctx,
		`UPDATE subscriptions SET status = 'canceled', updated_at = NOW()
		 WHERE provider_subscription_id = $1`,
		obj.Object.ID)
	return err
}

// stripeRequest makes an authenticated request to Stripe's API.
func (s *StripeProvider) stripeRequest(ctx context.Context, method, path string, form url.Values) ([]byte, error) {
	var reqBody io.Reader
	if form != nil && method == http.MethodPost {
		reqBody = strings.NewReader(form.Encode())
	}

	fullURL := stripeAPIBase + path
	req, err := http.NewRequestWithContext(ctx, method, fullURL, reqBody)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(s.secretKey, "")
	if method == http.MethodPost {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("stripe error %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

func (s *StripeProvider) verifySignature(payload []byte, header string) error {
	if s.webhookSecret == "" {
		return nil // Skip verification if no secret configured
	}

	// Parse header: t=timestamp,v1=signature
	parts := strings.Split(header, ",")
	var timestamp, sig string
	for _, p := range parts {
		kv := strings.SplitN(p, "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			timestamp = kv[1]
		case "v1":
			sig = kv[1]
		}
	}
	if timestamp == "" || sig == "" {
		return fmt.Errorf("missing timestamp or signature")
	}

	signedPayload := timestamp + "." + string(payload)
	mac := hmac.New(sha256.New, []byte(s.webhookSecret))
	mac.Write([]byte(signedPayload))
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(sig), []byte(expectedSig)) {
		return fmt.Errorf("signature mismatch")
	}

	return nil
}

func (s *StripeProvider) getCustomerID(ctx context.Context, userID string) (string, error) {
	var customerID string
	err := s.db.QueryRow(ctx,
		`SELECT provider_customer_id FROM subscriptions
		 WHERE user_id = $1 AND provider = 'stripe'
		 ORDER BY created_at DESC LIMIT 1`, userID).Scan(&customerID)
	return customerID, err
}

func (s *StripeProvider) priceIDForPlan(planID string) string {
	// These should come from config in production.
	// Empty strings mean the plan is not purchasable via Stripe.
	prices := map[string]string{
		"starter":    "", // Set STRIPE_PRICE_STARTER in production
		"pro":        "", // Set STRIPE_PRICE_PRO in production
		"enterprise": "",
	}
	return prices[planID]
}

func planPrices() map[string]int {
	return map[string]int{
		"hobby":      0,
		"starter":    1900,
		"pro":        7900,
		"enterprise": 0,
	}
}

// Shared types used by both providers.

type CheckoutRequest struct {
	UserID     string
	PlanID     string
	SuccessURL string
	CancelURL  string
}

type CheckoutSession struct {
	URL string `json:"url"`
}

// BillingProvider is the interface both Stripe and Paystack implement.
type BillingProvider interface {
	CreateCheckoutSession(ctx context.Context, req CheckoutRequest) (*CheckoutSession, error)
	CreateCustomerPortalLink(ctx context.Context, customerID string) (string, error)
	GetInvoices(ctx context.Context, customerID string) ([]domain.Invoice, error)
	HandleWebhook(ctx context.Context, payload []byte, sig string) error
}

// Ensure interface compliance.
var _ BillingProvider = (*StripeProvider)(nil)
