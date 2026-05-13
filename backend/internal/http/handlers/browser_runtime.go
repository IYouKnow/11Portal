package handlers

import (
	"fmt"
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
	containerName, err := h.resolveContainerName()
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	checkCmd := exec.Command(
		"docker",
		"exec",
		"-u",
		"abc",
		containerName,
		"bash",
		"-lc",
		"pgrep -f '^/opt/ungoogledchromium/chrome ' >/dev/null || pgrep -f '^/bin/bash /usr/bin/wrapped-chromium' >/dev/null",
	)
	if err := checkCmd.Run(); err == nil {
		return c.JSON(fiber.Map{
			"ok":      true,
			"started": false,
		})
	}

	// If the wrapper survived but Chromium exited (black-screen state), clear stale wrappers first.
	cleanupCmd := exec.Command(
		"docker",
		"exec",
		"-u",
		"abc",
		containerName,
		"bash",
		"-lc",
		"pkill -f '^/bin/bash /usr/bin/wrapped-chromium' || true",
	)
	if output, err := cleanupCmd.CombinedOutput(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":  "failed to clear stale chromium wrapper",
			"detail": strings.TrimSpace(string(output)),
		})
	}

	cmd := exec.Command(
		"docker",
		"exec",
		"-d",
		"-u",
		"abc",
		containerName,
		"bash",
		"-lc",
		"LOCK=/tmp/portal-chromium-open.lock; "+
			"if [ -e \"$LOCK\" ] && kill -0 \"$(cat \"$LOCK\" 2>/dev/null)\" 2>/dev/null; then exit 0; fi; "+
			"echo $$ > \"$LOCK\"; trap 'rm -f \"$LOCK\"' EXIT; "+
			"if pgrep -f '^/opt/ungoogledchromium/chrome ' >/dev/null || pgrep -f '^/bin/bash /usr/bin/wrapped-chromium' >/dev/null; then exit 0; fi; "+
			"LABWC_PID=$(pgrep -xo labwc || true); "+
			"if [ -n \"$LABWC_PID\" ]; then "+
			"eval \"$(tr '\\0' '\\n' < /proc/$LABWC_PID/environ | grep -E '^(XDG_RUNTIME_DIR|WAYLAND_DISPLAY|DISPLAY)=' | sed 's/^/export /')\"; "+
			"fi; "+
			"/opt/ungoogledchromium/chrome --no-sandbox --test-type "+
			"--password-store=basic --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' --user-data-dir "+
			"--new-window --window-size=1366,820 --window-position=80,60 "+
			"--enable-features=UseOzonePlatform --ozone-platform=wayland ${CHROME_CLI} >/dev/null 2>&1 &",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":  "failed to start chromium",
			"detail": strings.TrimSpace(string(output)),
		})
	}

	return c.JSON(fiber.Map{
		"ok":      true,
		"started": true,
	})
}

func (h *BrowserRuntimeHandler) Close(c *fiber.Ctx) error {
	containerName, err := h.resolveContainerName()
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	cmd := exec.Command(
		"docker",
		"exec",
		"-u",
		"abc",
		containerName,
		"bash",
		"-lc",
		"pkill -f '^/bin/bash /usr/bin/wrapped-chromium' >/dev/null 2>&1 || true; "+
			"pkill -f '^/opt/ungoogledchromium/chrome ' >/dev/null 2>&1 || true; "+
			"exit 0",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":  "failed to close chromium",
			"detail": strings.TrimSpace(string(output)),
		})
	}

	return c.JSON(fiber.Map{
		"ok": true,
	})
}

func (h *BrowserRuntimeHandler) resolveContainerName() (string, error) {
	configured := strings.TrimSpace(h.containerName)
	if configured == "" {
		return "", fmt.Errorf("chromium container control is not configured")
	}

	if containerExists(configured) {
		return configured, nil
	}

	composeMatch, err := firstDockerPSMatch(
		"--filter", "label=com.docker.compose.service=chromium",
	)
	if err == nil && composeMatch != "" {
		return composeMatch, nil
	}

	nameMatch, err := firstDockerPSMatch(
		"--filter", "name="+configured,
	)
	if err == nil && nameMatch != "" {
		return nameMatch, nil
	}

	return "", fmt.Errorf("chromium container not found (configured as %q)", configured)
}

func containerExists(name string) bool {
	cmd := exec.Command("docker", "inspect", name)
	return cmd.Run() == nil
}

func firstDockerPSMatch(args ...string) (string, error) {
	baseArgs := []string{"ps", "--format", "{{.Names}}"}
	cmd := exec.Command("docker", append(baseArgs, args...)...)
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	for _, line := range strings.Split(string(output), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			return trimmed, nil
		}
	}

	return "", nil
}
