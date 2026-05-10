package middleware

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
	"github.com/portal/backend/internal/config"
	"github.com/portal/backend/internal/store"
)

func RequireSession(cfg config.Config, dataStore *store.Store) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Cookies(cfg.SessionCookieName)
		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authentication required",
			})
		}

		user, err := dataStore.GetUserBySessionToken(c.UserContext(), token)
		if err != nil {
			if err == sql.ErrNoRows {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error": "invalid session",
				})
			}

			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to resolve session",
			})
		}

		c.Locals("user", user)
		c.Locals("userID", user.ID)

		return c.Next()
	}
}
