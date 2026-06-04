package handlers

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/portal/backend/internal/networkscan"
)

type NetworkScanHandler struct{}

func NewNetworkScanHandler() *NetworkScanHandler {
	return &NetworkScanHandler{}
}

type networkScanRequest struct {
	CIDRs []string `json:"cidrs"`
}

func (h *NetworkScanHandler) Scan(c *fiber.Ctx) error {
	req := networkScanRequest{}
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid scan request",
			})
		}
	}

	cidrs := normalizeCIDRs(req.CIDRs)
	if len(cidrs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "enter at least one CIDR range to scan",
		})
	}

	results, summary, err := networkscan.Scan(c.UserContext(), networkscan.ScanOptions{
		CIDRs:       cidrs,
		Timeout:     300 * time.Millisecond,
		Concurrency: 128,
		MaxIPs:      4096,
	})
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"items":   results,
		"summary": summary,
	})
}

func normalizeCIDRs(values []string) []string {
	result := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}

		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}

	return result
}
