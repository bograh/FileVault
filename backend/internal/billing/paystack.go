package billing

import (
	"context"
	"encoding/json"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/filevault/backend/internal/domain"
	"github.com/jackc/pgx/v5/pgxpool"
)

const paystackAPIBase = "https://api.paystack.co"

// PaystackProvider implements BillingProvider for Paystack.
type PaystackProvider struct {
	secretKey     string
	webhookSecret string
	db            *pgxpool.Pool
	client        *http.Client
	logger        *slog.Logger
}

func NewPaystackProvider(secretKey, webhookSecret string, db *pgxpool.Pool, logger *slog.Logger) *PaystackProvider {
	return &PaystackProvider{
		secretKey:     secretKey,
		webhookSecret: webhookSecret,
		db:            db,
		client:        &http.Client{Timeout: 15 * time.Second},
		logger:        logger,
	}
}

// CreateCheckoutSession initializes a Paystack transaction.
func (p *PaystackProvider) CreateCheckoutSession(ctx context.Context, req CheckoutRequest) (*CheckoutSession, error) {
	prices := planPrices()
	amountKobo := prices[req.PlanID] * 100 / 100 // cents → same for kobo in test mode

	// Fetch user email
	var email string
	err := p.db.QueryRow(ctx, "SELECT email FROM users WHERE id = $1", req.UserID).Scan(&email)
	if err != nil {
		return nil, fmt.Errorf("fetching user email: %w", err)
	}

	payload := map[string]interface{}{
		"email":        email,
		"amount":       amountKobo,
		"currency":     "NGN",
		"callback_url": req.SuccessURL,
		"metadata": map[string]string{
			"user_id": req.UserID,
			"plan_id": req.PlanID,
		},
		"channels": []string{"card", "bank_transfer"},
	}

	body, err := p.paystackRequest(ctx, http.MethodPost, "/transaction/initialize", payload)
	if err != nil {
		return nil, fmt.Errorf("creating paystack transaction: %w", err)
	}

	var result struct {
		Status  bool `json:"status"`
		Data    struct {
			AuthorizationURL string `json:"authorization_url"`
			Reference        string `json:"reference"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decoding paystack response: %w", err)
	}

	if !result.Status {
		return nil, fmt.Errorf("paystack returned failure")
	}

	return &CheckoutSession{URL: result.Data.AuthorizationURL}, nil
}

// CreateCustomerPortalLink — Paystack doesn't have a built-in portal.
// Return a link to transaction history or a custom portal page.
func (p *PaystackProvider) CreateCustomerPortalLink(ctx context.Context, customerID string) (string, error) {
	// Paystack doesn't have a customer portal equivalent.
	// Return a placeholder that the frontend can handle.
	return fmt.Sprintf("https://dashboard.paystack.com/#/customers/%s", customerID), nil
}

// GetInvoices fetches recent transactions for a customer.
func (p *PaystackProvider) GetInvoices(ctx context.Context, customerID string) ([]domain.Invoice, error) {
	body, err := p.paystackRequest(ctx, http.MethodGet,
		fmt.Sprintf("/transaction?customer=%s&perPage=20&status=success", customerID), nil)
	if err != nil {
		return nil, fmt.Errorf("fetching paystack transactions: %w", err)
	}

	var result struct {
		Data []struct {
			ID        int    `json:"id"`
			Reference string `json:"reference"`
			Amount    int    `json:"amount"` // kobo
			Currency  string `json:"currency"`
			Status    string `json:"status"`
			PaidAt    string `json:"paid_at"`
			CreatedAt string `json:"created_at"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decoding transactions: %w", err)
	}

	invoices := make([]domain.Invoice, 0, len(result.Data))
	for _, tx := range result.Data {
		inv := domain.Invoice{
			ID:          fmt.Sprintf("txn_%d", tx.ID),
			Number:      tx.Reference,
			Status:      domain.InvoicePaid,
			AmountCents: tx.Amount / 100, // kobo → naira as "cents"
			Currency:    strings.ToLower(tx.Currency),
			IssuedAt:    tx.CreatedAt,
			PaidAt:      &tx.PaidAt,
		}
		invoices = append(invoices, inv)
	}

	return invoices, nil
}

// HandleWebhook verifies and processes Paystack webhook events.
func (p *PaystackProvider) HandleWebhook(ctx context.Context, payload []byte, sig string) error {
	if err := p.verifySignature(payload, sig); err != nil {
		return fmt.Errorf("invalid signature: %w", err)
	}

	var event struct {
		Event string          `json:"event"`
		Data  json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(payload, &event); err != nil {
		return fmt.Errorf("decoding event: %w", err)
	}

	p.logger.Info("paystack webhook received", slog.String("event", event.Event))

	switch event.Event {
	case "charge.success":
		return p.handleChargeSuccess(ctx, event.Data)
	case "subscription.create":
		return p.handleSubscriptionCreate(ctx, event.Data)
	case "subscription.disable":
		return p.handleSubscriptionDisable(ctx, event.Data)
	default:
		p.logger.Debug("unhandled paystack event", slog.String("event", event.Event))
		return nil
	}
}

func (p *PaystackProvider) handleChargeSuccess(ctx context.Context, data json.RawMessage) error {
	var obj struct {
		Reference string `json:"reference"`
		Amount    int    `json:"amount"`
		Currency  string `json:"currency"`
		Metadata  struct {
			UserID string `json:"user_id"`
			PlanID string `json:"plan_id"`
		} `json:"metadata"`
		Customer struct {
			CustomerCode string `json:"customer_code"`
		} `json:"customer"`
	}
	if err := json.Unmarshal(data, &obj); err != nil {
		return fmt.Errorf("decoding charge: %w", err)
	}

	if obj.Metadata.UserID == "" || obj.Metadata.PlanID == "" {
		return nil // Not a plan purchase
	}

	now := time.Now()
	periodEnd := now.AddDate(0, 1, 0)

	_, err := p.db.Exec(ctx,
		`INSERT INTO subscriptions (id, user_id, plan_id, status, provider, provider_subscription_id, provider_customer_id,
		 current_period_start, current_period_end, amount_cents, currency, created_at, updated_at)
		 VALUES ($1, $2, $3, 'active', 'paystack', $4, $5, $6, $7, $8, $9, NOW(), NOW())
		 ON CONFLICT (user_id) DO UPDATE SET
		   plan_id = EXCLUDED.plan_id,
		   status = 'active',
		   provider_subscription_id = EXCLUDED.provider_subscription_id,
		   provider_customer_id = EXCLUDED.provider_customer_id,
		   current_period_start = EXCLUDED.current_period_start,
		   current_period_end = EXCLUDED.current_period_end,
		   amount_cents = EXCLUDED.amount_cents,
		   currency = EXCLUDED.currency,
		   updated_at = NOW()`,
		"sub_ps_"+obj.Reference[:12], obj.Metadata.UserID, obj.Metadata.PlanID,
		obj.Reference, obj.Customer.CustomerCode,
		now.Format(time.RFC3339), periodEnd.Format(time.RFC3339),
		obj.Amount/100, strings.ToLower(obj.Currency))

	return err
}

func (p *PaystackProvider) handleSubscriptionCreate(ctx context.Context, data json.RawMessage) error {
	p.logger.Info("paystack subscription created")
	return nil
}

func (p *PaystackProvider) handleSubscriptionDisable(ctx context.Context, data json.RawMessage) error {
	var obj struct {
		SubscriptionCode string `json:"subscription_code"`
	}
	if err := json.Unmarshal(data, &obj); err != nil {
		return fmt.Errorf("decoding subscription disable: %w", err)
	}

	_, err := p.db.Exec(ctx,
		`UPDATE subscriptions SET status = 'canceled', updated_at = NOW()
		 WHERE provider_subscription_id = $1`,
		obj.SubscriptionCode)
	return err
}

// paystackRequest makes an authenticated request to Paystack.
func (p *PaystackProvider) paystackRequest(ctx context.Context, method, path string, body interface{}) ([]byte, error) {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = strings.NewReader(string(b))
	}

	req, err := http.NewRequestWithContext(ctx, method, paystackAPIBase+path, reqBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+p.secretKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("paystack error %d: %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

func (p *PaystackProvider) verifySignature(payload []byte, header string) error {
	if p.secretKey == "" {
		return nil
	}

	mac := hmac.New(sha512.New, []byte(p.secretKey))
	mac.Write(payload)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(header), []byte(expectedSig)) {
		return fmt.Errorf("signature mismatch")
	}
	return nil
}

var _ BillingProvider = (*PaystackProvider)(nil)
