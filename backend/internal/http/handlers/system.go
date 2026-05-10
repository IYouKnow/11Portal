package handlers

import (
	"runtime"

	"github.com/gofiber/fiber/v2"
	"github.com/portal/backend/internal/config"
	"github.com/portal/backend/internal/store"
)

type SystemHandler struct {
	cfg   config.Config
	store *store.Store
}

func NewSystemHandler(cfg config.Config, dataStore *store.Store) *SystemHandler {
	return &SystemHandler{cfg: cfg, store: dataStore}
}

func (h *SystemHandler) Health(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status": "ok",
	})
}

func (h *SystemHandler) Overview(c *fiber.Ctx) error {
	workspaces, err := h.store.ListWorkspaces(c.UserContext())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to load overview",
		})
	}

	return c.JSON(fiber.Map{
		"platform": fiber.Map{
			"name":           "Portal",
			"publicURL":      h.cfg.PublicURL,
			"workspacesRoot": h.cfg.WorkspacesRoot,
			"runtime":        runtime.GOOS + "/" + runtime.GOARCH,
		},
		"stats": fiber.Map{
			"workspaceCount": len(workspaces),
			"terminalStatus": "ready",
			"remoteDesktop":  "planned",
		},
	})
}
