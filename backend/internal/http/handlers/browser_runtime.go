package handlers

import (
	"os/exec"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type BrowserRuntimeHandler struct {
	containerName string
}

func NewBrowserRuntimeHandler(containerName string) *BrowserRuntimeHandler {
	return &BrowserRuntimeHandler{containerName: containerName}
}

func (h *BrowserRuntimeHandler) Open(c *fiber.Ctx) error {
	if h.containerName == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "chromium container control is not configured",
		})
	}

	checkCmd := exec.Command(
		"docker",
		"exec",
		"-u",
		"abc",
		h.containerName,
		"bash",
		"-lc",
		"pgrep -f '^/bin/bash /usr/bin/wrapped-chromium' >/dev/null",
	)
	if err := checkCmd.Run(); err == nil {
		return c.JSON(fiber.Map{
			"ok": true,
		})
	}

	cmd := exec.Command(
		"docker",
		"exec",
		"-d",
		"-u",
		"abc",
		h.containerName,
		"bash",
		"-lc",
		"wrapped-chromium --enable-features=UseOzonePlatform --ozone-platform=wayland ${CHROME_CLI}",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to start chromium",
			"detail": strings.TrimSpace(string(output)),
		})
	}

	return c.JSON(fiber.Map{
		"ok": true,
	})
}

func (h *BrowserRuntimeHandler) Close(c *fiber.Ctx) error {
	if h.containerName == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "chromium container control is not configured",
		})
	}

	cmd := exec.Command(
		"docker",
		"exec",
		h.containerName,
		"bash",
		"-lc",
		"pkill -f '^/bin/bash /usr/bin/wrapped-chromium' || true; pkill -f '^/opt/ungoogledchromium/chrome ' || true",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to close chromium",
			"detail": strings.TrimSpace(string(output)),
		})
	}

	return c.JSON(fiber.Map{
		"ok": true,
	})
}
