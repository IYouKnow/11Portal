package handlers

import (
	"errors"
	"io"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/portal/backend/internal/config"
	"github.com/portal/backend/internal/terminal"
)

type TerminalSessionHandler struct {
	cfg     config.Config
	manager *terminal.Manager
}

type createTerminalSessionRequest struct {
	Type string `json:"type"`
	SSH  *struct {
		Host       string `json:"host"`
		Port       int    `json:"port"`
		Username   string `json:"username"`
		AuthType   string `json:"authType"`
		Password   string `json:"password"`
		PrivateKey string `json:"privateKey"`
		Passphrase string `json:"passphrase"`
	} `json:"ssh"`
}

func NewTerminalSessionHandler(cfg config.Config, manager *terminal.Manager) *TerminalSessionHandler {
	return &TerminalSessionHandler{
		cfg:     cfg,
		manager: manager,
	}
}

func (h *TerminalSessionHandler) Create(c *fiber.Ctx) error {
	var body createTerminalSessionRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	userID, ok := userIDFromLocals(c.Locals("userID"))
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication required"})
	}

	input := terminal.CreateSessionInput{
		Type:  terminal.SessionType(body.Type),
		Shell: h.cfg.Shell,
	}
	if body.SSH != nil {
		input.SSH = &terminal.SSHConfig{
			Host:       body.SSH.Host,
			Port:       body.SSH.Port,
			Username:   body.SSH.Username,
			AuthType:   terminal.SSHAuthType(body.SSH.AuthType),
			Password:   body.SSH.Password,
			PrivateKey: body.SSH.PrivateKey,
			Passphrase: body.SSH.Passphrase,
		}
	}

	session, err := h.manager.CreateSession(userID, input)
	if err != nil {
		if errors.Is(err, terminal.ErrInvalidConfig) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid terminal session configuration"})
		}
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "failed to create terminal session"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"item": session})
}

func (h *TerminalSessionHandler) List(c *fiber.Ctx) error {
	userID, ok := userIDFromLocals(c.Locals("userID"))
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication required"})
	}

	items := h.manager.ListSessions(userID)
	return c.JSON(fiber.Map{"items": items})
}

func (h *TerminalSessionHandler) Delete(c *fiber.Ctx) error {
	userID, ok := userIDFromLocals(c.Locals("userID"))
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication required"})
	}

	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing session id"})
	}

	if err := h.manager.CloseSession(id, userID, false); err != nil {
		if errors.Is(err, terminal.ErrSessionNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "terminal session not found"})
		}
		if errors.Is(err, terminal.ErrSessionForbidden) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "terminal session access forbidden"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to close terminal session"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

func (h *TerminalSessionHandler) Socket(conn *websocket.Conn) {
	userID, ok := userIDFromLocals(conn.Locals("userID"))
	if !ok {
		_ = conn.WriteMessage(websocket.TextMessage, []byte("unauthorized\r\n"))
		_ = conn.Close()
		return
	}

	id := conn.Params("id")
	if id == "" {
		_ = conn.WriteMessage(websocket.TextMessage, []byte("missing session id\r\n"))
		_ = conn.Close()
		return
	}

	handle, err := h.manager.AttachSession(id, userID)
	if err != nil {
		_ = conn.WriteMessage(websocket.TextMessage, []byte("session unavailable\r\n"))
		_ = conn.Close()
		return
	}

	done := make(chan struct{})

	go func() {
		buffer := make([]byte, 2048)
		for {
			n, readErr := handle.Read(buffer)
			if n > 0 {
				if err := conn.WriteMessage(websocket.TextMessage, buffer[:n]); err != nil {
					break
				}
			}
			if readErr != nil {
				break
			}
		}
		close(done)
	}()

	for {
		messageType, payload, err := conn.ReadMessage()
		if err != nil {
			break
		}

		if messageType != websocket.TextMessage && messageType != websocket.BinaryMessage {
			continue
		}

		if _, err := io.WriteString(handle, string(payload)); err != nil {
			break
		}
	}

	<-done
}

func userIDFromLocals(value any) (int64, bool) {
	id, ok := value.(int64)
	return id, ok
}
