package service

import (
	"context"
	"fmt"

	"github.com/filevault/backend/internal/domain"
	"github.com/jackc/pgx/v5/pgxpool"
)

// BillingProvider abstracts billing operations per PRD section 10.
type BillingProvider interface {
	CreateCheckoutSession(ctx context.Context, req CheckoutRequest) (*CheckoutSession, error)
	CreateCustomerPortalLink(ctx context.Context, customerID string) (string, error)
	GetInvoices(ctx context.Context, customerID string) ([]domain.Invoice, error)
	HandleWebhook(ctx context.Context, payload []byte, sig string) error
}

type CheckoutRequest struct {
	UserID    string
	PlanID    string
	SuccessURL string
	CancelURL  string
}

type CheckoutSession struct {
	URL string `json:"url"`
}

type BillingService struct {
	db       *pgxpool.Pool
	stripe   BillingProvider
	paystack BillingProvider
}

func NewBillingService(db *pgxpool.Pool) *BillingService {
	return &BillingService{db: db}
}

func (s *BillingService) SetStripeProvider(p BillingProvider) {
	s.stripe = p
}

func (s *BillingService) SetPaystackProvider(p BillingProvider) {
	s.paystack = p
}

func (s *BillingService) GetPlans() []domain.Plan {
	return []domain.Plan{
		{
			ID:         domain.TierHobby,
			Name:       "Hobby",
			PriceCents: 0,
			PriceLabel: "Free",
			Currency:   "usd",
			StorageGB:  intPtr(5),
			BandwidthGB: intPtr(10),
			APIRequests: intPtr(10000),
			Projects:    intPtr(1),
			MaxFileSizeMB: intPtr(50),
			Features:   []string{"5 GB storage", "10 GB bandwidth/mo", "10,000 API requests/mo", "1 project", "Community support"},
			CTA:        "Get Started",
		},
		{
			ID:         domain.TierStarter,
			Name:       "Starter",
			PriceCents: 1900,
			PriceLabel: "$19/mo",
			Currency:   "usd",
			StorageGB:  intPtr(50),
			BandwidthGB: intPtr(100),
			APIRequests: intPtr(100000),
			Projects:    intPtr(5),
			MaxFileSizeMB: intPtr(500),
			Features:   []string{"50 GB storage", "100 GB bandwidth/mo", "100,000 API requests/mo", "5 projects", "Webhooks", "Email support"},
			SLAPercent: float64Ptr(99.5),
			CTA:        "Upgrade",
		},
		{
			ID:         domain.TierPro,
			Name:       "Pro",
			PriceCents: 7900,
			PriceLabel: "$79/mo",
			Currency:   "usd",
			StorageGB:  intPtr(500),
			BandwidthGB: intPtr(1024),
			APIRequests: intPtr(1000000),
			Projects:    intPtr(25),
			MaxFileSizeMB: intPtr(5120),
			Features:   []string{"500 GB storage", "1 TB bandwidth/mo", "1,000,000 API requests/mo", "25 projects", "Webhooks", "Custom domain", "File versioning", "Priority support"},
			SLAPercent: float64Ptr(99.9),
			CTA:        "Upgrade",
			Highlight:  true,
		},
		{
			ID:         domain.TierEnterprise,
			Name:       "Enterprise",
			PriceCents: 0,
			PriceLabel: "Custom",
			Currency:   "usd",
			Features:   []string{"Unlimited storage", "Custom bandwidth", "Unlimited API requests", "Unlimited projects", "All features", "Dedicated support", "SLA 99.99%", "Custom contracts"},
			SLAPercent: float64Ptr(99.99),
			CTA:        "Contact Sales",
		},
	}
}

func (s *BillingService) GetSubscription(ctx context.Context, userID string) (*domain.Subscription, error) {
	var sub domain.Subscription
	err := s.db.QueryRow(ctx,
		`SELECT id, plan_id, status, provider, current_period_start, current_period_end,
		 cancel_at_period_end, amount_cents, currency
		 FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
		userID).Scan(
		&sub.ID, &sub.PlanID, &sub.Status, &sub.Provider,
		&sub.CurrentPeriodStart, &sub.CurrentPeriodEnd,
		&sub.CancelAtPeriodEnd, &sub.AmountCents, &sub.Currency,
	)
	if err != nil {
		// Return default hobby subscription if none exists
		return &domain.Subscription{
			ID:                 "sub_default",
			PlanID:             domain.TierHobby,
			Status:             domain.StatusActive,
			CurrentPeriodStart: "",
			CurrentPeriodEnd:   "",
			CancelAtPeriodEnd:  false,
			Provider:           domain.ProviderStripe,
			AmountCents:        0,
			Currency:           "usd",
		}, nil
	}
	return &sub, nil
}

func (s *BillingService) GetInvoices(ctx context.Context, userID string) ([]domain.Invoice, error) {
	// TODO: Fetch from Stripe/Paystack based on user's billing provider
	// For now return empty list
	return []domain.Invoice{}, nil
}

func (s *BillingService) ChangePlan(ctx context.Context, userID string, planID domain.SubscriptionTier) (*domain.Subscription, error) {
	plans := s.GetPlans()
	var targetPlan *domain.Plan
	for _, p := range plans {
		if p.ID == planID {
			targetPlan = &p
			break
		}
	}
	if targetPlan == nil {
		return nil, fmt.Errorf("plan not found")
	}

	_, err := s.db.Exec(ctx,
		`UPDATE subscriptions SET plan_id = $2, amount_cents = $3, updated_at = NOW()
		 WHERE user_id = $1`,
		userID, string(planID), targetPlan.PriceCents)
	if err != nil {
		return nil, fmt.Errorf("updating subscription: %w", err)
	}

	return s.GetSubscription(ctx, userID)
}

func intPtr(i int) *int         { return &i }
func float64Ptr(f float64) *float64 { return &f }
