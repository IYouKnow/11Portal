package httpserver

import (
	"strings"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/portal/backend/internal/config"
	"github.com/portal/backend/internal/http/handlers"
	"github.com/portal/backend/internal/http/middleware"
	"github.com/portal/backend/internal/store"
)

func New(cfg config.Config, dataStore *store.Store) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName: "Portal API",
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.FrontendOrigin,
		AllowCredentials: true,
		AllowHeaders:     "Origin, Content-Type, Accept",
	}))

	authHandler := handlers.NewAuthHandler(cfg, dataStore)
	browserRuntimeHandler := handlers.NewBrowserRuntimeHandler(cfg.ChromiumContainer)
	systemHandler := handlers.NewSystemHandler(cfg, dataStore)
	workspaceHandler := handlers.NewWorkspaceHandler(dataStore)

	api := app.Group("/api/v1")
	api.Get("/health", systemHandler.Health)
	api.Post("/auth/login", authHandler.Login)
	api.Post("/auth/logout", authHandler.Logout)

	secured := api.Use(middleware.RequireSession(cfg, dataStore))
	secured.Get("/auth/me", authHandler.Me)
	secured.Post("/browser/open", browserRuntimeHandler.Open)
	secured.Post("/browser/close", browserRuntimeHandler.Close)
	secured.Get("/system/overview", systemHandler.Overview)
	secured.Get("/workspaces", workspaceHandler.List)

	app.Use("/ws/terminal", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}

		return fiber.ErrUpgradeRequired
	})

	app.Get(
		"/ws/terminal",
		middleware.RequireSession(cfg, dataStore),
		websocket.New(handlers.TerminalSocket(cfg), websocket.Config{
			Origins: []string{cfg.FrontendOrigin, strings.TrimSuffix(cfg.PublicURL, "/")},
		}),
	)

	return app
}
