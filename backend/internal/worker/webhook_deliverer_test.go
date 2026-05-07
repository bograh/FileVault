package worker

import (
	"testing"
	"time"
)

func TestRetryBackoff(t *testing.T) {
	tests := []struct {
		attempt  int
		expected time.Duration
	}{
		{1, 10 * time.Second},
		{2, 30 * time.Second},
		{3, 90 * time.Second},
		{4, 270 * time.Second},
		{5, 810 * time.Second},
	}

	for _, tt := range tests {
		got := retryBackoff(tt.attempt)
		if got != tt.expected {
			t.Errorf("attempt %d: expected %v, got %v", tt.attempt, tt.expected, got)
		}
	}
}

func TestSignWebhookPayload(t *testing.T) {
	secret := "whsec_testsecret123"
	body := `{"event":"upload.completed","upload_id":"upl_123"}`
	timestamp := int64(1700000000)

	sig1 := signWebhookPayload(secret, body, timestamp)
	sig2 := signWebhookPayload(secret, body, timestamp)

	if sig1 != sig2 {
		t.Error("same inputs should produce same signature")
	}

	// Different timestamp → different sig
	sig3 := signWebhookPayload(secret, body, timestamp+1)
	if sig1 == sig3 {
		t.Error("different timestamps should produce different signatures")
	}

	// Different body → different sig
	sig4 := signWebhookPayload(secret, `{"different": true}`, timestamp)
	if sig1 == sig4 {
		t.Error("different bodies should produce different signatures")
	}

	// Different secret → different sig
	sig5 := signWebhookPayload("other_secret", body, timestamp)
	if sig1 == sig5 {
		t.Error("different secrets should produce different signatures")
	}

	// Correct length (SHA256 hex = 64 chars)
	if len(sig1) != 64 {
		t.Errorf("expected sig length 64, got %d", len(sig1))
	}
}
