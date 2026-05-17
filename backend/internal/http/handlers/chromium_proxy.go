package handlers

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	upstreamws "github.com/fasthttp/websocket"
	fiberws "github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
)

type ChromiumProxyHandler struct {
	upstreamHTTPURL      *url.URL
	upstreamWebSocketURL *url.URL
}

func NewChromiumProxyHandler(internalURL string) (*ChromiumProxyHandler, error) {
	trimmed := strings.TrimSpace(internalURL)
	if trimmed == "" {
		return &ChromiumProxyHandler{}, nil
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return nil, fmt.Errorf("parse chromium internal url: %w", err)
	}

	wsURL := *parsed
	switch wsURL.Scheme {
	case "http":
		wsURL.Scheme = "ws"
	case "https":
		wsURL.Scheme = "wss"
	}

	return &ChromiumProxyHandler{
		upstreamHTTPURL:      parsed,
		upstreamWebSocketURL: &wsURL,
	}, nil
}

func (h *ChromiumProxyHandler) Enabled() bool {
	return h != nil && h.upstreamHTTPURL != nil && h.upstreamWebSocketURL != nil
}

func (h *ChromiumProxyHandler) PrepareWebSocket(c *fiber.Ctx) error {
	if !fiberws.IsWebSocketUpgrade(c) {
		return fiber.ErrUpgradeRequired
	}

	upstreamURL := h.BuildUpstreamWebSocketURL(c.Path(), string(c.Context().QueryArgs().QueryString()))
	c.Locals("chromiumUpstreamWebSocketURL", upstreamURL)
	c.Locals("chromiumWebSocketOrigin", strings.TrimSpace(c.Get("Origin")))
	return c.Next()
}

func (h *ChromiumProxyHandler) WebSocket(conn *fiberws.Conn) {
	upstreamURL, _ := conn.Locals("chromiumUpstreamWebSocketURL").(string)
	if upstreamURL == "" {
		_ = conn.WriteControl(
			upstreamws.CloseMessage,
			upstreamws.FormatCloseMessage(upstreamws.CloseInternalServerErr, "missing upstream websocket url"),
			time.Now().Add(time.Second),
		)
		_ = conn.Close()
		return
	}

	headers := http.Header{}
	if origin, _ := conn.Locals("chromiumWebSocketOrigin").(string); origin != "" {
		headers.Set("Origin", origin)
	}

	dialer := upstreamws.Dialer{
		HandshakeTimeout: 30 * time.Second,
		TLSClientConfig:  &tls.Config{InsecureSkipVerify: true},
	}

	upstreamConn, _, err := dialer.Dial(upstreamURL, headers)
	if err != nil {
		_ = conn.WriteControl(
			upstreamws.CloseMessage,
			upstreamws.FormatCloseMessage(upstreamws.CloseTryAgainLater, "failed to connect upstream"),
			time.Now().Add(time.Second),
		)
		_ = conn.Close()
		return
	}
	defer upstreamConn.Close()
	defer conn.Close()

	errCh := make(chan error, 2)
	go proxyWebSocketFrames(conn, upstreamConn, errCh)
	go proxyWebSocketFrames(upstreamConn, conn, errCh)
	<-errCh
}

func (h *ChromiumProxyHandler) BuildUpstreamHTTPRequestURL(requestPath string) string {
	if h == nil || h.upstreamHTTPURL == nil {
		return ""
	}

	target := *h.upstreamHTTPURL
	target.Path = joinUpstreamPath(target.Path, requestPath)
	target.RawPath = target.Path
	return target.String()
}

func (h *ChromiumProxyHandler) BuildUpstreamWebSocketURL(requestPath, rawQuery string) string {
	if h == nil || h.upstreamWebSocketURL == nil {
		return ""
	}

	target := *h.upstreamWebSocketURL
	target.Path = joinUpstreamWebSocketPath(target.Path, requestPath)
	target.RawPath = target.Path
	target.RawQuery = rawQuery
	return target.String()
}

func joinUpstreamPath(basePath, requestPath string) string {
	trimmedBase := strings.TrimRight(strings.TrimSpace(basePath), "/")
	trimmedRequest := strings.TrimPrefix(strings.TrimSpace(requestPath), "/chromium")
	if trimmedRequest == "" {
		trimmedRequest = "/"
	}

	switch {
	case trimmedBase == "":
		return trimmedRequest
	case trimmedRequest == "/":
		return trimmedBase + "/"
	default:
		return trimmedBase + "/" + strings.TrimPrefix(trimmedRequest, "/")
	}
}

func joinUpstreamWebSocketPath(basePath, requestPath string) string {
	joined := joinUpstreamPath(basePath, requestPath)
	return strings.Replace(joined, "/websockets", "/websocket", 1)
}
