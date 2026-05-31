package broker

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/pquerna/otp/totp"
	"github.com/tradenexus/backend/internal/config"
	"github.com/tradenexus/backend/internal/logger"
)

const (
	baseURL       = "https://apiconnect.angelone.in"
	loginEndpoint = "/rest/auth/angelbroking/user/v1/loginByPassword"
	tokenRefresh  = "/rest/auth/angelbroking/jwt/v1/generateTokens"
)

// AuthManager handles Angel One SmartAPI JWT + TOTP authentication.
type AuthManager struct {
	cfg        *config.Config
	httpClient *http.Client

	mu        sync.RWMutex
	jwtToken  string
	feedToken string
	expiresAt time.Time
}

// LoginResponse represents the Angel One login API response.
type LoginResponse struct {
	Status    bool   `json:"status"`
	Message   string `json:"message"`
	ErrorCode string `json:"errorcode"`
	Data      struct {
		JWTToken     string `json:"jwtToken"`
		RefreshToken string `json:"refreshToken"`
		FeedToken    string `json:"feedToken"`
	} `json:"data"`
}

// NewAuthManager creates a new auth manager.
func NewAuthManager(cfg *config.Config) *AuthManager {
	return &AuthManager{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Login performs the TOTP-based login flow and stores JWT + feed tokens.
func (a *AuthManager) Login() error {
	log := logger.WithComponent("broker.auth")

	// Generate TOTP code from secret
	totpCode, err := totp.GenerateCode(a.cfg.AngelTOTPSecret, time.Now())
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate TOTP code")
		return fmt.Errorf("TOTP generation failed: %w", err)
	}

	payload := map[string]string{
		"clientcode": a.cfg.AngelClientID,
		"password":   a.cfg.AngelPassword,
		"totp":       totpCode,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", baseURL+loginEndpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-UserType", "USER")
	req.Header.Set("X-SourceID", "WEB")
	req.Header.Set("X-ClientLocalIP", "127.0.0.1")
	req.Header.Set("X-ClientPublicIP", "127.0.0.1")
	req.Header.Set("X-MACAddress", "00:00:00:00:00:00")
	req.Header.Set("X-PrivateKey", a.cfg.AngelAPIKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		log.Error().Err(err).Msg("Login request failed")
		return fmt.Errorf("login request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var loginResp LoginResponse
	if err := json.Unmarshal(respBody, &loginResp); err != nil {
		return fmt.Errorf("failed to parse login response: %w", err)
	}

	if !loginResp.Status {
		return fmt.Errorf("login failed: %s (code: %s)", loginResp.Message, loginResp.ErrorCode)
	}

	a.mu.Lock()
	a.jwtToken = loginResp.Data.JWTToken
	a.feedToken = loginResp.Data.FeedToken
	a.expiresAt = time.Now().Add(23 * time.Hour) // JWT valid ~24h
	a.mu.Unlock()

	log.Info().Msg("Angel One login successful")
	return nil
}

// GetJWTToken returns the current JWT token, refreshing if expired.
func (a *AuthManager) GetJWTToken() (string, error) {
	a.mu.RLock()
	token := a.jwtToken
	expired := time.Now().After(a.expiresAt)
	a.mu.RUnlock()

	if token == "" || expired {
		if err := a.Login(); err != nil {
			return "", err
		}
		a.mu.RLock()
		token = a.jwtToken
		a.mu.RUnlock()
	}
	return token, nil
}

// GetFeedToken returns the current feed token.
func (a *AuthManager) GetFeedToken() (string, error) {
	a.mu.RLock()
	token := a.feedToken
	a.mu.RUnlock()

	if token == "" {
		if err := a.Login(); err != nil {
			return "", err
		}
		a.mu.RLock()
		token = a.feedToken
		a.mu.RUnlock()
	}
	return token, nil
}

// GetAPIKey returns the API key from config.
func (a *AuthManager) GetAPIKey() string {
	return a.cfg.AngelAPIKey
}

// GetClientCode returns the client code from config.
func (a *AuthManager) GetClientCode() string {
	return a.cfg.AngelClientID
}

// AuthHeaders returns the standard authenticated headers for REST API calls.
func (a *AuthManager) AuthHeaders() (map[string]string, error) {
	jwt, err := a.GetJWTToken()
	if err != nil {
		return nil, err
	}
	return map[string]string{
		"Authorization":    "Bearer " + jwt,
		"Content-Type":     "application/json",
		"Accept":           "application/json",
		"X-UserType":       "USER",
		"X-SourceID":       "WEB",
		"X-ClientLocalIP":  "127.0.0.1",
		"X-ClientPublicIP": "127.0.0.1",
		"X-MACAddress":     "00:00:00:00:00:00",
		"X-PrivateKey":     a.cfg.AngelAPIKey,
	}, nil
}
