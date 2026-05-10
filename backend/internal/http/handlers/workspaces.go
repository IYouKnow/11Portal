package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/portal/backend/internal/store"
)

type WorkspaceHandler struct {
	store *store.Store
}

func NewWorkspaceHandler(dataStore *store.Store) *WorkspaceHandler {
	return &WorkspaceHandler{store: dataStore}
}

func (h *WorkspaceHandler) List(c *fiber.Ctx) error {
	workspaces, err := h.store.ListWorkspaces(c.UserContext())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to load workspaces",
		})
	}

	return c.JSON(fiber.Map{
		"items": workspaces,
	})
}
