package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/filevault/backend/internal/middleware"
	"github.com/filevault/backend/internal/service"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	TOTPCode string `json:"totp_code,omitempty"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, r, "Invalid request body.")
		return
	}

	if req.Email == "" || req.Password == "" {
		Error(w, r, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid email or password.")
		return
	}

	session, requires2FA, err := h.auth.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		Error(w, r, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid email or password.")
		return
	}

	if requires2FA && req.TOTPCode == "" {
		JSON(w, r, http.StatusOK, map[string]interface{}{
			"requires_2fa":  true,
			"challenge_id": "chl_placeholder",
		})
		return
	}

	// Set session cookie
	token := session.User.PasswordHash // Token is stored here temporarily
	session.User.PasswordHash = ""

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(24 * time.Hour / time.Second),
	})

	JSON(w, r, http.StatusOK, session)
}

type signupRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Country  string `json:"country"`
}

func (h *AuthHandler) Signup(w http.ResponseWriter, r *http.Request) {
	var req signupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, r, "Invalid request body.")
		return
	}

	if req.Email == "" || req.Password == "" || req.Name == "" {
		BadRequest(w, r, "Name, email, and password are required.")
		return
	}

	session, err := h.auth.Signup(r.Context(), req.Name, req.Email, req.Password, req.Country)
	if err != nil {
		if err == service.ErrUserExists {
			Error(w, r, http.StatusConflict, "USER_EXISTS", "A user with this email already exists.")
			return
		}
		InternalError(w, r)
		return
	}

	// Set session cookie
	token := session.User.PasswordHash
	session.User.PasswordHash = ""

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(24 * time.Hour / time.Second),
	})

	JSON(w, r, http.StatusCreated, session)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	authedUser := middleware.GetUser(r.Context())
	if authedUser == nil {
		Unauthorized(w, r, "Authentication required.")
		return
	}

	user, err := h.auth.GetMe(r.Context(), authedUser.UserID)
	if err != nil {
		InternalError(w, r)
		return
	}

	JSON(w, r, http.StatusOK, user)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_token")
	if err == nil {
		h.auth.Logout(r.Context(), cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})

	JSON(w, r, http.StatusOK, nil)
}
