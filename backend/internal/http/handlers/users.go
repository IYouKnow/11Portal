package handlers

import (
	"database/sql"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/portal/backend/internal/store"
)

type UserHandler struct {
	store *store.Store
}

type createUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

func NewUserHandler(dataStore *store.Store) *UserHandler {
	return &UserHandler{store: dataStore}
}

func (h *UserHandler) List(c *fiber.Ctx) error {
	users, err := h.store.ListUsers(c.UserContext())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to load users",
		})
	}

	return c.JSON(fiber.Map{
		"items": users,
	})
}

func (h *UserHandler) Create(c *fiber.Ctx) error {
	var input createUserRequest
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	email := strings.TrimSpace(strings.ToLower(input.Email))
	password := strings.TrimSpace(input.Password)
	role := strings.TrimSpace(strings.ToLower(input.Role))

	if email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "email is required",
		})
	}

	if password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "password is required",
		})
	}

	if len(password) < 10 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "password must be at least 10 characters",
		})
	}

	if role != "admin" && role != "user" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "role must be either admin or user",
		})
	}

	user, err := h.store.CreateUser(c.UserContext(), store.CreateUserInput{
		Email:    email,
		Password: input.Password,
		Role:     role,
	})
	if err != nil {
		status := fiber.StatusInternalServerError
		message := "failed to create user"
		if strings.Contains(strings.ToLower(err.Error()), "unique") || err == sql.ErrNoRows {
			status = fiber.StatusConflict
			message = "a user with that email already exists"
		}

		return c.Status(status).JSON(fiber.Map{
			"error": message,
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"user": user,
	})
}
