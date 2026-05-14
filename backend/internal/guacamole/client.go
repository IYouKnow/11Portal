package guacamole

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/portal/backend/internal/config"
	"github.com/portal/backend/internal/store"
)

const defaultBootstrapAdminUsername = "guacadmin"
const defaultBootstrapAdminPassword = "guacadmin"

type Client struct {
	baseURL              *url.URL
	httpClient           *http.Client
	adminUsername        string
	adminPassword        string
	configuredDataSource string
}

type Session struct {
	AuthToken  string   `json:"authToken"`
	Username   string   `json:"username"`
	DataSource string   `json:"dataSource"`
	Available  []string `json:"availableDataSources"`
}

type connectionPayload struct {
	ParentIdentifier string            `json:"parentIdentifier"`
	Name             string            `json:"name"`
	Identifier       string            `json:"identifier,omitempty"`
	Protocol         string            `json:"protocol"`
	Parameters       map[string]string `json:"parameters"`
	Attributes       map[string]string `json:"attributes"`
}

type connectionResponse struct {
	Identifier string `json:"identifier"`
}

type createUserPayload struct {
	Username   string                 `json:"username"`
	Password   string                 `json:"password"`
	Attributes map[string]interface{} `json:"attributes"`
}

func NewClient(cfg config.Config) (*Client, error) {
	trimmed := strings.TrimSpace(cfg.GuacamoleInternalURL)
	if trimmed == "" {
		return &Client{}, nil
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return nil, fmt.Errorf("parse guacamole internal url: %w", err)
	}

	return &Client{
		baseURL: parsed,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		adminUsername:        strings.TrimSpace(cfg.GuacamoleAdminUsername),
		adminPassword:        cfg.GuacamoleAdminPassword,
		configuredDataSource: normalizeDataSource(cfg.GuacamoleDataSource),
	}, nil
}

func (c *Client) Enabled() bool {
	return c != nil &&
		c.baseURL != nil &&
		c.adminUsername != "" &&
		c.adminPassword != "" &&
		c.configuredDataSource != ""
}

func (c *Client) LaunchSession(ctx context.Context, portalUserID int64, profile *store.RemoteDesktopProfile, username, password string) (string, int64, error) {
	if !c.Enabled() {
		return "", 0, fmt.Errorf("guacamole is not configured")
	}

	adminSession, err := c.ensureAdminSession(ctx)
	if err != nil {
		return "", 0, err
	}

	guacUsername := c.sessionUsername(portalUserID, profile.ID)
	if err := c.resetPortalSessionUser(ctx, adminSession, guacUsername, password); err != nil {
		return "", 0, err
	}

	connectionID, err := c.ensureConnection(ctx, adminSession, profile, username)
	if err != nil {
		return "", 0, err
	}

	if err := c.grantConnectionAccess(ctx, adminSession, guacUsername, connectionID); err != nil {
		return "", 0, err
	}

	userSession, err := c.authenticate(ctx, guacUsername, password)
	if err != nil {
		return "", 0, fmt.Errorf("authenticate guacamole session user: %w", err)
	}

	launchURL := fmt.Sprintf(
		"/guacamole/#/client/%s?token=%s",
		encodeClientIdentifier(connectionID, userSession.DataSource),
		url.QueryEscape(userSession.AuthToken),
	)

	return launchURL, connectionID, nil
}

func (c *Client) DeleteConnection(ctx context.Context, connectionID int64) error {
	if !c.Enabled() || connectionID <= 0 {
		return nil
	}

	adminSession, err := c.ensureAdminSession(ctx)
	if err != nil {
		return err
	}

	err = c.requestJSON(
		ctx,
		adminSession,
		http.MethodDelete,
		c.dataPath("/connections/"+strconv.FormatInt(connectionID, 10)),
		nil,
		nil,
		http.StatusNoContent,
	)
	if isStatus(err, http.StatusNotFound) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("delete guacamole connection %d: %w", connectionID, err)
	}

	return nil
}

func (c *Client) ensureAdminSession(ctx context.Context) (*Session, error) {
	session, err := c.authenticate(ctx, c.adminUsername, c.adminPassword)
	if err == nil {
		return session, nil
	}

	if c.adminUsername == defaultBootstrapAdminUsername && c.adminPassword == defaultBootstrapAdminPassword {
		return nil, fmt.Errorf("authenticate guacamole admin: %w", err)
	}

	bootstrapSession, bootstrapErr := c.authenticate(ctx, defaultBootstrapAdminUsername, defaultBootstrapAdminPassword)
	if bootstrapErr != nil {
		return nil, fmt.Errorf("authenticate guacamole admin: %w", err)
	}

	if bootstrapErr := c.ensureConfiguredAdminUser(ctx, bootstrapSession); bootstrapErr != nil {
		return nil, bootstrapErr
	}

	session, err = c.authenticate(ctx, c.adminUsername, c.adminPassword)
	if err != nil {
		return nil, fmt.Errorf("authenticate guacamole admin after bootstrap: %w", err)
	}

	return session, nil
}

func (c *Client) ensureConfiguredAdminUser(ctx context.Context, bootstrapSession *Session) error {
	if strings.EqualFold(c.adminUsername, defaultBootstrapAdminUsername) {
		if c.adminPassword == defaultBootstrapAdminPassword {
			return nil
		}

		if err := c.updateOwnPassword(ctx, bootstrapSession, defaultBootstrapAdminPassword, c.adminPassword); err != nil {
			return fmt.Errorf("update bootstrap guacamole admin password: %w", err)
		}

		return nil
	}

	if err := c.deleteUser(ctx, bootstrapSession, c.adminUsername); err != nil {
		return err
	}

	if err := c.createUser(ctx, bootstrapSession, c.adminUsername, c.adminPassword); err != nil {
		return fmt.Errorf("create configured guacamole admin user: %w", err)
	}

	patch := []map[string]string{
		{"op": "add", "path": "/systemPermissions", "value": "CREATE_USER"},
		{"op": "add", "path": "/systemPermissions", "value": "CREATE_USER_GROUP"},
		{"op": "add", "path": "/systemPermissions", "value": "CREATE_CONNECTION"},
		{"op": "add", "path": "/systemPermissions", "value": "CREATE_CONNECTION_GROUP"},
		{"op": "add", "path": "/systemPermissions", "value": "CREATE_SHARING_PROFILE"},
		{"op": "add", "path": "/systemPermissions", "value": "ADMINISTER"},
	}

	if err := c.requestJSON(ctx, bootstrapSession, http.MethodPatch, c.dataPath("/users/"+url.PathEscape(c.adminUsername)+"/permissions"), patch, nil, http.StatusNoContent); err != nil {
		return fmt.Errorf("grant configured guacamole admin permissions: %w", err)
	}

	return nil
}

func (c *Client) resetPortalSessionUser(ctx context.Context, adminSession *Session, username, password string) error {
	if err := c.deleteUser(ctx, adminSession, username); err != nil {
		return err
	}

	if err := c.createUser(ctx, adminSession, username, password); err != nil {
		return fmt.Errorf("create guacamole session user: %w", err)
	}

	return nil
}

func (c *Client) deleteUser(ctx context.Context, session *Session, username string) error {
	err := c.requestJSON(ctx, session, http.MethodDelete, c.dataPath("/users/"+url.PathEscape(username)), nil, nil, http.StatusNoContent)
	if isStatus(err, http.StatusNotFound) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("delete guacamole user %q: %w", username, err)
	}

	return nil
}

func (c *Client) createUser(ctx context.Context, session *Session, username, password string) error {
	payload := createUserPayload{
		Username: username,
		Password: password,
		Attributes: map[string]interface{}{
			"disabled":                 "",
			"expired":                  "",
			"access-window-start":      "",
			"access-window-end":        "",
			"valid-from":               "",
			"valid-until":              "",
			"timezone":                 nil,
			"guac-full-name":           "",
			"guac-organization":        "Portal",
			"guac-organizational-role": "Portal session",
		},
	}

	return c.requestJSON(ctx, session, http.MethodPost, c.dataPath("/users"), payload, nil, http.StatusOK)
}

func (c *Client) updateOwnPassword(ctx context.Context, session *Session, oldPassword, newPassword string) error {
	payload := map[string]string{
		"oldPassword": oldPassword,
		"newPassword": newPassword,
	}

	return c.requestJSON(
		ctx,
		session,
		http.MethodPut,
		c.dataPath("/users/"+url.PathEscape(session.Username)+"/password"),
		payload,
		nil,
		http.StatusNoContent,
	)
}

func (c *Client) ensureConnection(ctx context.Context, session *Session, profile *store.RemoteDesktopProfile, username string) (int64, error) {
	payload := connectionPayload{
		ParentIdentifier: "ROOT",
		Name:             c.connectionName(profile),
		Protocol:         "rdp",
		Parameters: map[string]string{
			"hostname":    strings.TrimSpace(profile.Host),
			"port":        strconv.Itoa(profile.Port),
			"username":    username,
			"password":    "${GUAC_PASSWORD}",
			"domain":      strings.TrimSpace(profile.Domain),
			"security":    "any",
			"ignore-cert": strconv.FormatBool(profile.IgnoreCert),
		},
		Attributes: map[string]string{
			"guacd-hostname":           "",
			"guacd-port":               "",
			"guacd-encryption":         "",
			"max-connections":          "",
			"max-connections-per-user": "",
			"weight":                   "",
			"failover-only":            "",
		},
	}

	if profile.GuacamoleConnectionID > 0 {
		payload.Identifier = strconv.FormatInt(profile.GuacamoleConnectionID, 10)
		err := c.requestJSON(
			ctx,
			session,
			http.MethodPut,
			c.dataPath("/connections/"+strconv.FormatInt(profile.GuacamoleConnectionID, 10)),
			payload,
			nil,
			http.StatusNoContent,
		)
		if err == nil {
			return profile.GuacamoleConnectionID, nil
		}
		if !isStatus(err, http.StatusNotFound) {
			return 0, fmt.Errorf("update guacamole connection: %w", err)
		}
	}

	var created connectionResponse
	if err := c.requestJSON(ctx, session, http.MethodPost, c.dataPath("/connections"), payload, &created, http.StatusOK); err != nil {
		return 0, fmt.Errorf("create guacamole connection: %w", err)
	}

	connectionID, err := strconv.ParseInt(strings.TrimSpace(created.Identifier), 10, 64)
	if err != nil || connectionID <= 0 {
		return 0, fmt.Errorf("parse guacamole connection identifier %q", created.Identifier)
	}

	return connectionID, nil
}

func (c *Client) grantConnectionAccess(ctx context.Context, session *Session, username string, connectionID int64) error {
	patch := []map[string]string{
		{"op": "add", "path": "/connectionPermissions/" + strconv.FormatInt(connectionID, 10), "value": "READ"},
	}

	if err := c.requestJSON(ctx, session, http.MethodPatch, c.dataPath("/users/"+url.PathEscape(username)+"/permissions"), patch, nil, http.StatusNoContent); err != nil {
		return fmt.Errorf("grant guacamole connection access: %w", err)
	}

	return nil
}

func (c *Client) authenticate(ctx context.Context, username, password string) (*Session, error) {
	form := url.Values{}
	form.Set("username", username)
	form.Set("password", password)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.resolve("/api/tokens"), strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, &requestError{StatusCode: resp.StatusCode, Body: string(body)}
	}

	var session Session
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		return nil, err
	}

	if session.DataSource == "" {
		session.DataSource = c.configuredDataSource
	}
	if session.AuthToken == "" || session.DataSource == "" {
		return nil, fmt.Errorf("guacamole authentication response missing auth token or data source")
	}

	return &session, nil
}

func (c *Client) requestJSON(ctx context.Context, session *Session, method, path string, payload any, out any, expectedStatus int) error {
	var body io.Reader
	if payload != nil {
		buf := &bytes.Buffer{}
		if err := json.NewEncoder(buf).Encode(payload); err != nil {
			return err
		}
		body = buf
	}

	endpoint := c.resolve(path)
	if session != nil && session.AuthToken != "" {
		querySeparator := "?"
		if strings.Contains(endpoint, "?") {
			querySeparator = "&"
		}
		endpoint += querySeparator + "token=" + url.QueryEscape(session.AuthToken)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
	if err != nil {
		return err
	}

	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != expectedStatus {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return &requestError{StatusCode: resp.StatusCode, Body: string(body)}
	}

	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			return err
		}
	}

	return nil
}

func (c *Client) resolve(path string) string {
	if c.baseURL == nil {
		return path
	}

	base := strings.TrimRight(c.baseURL.String(), "/")
	return base + path
}

func (c *Client) dataPath(path string) string {
	return "/api/session/data/" + c.configuredDataSource + path
}

func (c *Client) sessionUsername(portalUserID, profileID int64) string {
	return fmt.Sprintf("portal-u%d-p%d", portalUserID, profileID)
}

func (c *Client) connectionName(profile *store.RemoteDesktopProfile) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%d:%s:%s:%d", profile.ID, profile.Name, profile.Host, profile.Port)))
	suffix := hex.EncodeToString(sum[:])[:12]
	return fmt.Sprintf("portal-%d-%s", profile.ID, suffix)
}

func normalizeDataSource(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "mysql", "postgresql":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "postgresql"
	}
}

func encodeClientIdentifier(connectionID int64, dataSource string) string {
	raw := strconv.FormatInt(connectionID, 10) + "\x00c\x00" + dataSource
	return base64.StdEncoding.EncodeToString([]byte(raw))
}

type requestError struct {
	StatusCode int
	Body       string
}

func (e *requestError) Error() string {
	return fmt.Sprintf("guacamole request failed with status %d", e.StatusCode)
}

func isStatus(err error, statusCode int) bool {
	var reqErr *requestError
	if !errors.As(err, &reqErr) {
		return false
	}
	return reqErr.StatusCode == statusCode
}
