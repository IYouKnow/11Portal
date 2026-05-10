package httpserver

import (
	"crypto/tls"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gofiber/adaptor/v2"
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/portal/backend/internal/config"
	"github.com/portal/backend/internal/http/handlers"
	"github.com/portal/backend/internal/http/middleware"
	"github.com/portal/backend/internal/store"
	"github.com/portal/backend/internal/terminal"
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
	terminalManager := terminal.NewManager(time.Duration(cfg.TerminalIdleMinutes) * time.Minute)
	_ = terminalManager.StartReaper(time.Minute)
	terminalSessionHandler := handlers.NewTerminalSessionHandler(cfg, terminalManager)

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
	secured.Post("/terminal/sessions", terminalSessionHandler.Create)
	secured.Get("/terminal/sessions", terminalSessionHandler.List)
	secured.Delete("/terminal/sessions/:id", terminalSessionHandler.Delete)

	app.Use("/ws/terminal", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}

		return fiber.ErrUpgradeRequired
	})

	app.Get(
		"/ws/terminal/:id",
		middleware.RequireSession(cfg, dataStore),
		websocket.New(terminalSessionHandler.Socket, websocket.Config{
			Origins: []string{cfg.FrontendOrigin, strings.TrimSuffix(cfg.PublicURL, "/")},
		}),
	)

	app.Get(
		"/ws/terminal",
		middleware.RequireSession(cfg, dataStore),
		websocket.New(handlers.TerminalSocket(cfg, terminalManager), websocket.Config{
			Origins: []string{cfg.FrontendOrigin, strings.TrimSuffix(cfg.PublicURL, "/")},
		}),
	)

	if chromiumURL, err := url.Parse(cfg.ChromiumURL); err == nil {
		chromiumProxy := httputil.NewSingleHostReverseProxy(chromiumURL)
		originalDirector := chromiumProxy.Director
		chromiumProxy.Director = func(req *http.Request) {
			originalDirector(req)
			req.Host = "localhost:3001"
			req.Header.Set("Host", "localhost:3001")
		}
		chromiumProxy.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
		chromiumProxy.ModifyResponse = func(resp *http.Response) error {
			location := resp.Header.Get("Location")
			if strings.Contains(location, "/chromium") {
				resp.Header.Set("Location", "/chromium/")
			}
			return nil
		}
		app.Use("/chromium", adaptor.HTTPHandler(chromiumProxy))
	}

	if cfg.WebRoot != "" {
		if info, err := os.Stat(cfg.WebRoot); err == nil && info.IsDir() {
			app.Static("/", cfg.WebRoot)
			app.Get("/*", func(c *fiber.Ctx) error {
				return c.SendFile(cfg.WebRoot + "/index.html")
			})
		}
	}

	return app
}
