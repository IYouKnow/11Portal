package handlers

import (
	"io"
	"os/exec"

	"github.com/creack/pty"
	"github.com/gofiber/contrib/websocket"
	"github.com/portal/backend/internal/config"
)

func TerminalSocket(cfg config.Config) func(*websocket.Conn) {
	return func(conn *websocket.Conn) {
		cmd := exec.Command(cfg.Shell)
		ptmx, err := pty.Start(cmd)
		if err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("failed to start shell\r\n"))
			_ = conn.Close()
			return
		}
		defer func() {
			_ = ptmx.Close()
			_ = cmd.Wait()
		}()

		done := make(chan struct{})

		go func() {
			buffer := make([]byte, 1024)
			for {
				n, readErr := ptmx.Read(buffer)
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

			if _, err := io.WriteString(ptmx, string(payload)); err != nil {
				break
			}
		}

		_ = ptmx.Close()
		<-done
	}
}
