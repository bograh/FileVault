package service

import (
	"testing"
)

func TestGenerateAPIKeyPlaintext(t *testing.T) {
	tests := []struct {
		env    string
		prefix string
	}{
		{"live", "fv_live_"},
		{"test", "fv_test_"},
	}

	for _, tt := range tests {
		t.Run(tt.env, func(t *testing.T) {
			key := GenerateAPIKeyPlaintext(tt.env)
			if len(key) < 20 {
				t.Errorf("key too short: %s", key)
			}
			if key[:len(tt.prefix)] != tt.prefix {
				t.Errorf("expected prefix %q, got %q", tt.prefix, key[:len(tt.prefix)])
			}
		})
	}

	// Test uniqueness
	key1 := GenerateAPIKeyPlaintext("live")
	key2 := GenerateAPIKeyPlaintext("live")
	if key1 == key2 {
		t.Error("generated keys should be unique")
	}
}

func TestHashAPIKey(t *testing.T) {
	auth := &AuthService{
		secret: []byte("test-secret"),
	}

	key := "fv_live_testkey123"
	hash1 := auth.HashAPIKey(key)
	hash2 := auth.HashAPIKey(key)

	if hash1 != hash2 {
		t.Error("same key should produce same hash")
	}

	hash3 := auth.HashAPIKey("fv_live_different")
	if hash1 == hash3 {
		t.Error("different keys should produce different hashes")
	}

	if len(hash1) != 64 { // hex-encoded SHA256 = 64 chars
		t.Errorf("expected hash length 64, got %d", len(hash1))
	}
}
