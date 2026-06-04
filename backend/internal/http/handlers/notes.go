package handlers

import (
	"database/sql"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/portal/backend/internal/store"
)

type NotesHandler struct {
	store *store.Store
}

type createNoteRequest struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

type updateNoteRequest struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

func NewNotesHandler(dataStore *store.Store) *NotesHandler {
	return &NotesHandler{store: dataStore}
}

func (h *NotesHandler) List(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(int64)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	items, err := h.store.ListNotes(c.UserContext(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to load notes",
		})
	}

	return c.JSON(fiber.Map{
		"items": items,
	})
}

func (h *NotesHandler) Create(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(int64)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	var input createNoteRequest
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	item, err := h.store.CreateNote(c.UserContext(), userID, store.CreateNoteInput{
		Title: strings.TrimSpace(input.Title),
		Text:  input.Text,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create note",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"item": item,
	})
}

func (h *NotesHandler) Update(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(int64)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	noteID, err := c.ParamsInt("id")
	if err != nil || noteID <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid note id",
		})
	}

	var input updateNoteRequest
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	item, err := h.store.UpdateNote(c.UserContext(), userID, int64(noteID), store.UpdateNoteInput{
		Title: strings.TrimSpace(input.Title),
		Text:  input.Text,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "note not found",
			})
		}

		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to update note",
		})
	}

	return c.JSON(fiber.Map{
		"item": item,
	})
}

func (h *NotesHandler) Delete(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(int64)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	noteID, err := c.ParamsInt("id")
	if err != nil || noteID <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid note id",
		})
	}

	deleted, err := h.store.DeleteNote(c.UserContext(), userID, int64(noteID))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to delete note",
		})
	}
	if !deleted {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "note not found",
		})
	}

	return c.JSON(fiber.Map{
		"ok": true,
	})
}
