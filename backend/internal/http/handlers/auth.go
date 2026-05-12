package handlers

import (
	"database/sql"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/portal/backend/internal/config"
	"github.com/portal/backend/internal/store"
)

type AuthHandler struct {
	cfg   config.Config
	store *store.Store
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func NewAuthHandler(cfg config.Config, dataStore *store.Store) *AuthHandler {
	return &AuthHandler{cfg: cfg, store: dataStore}
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var input loginRequest
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	user, err := h.store.AuthenticateUser(input.Email, input.Password)
	if err != nil {
		status := fiber.StatusUnauthorized
		if err != sql.ErrNoRows {
			status = fiber.StatusUnauthorized
		}

		return c.Status(status).JSON(fiber.Map{
			"error": "invalid email or password",
		})
	}

	session, err := h.store.CreateSession(c.UserContext(), user.ID, time.Duration(h.cfg.SessionTTLHours)*time.Hour)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create session",
		})
	}

	c.Cookie(&fiber.Cookie{
		Name:     h.cfg.SessionCookieName,
		Value:    session.Token,
		HTTPOnly: true,
		Secure:   strings.HasPrefix(strings.ToLower(h.cfg.PublicURL), "https://"),
		SameSite: "lax",
		Expires:  session.ExpiresAt,
		Path:     "/",
	})

	return c.JSON(fiber.Map{
		"user": user,
	})
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	token := c.Cookies(h.cfg.SessionCookieName)
	if token != "" {
		_ = h.store.DeleteSession(c.UserContext(), token)
	}

	c.Cookie(&fiber.Cookie{
		Name:     h.cfg.SessionCookieName,
		Value:    "",
		HTTPOnly: true,
		Expires:  time.Unix(0, 0),
		Path:     "/",
	})

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AuthHandler) Me(c *fiber.Ctx) error {
	user := c.Locals("user")
	return c.JSON(fiber.Map{
		"user": user,
	})
}
