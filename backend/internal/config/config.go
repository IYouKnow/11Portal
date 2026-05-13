package config

import (
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	HTTPAddr            string
	PublicURL           string
	FrontendOrigin      string
	SessionCookieName   string
	SessionTTLHours     int
	AdminEmail          string
	AdminPassword       string
	DBPath              string
	Shell               string
	WorkspacesRoot      string
	ChromiumContainer   string
	ChromiumInternalURL string
	ChromiumPublicURL   string
	RemoteDesktopPublicURL string
	TerminalIdleMinutes int
	WebRoot             string
}

func Load() Config {
	publicURL := envOrDefault("PORTAL_PUBLIC_URL", "http://localhost:8080")
	legacyChromiumURL := envOrDefault("PORTAL_CHROMIUM_URL", "https://chromium:3001/chromium")

	chromiumInternalURL := envOrDefault("PORTAL_CHROMIUM_INTERNAL_URL", legacyChromiumURL)
	chromiumPublicURL := envOrDefault("PORTAL_CHROMIUM_PUBLIC_URL", "")
	if chromiumPublicURL == "" {
		if shouldUseLegacyChromiumURLAsPublic(publicURL, legacyChromiumURL) {
			chromiumPublicURL = legacyChromiumURL
		} else {
			chromiumPublicURL = joinURLPath(publicURL, "/chromium/")
		}
	}

	return Config{
		HTTPAddr:            envOrDefault("PORTAL_HTTP_ADDR", ":8080"),
		PublicURL:           publicURL,
		FrontendOrigin:      envOrDefault("PORTAL_FRONTEND_ORIGIN", "http://localhost:5173"),
		SessionCookieName:   envOrDefault("PORTAL_SESSION_COOKIE_NAME", "portal_session"),
		SessionTTLHours:     envOrDefaultInt("PORTAL_SESSION_TTL_HOURS", 24),
		AdminEmail:          envOrDefault("PORTAL_ADMIN_EMAIL", "admin@portal.local"),
		AdminPassword:       envOrDefault("PORTAL_ADMIN_PASSWORD", "change-me-now"),
		DBPath:              envOrDefault("PORTAL_DB_PATH", "./data/portal.db"),
		Shell:               envOrDefault("PORTAL_SHELL", "/bin/sh"),
		WorkspacesRoot:      envOrDefault("PORTAL_WORKSPACES_ROOT", "/workspaces"),
		ChromiumContainer:   envOrDefault("PORTAL_CHROMIUM_CONTAINER", "portal-chromium"),
		ChromiumInternalURL: chromiumInternalURL,
		ChromiumPublicURL:   chromiumPublicURL,
		RemoteDesktopPublicURL: envOrDefault("PORTAL_REMOTE_DESKTOP_PUBLIC_URL", ""),
		TerminalIdleMinutes: envOrDefaultInt("PORTAL_TERMINAL_IDLE_MINUTES", 30),
		WebRoot:             envOrDefault("PORTAL_WEB_ROOT", "/app/public"),
	}
}

func envOrDefault(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}

	return fallback
}

func envOrDefaultInt(key string, fallback int) int {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func hasHTTPPrefix(value string) bool {
	return strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://")
}

func joinURLPath(base, path string) string {
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(path, "/")
}

func shouldUseLegacyChromiumURLAsPublic(publicURL, legacyChromiumURL string) bool {
	if !hasHTTPPrefix(legacyChromiumURL) {
		return false
	}

	legacyParsed, legacyErr := url.Parse(legacyChromiumURL)
	publicParsed, publicErr := url.Parse(publicURL)
	if legacyErr != nil || publicErr != nil {
		return false
	}

	legacyHost := strings.ToLower(legacyParsed.Hostname())
	publicHost := strings.ToLower(publicParsed.Hostname())
	legacyPort := legacyParsed.Port()
	publicPort := publicParsed.Port()

	if legacyHost == "" {
		return false
	}

	if !strings.HasPrefix(legacyParsed.Path, "/chromium") {
		return false
	}

	if legacyHost != publicHost || legacyPort != publicPort {
		return true
	}

	return false
}
