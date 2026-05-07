package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/filevault/backend/internal/middleware"
)

// Envelope wraps all successful responses per PRD spec.
type Envelope struct {
	Data interface{} `json:"data"`
	Meta *Meta       `json:"meta"`
}

// ErrorResponse wraps error responses per PRD spec.
type ErrorResponse struct {
	Error *APIError `json:"error"`
	Meta  *Meta     `json:"meta"`
}

type Meta struct {
	RequestID string `json:"request_id"`
	Timestamp string `json:"timestamp"`
}

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	DocsURL string `json:"docs_url,omitempty"`
}

// Page represents paginated results matching frontend Page<T> type.
type Page struct {
	Items      interface{} `json:"items"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	HasMore    bool        `json:"has_more"`
	NextCursor *string     `json:"next_cursor"`
}

func newMeta(r *http.Request) *Meta {
	return &Meta{
		RequestID: middleware.GetRequestID(r.Context()),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}

func JSON(w http.ResponseWriter, r *http.Request, status int, data interface{}) {
	resp := Envelope{
		Data: data,
		Meta: newMeta(r),
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(resp)
}

func JSONPage(w http.ResponseWriter, r *http.Request, page Page) {
	JSON(w, r, http.StatusOK, page)
}

func Error(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	resp := ErrorResponse{
		Error: &APIError{
			Code:    code,
			Message: message,
			DocsURL: "https://docs.filevault.io/errors/" + code,
		},
		Meta: newMeta(r),
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(resp)
}

func NotFound(w http.ResponseWriter, r *http.Request, resource string) {
	Error(w, r, http.StatusNotFound, "NOT_FOUND", resource+" not found.")
}

func BadRequest(w http.ResponseWriter, r *http.Request, message string) {
	Error(w, r, http.StatusBadRequest, "BAD_REQUEST", message)
}

func Unauthorized(w http.ResponseWriter, r *http.Request, message string) {
	Error(w, r, http.StatusUnauthorized, "UNAUTHORIZED", message)
}

func Forbidden(w http.ResponseWriter, r *http.Request) {
	Error(w, r, http.StatusForbidden, "FORBIDDEN", "You do not have permission to perform this action.")
}

func InternalError(w http.ResponseWriter, r *http.Request) {
	Error(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "An internal error occurred.")
}
