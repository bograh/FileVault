package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	JSON(w, req, http.StatusOK, map[string]string{"hello": "world"})

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp Envelope
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if resp.Meta == nil {
		t.Fatal("meta should not be nil")
	}
	if resp.Meta.Timestamp == "" {
		t.Error("timestamp should not be empty")
	}
}

func TestError(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	Error(w, req, http.StatusNotFound, "NOT_FOUND", "Resource not found.")

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", w.Code)
	}

	var resp ErrorResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal error response: %v", err)
	}

	if resp.Error == nil {
		t.Fatal("error should not be nil")
	}
	if resp.Error.Code != "NOT_FOUND" {
		t.Errorf("expected code NOT_FOUND, got %s", resp.Error.Code)
	}
	if resp.Error.Message != "Resource not found." {
		t.Errorf("unexpected message: %s", resp.Error.Message)
	}
	if resp.Error.DocsURL != "https://docs.filevault.io/errors/NOT_FOUND" {
		t.Errorf("unexpected docs_url: %s", resp.Error.DocsURL)
	}
}

func TestPage(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	next := "2"
	page := Page{
		Items:      []string{"a", "b"},
		Total:      50,
		Page:       1,
		PageSize:   20,
		HasMore:    true,
		NextCursor: &next,
	}
	JSONPage(w, req, page)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp Envelope
	json.Unmarshal(w.Body.Bytes(), &resp)

	data, ok := resp.Data.(map[string]interface{})
	if !ok {
		t.Fatal("data should be a map")
	}
	if data["total"].(float64) != 50 {
		t.Errorf("expected total 50, got %v", data["total"])
	}
	if data["has_more"].(bool) != true {
		t.Error("expected has_more true")
	}
}
