package httpserver

import (
	"crypto/tls"
	"fmt"
	"io"
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
	"github.com/portal/backend/internal/guacamole"
	"github.com/portal/backend/internal/http/handlers"
	"github.com/portal/backend/internal/http/middleware"
	"github.com/portal/backend/internal/store"
	"github.com/portal/backend/internal/terminal"
)

func New(cfg config.Config, dataStore *store.Store) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName: "Nortem Portal API",
	})

	if strings.HasPrefix(cfg.PublicURL, "http://") &&
		!strings.HasPrefix(cfg.PublicURL, "http://localhost") &&
		!strings.HasPrefix(cfg.PublicURL, "http://127.0.0.1") {
		log.Printf("WARNING: Nortem Portal is configured with a non-HTTPS public URL (%s). Chromium/Selkies requires HTTPS or localhost for a secure browser context.", cfg.PublicURL)
	}

	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.FrontendOrigin,
		AllowCredentials: true,
		AllowHeaders:     "Origin, Content-Type, Accept",
	}))

	authHandler := handlers.NewAuthHandler(cfg, dataStore)
	browserRuntimeHandler := handlers.NewBrowserRuntimeHandler(cfg.ChromiumContainer)
	systemHandler := handlers.NewSystemHandler(cfg, dataStore)
	userHandler := handlers.NewUserHandler(dataStore)
	workspaceHandler := handlers.NewWorkspaceHandler(dataStore)
	guacamoleClient, err := guacamole.NewClient(cfg)
	if err != nil {
		log.Printf("WARNING: failed to configure guacamole client: %v", err)
	}
	chromiumProxyHandler, err := handlers.NewChromiumProxyHandler(cfg.ChromiumInternalURL)
	if err != nil {
		log.Printf("WARNING: failed to configure chromium proxy: %v", err)
	}
	guacamoleProxyHandler, err := handlers.NewGuacamoleProxyHandler(cfg)
	if err != nil {
		log.Printf("WARNING: failed to configure guacamole websocket proxy: %v", err)
	}
	remoteDesktopHandler := handlers.NewRemoteDesktopHandler(dataStore, guacamoleClient)
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
	secured.Get("/users", middleware.RequireRole("admin"), userHandler.List)
	secured.Post("/users", middleware.RequireRole("admin"), userHandler.Create)
	secured.Get("/workspaces", workspaceHandler.List)
	secured.Get("/remote-desktop/profiles", remoteDesktopHandler.ListProfiles)
	secured.Post("/remote-desktop/profiles", remoteDesktopHandler.CreateProfile)
	secured.Delete("/remote-desktop/profiles/:id", remoteDesktopHandler.DeleteProfile)
	secured.Post("/remote-desktop/launch", remoteDesktopHandler.Launch)
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
		validateWebSocketOrigin(cfg),
		websocket.New(terminalSessionHandler.Socket),
	)

	app.Get(
		"/ws/terminal",
		middleware.RequireSession(cfg, dataStore),
		validateWebSocketOrigin(cfg),
		websocket.New(handlers.TerminalSocket(cfg, terminalManager)),
	)

	if guacamoleProxyHandler != nil && guacamoleProxyHandler.Enabled() {
		app.Use(
			"/guacamole/websocket-tunnel",
			middleware.RequireSession(cfg, dataStore),
			guacamoleProxyHandler.PrepareWebSocketTunnel,
		)
		app.Get(
			"/guacamole/websocket-tunnel",
			validateWebSocketOrigin(cfg),
			websocket.New(guacamoleProxyHandler.WebSocketTunnel, websocket.Config{
				Subprotocols: []string{"guacamole"},
			}),
		)
	}

	if chromiumProxyHandler != nil && chromiumProxyHandler.Enabled() && shouldProxyChromium(cfg) {
		app.Use(
			"/chromium/websockets",
			middleware.RequireSession(cfg, dataStore),
			chromiumProxyHandler.PrepareWebSocket,
		)
		app.Get(
			"/chromium/websockets",
			validateWebSocketOrigin(cfg),
			websocket.New(chromiumProxyHandler.WebSocket),
		)

		app.Use("/chromium", middleware.RequireSession(cfg, dataStore), func(c *fiber.Ctx) error {
			upstreamURL := chromiumProxyHandler.BuildUpstreamHTTPRequestURL(c.Path())
			if upstreamURL == "" {
				return fiber.ErrBadGateway
			}

			return adaptor.HTTPHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				proxyReq, err := http.NewRequestWithContext(r.Context(), r.Method, upstreamURL, r.Body)
				if err != nil {
					http.Error(w, "failed to build upstream request", http.StatusBadGateway)
					return
				}

				proxyReq.Header = r.Header.Clone()
				proxyReq.Host = proxyReq.URL.Host
				proxyReq.Header.Set("Host", proxyReq.URL.Host)
				proxyReq.Header.Set("X-Forwarded-Host", r.Host)
				proxyReq.Header.Set("X-Forwarded-Proto", forwardedProto(r))
				proxyReq.Header.Set("X-Forwarded-For", forwardedFor(r))

				resp, err := insecureHTTPClient.Do(proxyReq)
				if err != nil {
					http.Error(w, "failed to reach chromium upstream", http.StatusBadGateway)
					return
				}
				defer resp.Body.Close()

				copyResponseHeaders(w.Header(), resp.Header)
				w.WriteHeader(resp.StatusCode)
				_, _ = io.Copy(w, resp.Body)
			}))(c)
		})
	}

	if guacamoleProxy, err := buildGuacamoleProxy(cfg); err == nil {
		app.Use("/guacamole", middleware.RequireSession(cfg, dataStore), adaptor.HTTPHandler(guacamoleProxy))
	} else if strings.TrimSpace(cfg.GuacamoleInternalURL) != "" {
		log.Printf("WARNING: failed to configure guacamole proxy: %v", err)
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

var insecureHTTPClient = &http.Client{
	Transport: &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	},
}

func copyResponseHeaders(dst, src http.Header) {
	for key, values := range src {
		for _, value := range values {
			dst.Add(key, value)
		}
	}
}

func buildGuacamoleProxy(cfg config.Config) (http.Handler, error) {
	trimmedURL := strings.TrimSpace(cfg.GuacamoleInternalURL)
	if trimmedURL == "" {
		return nil, fmt.Errorf("empty guacamole internal url")
	}

	target, err := url.Parse(trimmedURL)
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(&url.URL{
		Scheme: target.Scheme,
		Host:   target.Host,
	})

	basePath := strings.TrimRight(target.Path, "/")
	proxy.Director = func(req *http.Request) {
		originalHost := req.Host
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		req.Host = target.Host
		req.Header.Set("Host", target.Host)
		req.Header.Set("X-Forwarded-Host", originalHost)
		req.Header.Set("X-Forwarded-Proto", forwardedProto(req))
		req.Header.Set("X-Forwarded-For", forwardedFor(req))
		req.URL.Path = singleJoiningSlash(basePath, strings.TrimPrefix(req.URL.Path, "/guacamole"))
		if req.URL.RawPath != "" {
			req.URL.RawPath = singleJoiningSlash(basePath, strings.TrimPrefix(req.URL.RawPath, "/guacamole"))
		}
	}
	proxy.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	proxy.FlushInterval = -1

	return proxy, nil
}

func singleJoiningSlash(a, b string) string {
	aslash := strings.HasSuffix(a, "/")
	bslash := strings.HasPrefix(b, "/")
	switch {
	case aslash && bslash:
		return a + b[1:]
	case !aslash && !bslash:
		return a + "/" + b
	default:
		return a + b
	}
}

func forwardedProto(req *http.Request) string {
	if proto := req.Header.Get("X-Forwarded-Proto"); proto != "" {
		return proto
	}
	if req.TLS != nil {
		return "https"
	}
	return "http"
}

func forwardedFor(req *http.Request) string {
	if forwarded := req.Header.Get("X-Forwarded-For"); forwarded != "" {
		return forwarded
	}
	return req.RemoteAddr
}

func shouldProxyChromium(cfg config.Config) bool {
	publicChromiumURL := strings.TrimSpace(cfg.ChromiumPublicURL)
	publicURL := strings.TrimRight(strings.TrimSpace(cfg.PublicURL), "/")

	if publicChromiumURL == "" {
		return true
	}

	switch publicChromiumURL {
	case "/chromium", "/chromium/":
		return true
	case publicURL + "/chromium", publicURL + "/chromium/":
		return true
	default:
		return false
	}
}

func validateWebSocketOrigin(cfg config.Config) fiber.Handler {
	allowedOrigins := configuredWebSocketOrigins(cfg)

	return func(c *fiber.Ctx) error {
		origin := normalizeOrigin(c.Get("Origin"))
		if origin == "" {
			return c.Next()
		}

		if _, ok := allowedOrigins[origin]; ok {
			return c.Next()
		}

		requestOrigin := normalizeOrigin(requestPublicOrigin(c))
		if requestOrigin != "" && origin == requestOrigin {
			return c.Next()
		}

		if sameHostOrigin(origin, requestOrigin) {
			return c.Next()
		}

		return fiber.ErrForbidden
	}
}

func configuredWebSocketOrigins(cfg config.Config) map[string]struct{} {
	origins := map[string]struct{}{}
	for _, candidate := range []string{cfg.FrontendOrigin, cfg.PublicURL} {
		normalized := normalizeOrigin(candidate)
		if normalized == "" {
			continue
		}
		origins[normalized] = struct{}{}
	}
	return origins
}

func requestPublicOrigin(c *fiber.Ctx) string {
	host := strings.TrimSpace(c.Hostname())
	if host == "" {
		return ""
	}

	return forwardedProtoForFiber(c) + "://" + host
}

func forwardedProtoForFiber(c *fiber.Ctx) string {
	if proto := strings.TrimSpace(c.Get("X-Forwarded-Proto")); proto != "" {
		return proto
	}
	return c.Protocol()
}

func normalizeOrigin(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" || parsed.Scheme == "" {
		return ""
	}

	return strings.ToLower(parsed.Scheme) + "://" + strings.ToLower(parsed.Host)
}

func sameHostOrigin(left, right string) bool {
	if left == "" || right == "" {
		return false
	}

	leftURL, leftErr := url.Parse(left)
	rightURL, rightErr := url.Parse(right)
	if leftErr != nil || rightErr != nil {
		return false
	}

	return strings.EqualFold(leftURL.Host, rightURL.Host)
}
