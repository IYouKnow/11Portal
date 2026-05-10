package handlers

import (
	"io"

	"github.com/gofiber/contrib/websocket"
	"github.com/portal/backend/internal/config"
	"github.com/portal/backend/internal/terminal"
)

// TerminalSocket keeps compatibility with the old /ws/terminal endpoint by creating
// a local session and attaching immediately.
func TerminalSocket(cfg config.Config, manager *terminal.Manager) func(*websocket.Conn) {
	return func(conn *websocket.Conn) {
		userID, ok := userIDFromLocals(conn.Locals("userID"))
		if !ok {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("unauthorized\r\n"))
			_ = conn.Close()
			return
		}

		session, err := manager.CreateSession(userID, terminal.CreateSessionInput{
			Type:  terminal.SessionTypeLocal,
			Shell: cfg.Shell,
		})
		if err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("failed to start shell\r\n"))
			_ = conn.Close()
			return
		}
		defer func() {
			_ = manager.CloseSession(session.ID, userID, false)
		}()

		handle, err := manager.AttachSession(session.ID, userID)
		if err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("failed to attach shell\r\n"))
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
}
