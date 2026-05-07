package billing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
	"time"
)

func TestVerifySignature(t *testing.T) {
	secret := "whsec_test_secret_123"
	provider := &StripeProvider{webhookSecret: secret}

	payload := []byte(`{"type":"checkout.session.completed","data":{}}`)
	timestamp := fmt.Sprintf("%d", time.Now().Unix())

	// Generate valid signature
	signedPayload := timestamp + "." + string(payload)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signedPayload))
	sig := hex.EncodeToString(mac.Sum(nil))

	header := fmt.Sprintf("t=%s,v1=%s", timestamp, sig)

	t.Run("valid_signature", func(t *testing.T) {
		err := provider.verifySignature(payload, header)
		if err != nil {
			t.Errorf("expected valid signature, got error: %v", err)
		}
	})

	t.Run("invalid_signature", func(t *testing.T) {
		err := provider.verifySignature(payload, "t=123,v1=invalidsig")
		if err == nil {
			t.Error("expected error for invalid signature")
		}
	})

	t.Run("missing_timestamp", func(t *testing.T) {
		err := provider.verifySignature(payload, "v1="+sig)
		if err == nil {
			t.Error("expected error for missing timestamp")
		}
	})

	t.Run("empty_secret_skips_verification", func(t *testing.T) {
		noSecretProvider := &StripeProvider{webhookSecret: ""}
		err := noSecretProvider.verifySignature(payload, "garbage")
		if err != nil {
			t.Errorf("empty secret should skip verification, got: %v", err)
		}
	})
}

func TestPlanPrices(t *testing.T) {
	prices := planPrices()

	if prices["hobby"] != 0 {
		t.Errorf("hobby should be free, got %d", prices["hobby"])
	}
	if prices["starter"] != 1900 {
		t.Errorf("starter should be 1900, got %d", prices["starter"])
	}
	if prices["pro"] != 7900 {
		t.Errorf("pro should be 7900, got %d", prices["pro"])
	}
}
