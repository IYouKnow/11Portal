package handlers

import (
	"database/sql"
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/portal/backend/internal/guacamole"
	"github.com/portal/backend/internal/store"
)

type RemoteDesktopHandler struct {
	store     *store.Store
	guacamole *guacamole.Client
}

type createRemoteDesktopProfileRequest struct {
	Name       string `json:"name"`
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Domain     string `json:"domain"`
	Username   string `json:"username"`
	IgnoreCert bool   `json:"ignoreCert"`
}

type launchRemoteDesktopSessionRequest struct {
	ProfileID int64  `json:"profileId"`
	Username  string `json:"username"`
	Password  string `json:"password"`
}

func NewRemoteDesktopHandler(dataStore *store.Store, guacClient *guacamole.Client) *RemoteDesktopHandler {
	return &RemoteDesktopHandler{store: dataStore, guacamole: guacClient}
}

func (h *RemoteDesktopHandler) ListProfiles(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(int64)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	items, err := h.store.ListRemoteDesktopProfiles(c.UserContext(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to load remote desktop profiles",
		})
	}

	return c.JSON(fiber.Map{
		"items": items,
	})
}

func (h *RemoteDesktopHandler) CreateProfile(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(int64)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	var input createRemoteDesktopProfileRequest
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	name := strings.TrimSpace(input.Name)
	host := strings.TrimSpace(input.Host)
	domain := strings.TrimSpace(input.Domain)
	username := strings.TrimSpace(input.Username)
	port := input.Port
	if port == 0 {
		port = 3389
	}

	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "connection name is required",
		})
	}
	if host == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "host is required",
		})
	}
	if port < 1 || port > 65535 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "port must be between 1 and 65535",
		})
	}

	item, err := h.store.CreateRemoteDesktopProfile(c.UserContext(), userID, store.CreateRemoteDesktopProfileInput{
		Name:       name,
		Host:       host,
		Port:       port,
		Domain:     domain,
		Username:   username,
		IgnoreCert: input.IgnoreCert,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to save remote desktop profile",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"item": item,
	})
}

func (h *RemoteDesktopHandler) DeleteProfile(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(int64)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	profileID, err := c.ParamsInt("id")
	if err != nil || profileID <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid remote desktop profile id",
		})
	}

	profile, err := h.store.GetRemoteDesktopProfileByID(c.UserContext(), userID, int64(profileID))
	if err != nil && err != sql.ErrNoRows {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to load remote desktop profile",
		})
	}
	if err == nil && profile.GuacamoleConnectionID > 0 && h.guacamole != nil {
		_ = h.guacamole.DeleteConnection(c.UserContext(), profile.GuacamoleConnectionID)
	}

	deleted, err := h.store.DeleteRemoteDesktopProfile(c.UserContext(), userID, int64(profileID))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to delete remote desktop profile",
		})
	}
	if !deleted {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "remote desktop profile not found",
		})
	}

	return c.JSON(fiber.Map{
		"ok": true,
	})
}

func (h *RemoteDesktopHandler) Launch(c *fiber.Ctx) error {
	if h.guacamole == nil || !h.guacamole.Enabled() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "remote desktop gateway is not configured",
		})
	}

	userID, ok := c.Locals("userID").(int64)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	var input launchRemoteDesktopSessionRequest
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}
	if input.ProfileID <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "profileId is required",
		})
	}

	password := input.Password
	if strings.TrimSpace(password) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "password is required",
		})
	}

	profile, err := h.store.GetRemoteDesktopProfileByID(c.UserContext(), userID, input.ProfileID)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "remote desktop profile not found",
			})
		}

		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to load remote desktop profile",
		})
	}

	sessionUsername := strings.TrimSpace(input.Username)
	if sessionUsername == "" {
		sessionUsername = strings.TrimSpace(profile.Username)
	}
	if sessionUsername == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "username is required",
		})
	}

	launchURL, connectionID, err := h.guacamole.LaunchSession(c.UserContext(), userID, profile, sessionUsername, password)
	if err != nil {
		log.Printf(
			"remote desktop launch failed: user_id=%d profile_id=%d host=%s port=%d err=%v",
			userID,
			profile.ID,
			profile.Host,
			profile.Port,
			err,
		)
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": "failed to launch remote desktop session",
		})
	}

	if profile.GuacamoleConnectionID != connectionID {
		_ = h.store.UpdateRemoteDesktopProfileConnectionID(c.UserContext(), userID, profile.ID, connectionID)
	}

	return c.JSON(fiber.Map{
		"url": launchURL,
	})
}
