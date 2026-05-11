package httpserver

import (
	"crypto/tls"
	"log"
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

	if strings.HasPrefix(cfg.PublicURL, "http://") &&
		!strings.HasPrefix(cfg.PublicURL, "http://localhost") &&
		!strings.HasPrefix(cfg.PublicURL, "http://127.0.0.1") {
		log.Printf("WARNING: Portal is configured with a non-HTTPS public URL (%s). Chromium/Selkies requires HTTPS or localhost for a secure browser context.", cfg.PublicURL)
	}

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

	if chromiumURL, err := url.Parse(cfg.ChromiumInternalURL); err == nil && shouldProxyChromium(cfg) {
		chromiumProxy := httputil.NewSingleHostReverseProxy(chromiumURL)
		originalDirector := chromiumProxy.Director
		chromiumProxy.Director = func(req *http.Request) {
			originalDirector(req)
			req.Host = chromiumURL.Host
			req.Header.Set("Host", chromiumURL.Host)
		}
		chromiumProxy.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
		chromiumProxy.ModifyResponse = func(resp *http.Response) error {
			location := resp.Header.Get("Location")
			if location != "" && strings.Contains(location, "/chromium") {
				resp.Header.Set("Location", strings.Replace(location, chromiumURL.String(), "", 1))
			}
			return nil
		}
		app.Use("/chromium", middleware.RequireSession(cfg, dataStore), adaptor.HTTPHandler(chromiumProxy))
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

func shouldProxyChromium(cfg config.Config) bool {
	publicChromiumURL := strings.TrimSpace(cfg.ChromiumPublicURL)
	publicURL := strings.TrimRight(strings.TrimSpace(cfg.PublicURL), "/")

	if publicChromiumURL == "" {
		return true
	}

	return publicChromiumURL == publicURL+"/chromium" || publicChromiumURL == publicURL+"/chromium/"
}
