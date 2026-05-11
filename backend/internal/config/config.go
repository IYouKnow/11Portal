package config

import (
	"os"
	"strconv"
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
	ChromiumURL         string
	TerminalIdleMinutes int
	WebRoot             string
}

func Load() Config {
	return Config{
		HTTPAddr:            envOrDefault("PORTAL_HTTP_ADDR", ":8080"),
		PublicURL:           envOrDefault("PORTAL_PUBLIC_URL", "http://localhost:8080"),
		FrontendOrigin:      envOrDefault("PORTAL_FRONTEND_ORIGIN", "http://localhost:5173"),
		SessionCookieName:   envOrDefault("PORTAL_SESSION_COOKIE_NAME", "portal_session"),
		SessionTTLHours:     envOrDefaultInt("PORTAL_SESSION_TTL_HOURS", 24),
		AdminEmail:          envOrDefault("PORTAL_ADMIN_EMAIL", "admin@portal.local"),
		AdminPassword:       envOrDefault("PORTAL_ADMIN_PASSWORD", "change-me-now"),
		DBPath:              envOrDefault("PORTAL_DB_PATH", "./data/portal.db"),
		Shell:               envOrDefault("PORTAL_SHELL", "/bin/sh"),
		WorkspacesRoot:      envOrDefault("PORTAL_WORKSPACES_ROOT", "/workspaces"),
		ChromiumContainer:   envOrDefault("PORTAL_CHROMIUM_CONTAINER", "portal-chromium"),
		ChromiumURL:         envOrDefault("PORTAL_CHROMIUM_URL", "http://chromium:3000"),
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
