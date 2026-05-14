package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	upstreamws "github.com/fasthttp/websocket"
	fiberws "github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/portal/backend/internal/config"
)

type GuacamoleProxyHandler struct {
	upstreamWebSocketURL string
}

const guacamoleWebSocketSubprotocol = "guacamole"

func NewGuacamoleProxyHandler(cfg config.Config) (*GuacamoleProxyHandler, error) {
	internalURL := strings.TrimSpace(cfg.GuacamoleInternalURL)
	if internalURL == "" {
		return &GuacamoleProxyHandler{}, nil
	}

	parsed, err := url.Parse(internalURL)
	if err != nil {
		return nil, fmt.Errorf("parse guacamole internal url: %w", err)
	}

	switch parsed.Scheme {
	case "http":
		parsed.Scheme = "ws"
	case "https":
		parsed.Scheme = "wss"
	}

	parsed.Path = strings.TrimRight(parsed.Path, "/") + "/websocket-tunnel"

	return &GuacamoleProxyHandler{
		upstreamWebSocketURL: parsed.String(),
	}, nil
}

func (h *GuacamoleProxyHandler) Enabled() bool {
	return h != nil && strings.TrimSpace(h.upstreamWebSocketURL) != ""
}

func (h *GuacamoleProxyHandler) PrepareWebSocketTunnel(c *fiber.Ctx) error {
	if !fiberws.IsWebSocketUpgrade(c) {
		return fiber.ErrUpgradeRequired
	}

	rawQuery := string(c.Context().QueryArgs().QueryString())
	upstreamURL := h.upstreamWebSocketURL
	if rawQuery != "" {
		upstreamURL += "?" + rawQuery
	}

	c.Locals("guacUpstreamWebSocketURL", upstreamURL)
	return c.Next()
}

func (h *GuacamoleProxyHandler) WebSocketTunnel(conn *fiberws.Conn) {
	upstreamURL, _ := conn.Locals("guacUpstreamWebSocketURL").(string)
	if upstreamURL == "" {
		_ = conn.WriteControl(
			upstreamws.CloseMessage,
			upstreamws.FormatCloseMessage(upstreamws.CloseInternalServerErr, "missing upstream websocket url"),
			time.Now().Add(time.Second),
		)
		_ = conn.Close()
		return
	}

	dialer := upstreamws.Dialer{
		HandshakeTimeout: 30 * time.Second,
		Subprotocols:     []string{guacamoleWebSocketSubprotocol},
	}

	upstreamConn, _, err := dialer.Dial(upstreamURL, http.Header{})
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

type websocketReader interface {
	ReadMessage() (messageType int, p []byte, err error)
}

type websocketWriter interface {
	WriteMessage(messageType int, data []byte) error
	WriteControl(messageType int, data []byte, deadline time.Time) error
	Close() error
}

func proxyWebSocketFrames(src websocketReader, dst websocketWriter, errCh chan<- error) {
	for {
		messageType, payload, err := src.ReadMessage()
		if err != nil {
			if closeErr, ok := err.(*upstreamws.CloseError); ok {
				_ = dst.WriteControl(
					upstreamws.CloseMessage,
					upstreamws.FormatCloseMessage(closeErr.Code, closeErr.Text),
					time.Now().Add(time.Second),
				)
			}
			if err != io.EOF {
				errCh <- err
			} else {
				errCh <- context.Canceled
			}
			return
		}

		if err := dst.WriteMessage(messageType, payload); err != nil {
			errCh <- err
			return
		}
	}
}
