export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const GLOBAL_THEME_STORAGE_KEY = "portal.theme";
const DEFAULT_THEME_MODE: ThemeMode = "system";

const themeVariables: Record<ResolvedTheme, Record<string, string>> = {
  light: {
    "--color-canvas": "244 247 251",
    "--color-panel": "255 255 255",
    "--color-surface": "248 250 252",
    "--color-surface-soft": "255 255 255",
    "--color-surface-strong": "226 232 240",
    "--color-line": "203 213 225",
    "--color-line-strong": "148 163 184",
    "--color-ink": "15 23 42",
    "--color-muted": "71 85 105",
    "--color-accent": "14 165 233",
    "--color-accent-strong": "3 105 161",
    "--color-success": "22 163 74",
    "--color-success-ink": "20 83 45",
    "--color-warning": "217 119 6",
    "--color-warning-ink": "146 64 14",
    "--color-danger": "220 38 38",
    "--color-danger-ink": "127 29 29",
    "--color-info": "37 99 235",
    "--color-info-ink": "30 64 175",
    "--color-window": "255 255 255",
    "--color-window-active": "250 252 255",
    "--color-window-chrome": "244 247 251",
    "--color-selection": "14 165 233",
    "--grid-line": "51 65 85",
    "--body-background":
      "radial-gradient(circle at top, rgba(14, 165, 233, 0.1), transparent 30%), linear-gradient(180deg, #f8fbff 0%, #eef3f9 100%)",
    "--body-overlay":
      "radial-gradient(circle at 0% 0%, rgba(255, 255, 255, 0.7), transparent 22%), radial-gradient(circle at 100% 0%, rgba(14, 165, 233, 0.12), transparent 24%)",
    "--shadow-soft": "0 24px 80px rgba(15, 23, 42, 0.12)",
    "--shadow-floating": "0 28px 70px rgba(15, 23, 42, 0.16)",
    "--scrollbar-thumb": "rgba(71, 85, 105, 0.28)",
    "--scrollbar-thumb-hover": "rgba(71, 85, 105, 0.44)",
    "--desktop-icon-shadow": "0 1px 2px rgba(255, 255, 255, 0.65)",
    "--app-top-glow": "linear-gradient(180deg, rgba(255, 255, 255, 0.28), transparent)",
  },
  dark: {
    "--color-canvas": "9 9 11",
    "--color-panel": "17 17 19",
    "--color-surface": "24 24 27",
    "--color-surface-soft": "20 20 23",
    "--color-surface-strong": "0 0 0",
    "--color-line": "39 39 42",
    "--color-line-strong": "125 211 252",
    "--color-ink": "244 244 245",
    "--color-muted": "161 161 170",
    "--color-accent": "125 211 252",
    "--color-accent-strong": "186 230 253",
    "--color-success": "52 211 153",
    "--color-success-ink": "209 250 229",
    "--color-warning": "245 158 11",
    "--color-warning-ink": "254 243 199",
    "--color-danger": "239 68 68",
    "--color-danger-ink": "254 202 202",
    "--color-info": "56 189 248",
    "--color-info-ink": "186 230 253",
    "--color-window": "7 9 13",
    "--color-window-active": "7 9 13",
    "--color-window-chrome": "16 16 19",
    "--color-selection": "56 189 248",
    "--grid-line": "255 255 255",
    "--body-background":
      "radial-gradient(circle at top, rgba(255, 255, 255, 0.04), transparent 28%), linear-gradient(180deg, #111318 0%, #0b0d12 42%, #07090d 100%)",
    "--body-overlay":
      "radial-gradient(circle at 0% 0%, rgba(255, 255, 255, 0.04), transparent 24%), radial-gradient(circle at 100% 100%, rgba(255, 255, 255, 0.02), transparent 26%)",
    "--shadow-soft": "0 24px 80px rgba(0, 0, 0, 0.45)",
    "--shadow-floating": "0 28px 70px rgba(0, 0, 0, 0.45)",
    "--scrollbar-thumb": "rgba(255, 255, 255, 0.18)",
    "--scrollbar-thumb-hover": "rgba(255, 255, 255, 0.28)",
    "--desktop-icon-shadow": "0 1px 3px rgba(0, 0, 0, 0.85)",
    "--app-top-glow": "linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent)",
  },
};

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

export function getThemeStorageKey(userId: number | null) {
  return userId === null
    ? GLOBAL_THEME_STORAGE_KEY
    : `${GLOBAL_THEME_STORAGE_KEY}.${userId}`;
}

export function readStoredThemeMode(userId: number | null): ThemeMode {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_MODE;
  }

  const userScopedValue =
    userId === null ? null : window.localStorage.getItem(getThemeStorageKey(userId));
  if (isThemeMode(userScopedValue)) {
    return userScopedValue;
  }

  const globalValue = window.localStorage.getItem(GLOBAL_THEME_STORAGE_KEY);
  if (isThemeMode(globalValue)) {
    return globalValue;
  }

  return DEFAULT_THEME_MODE;
}

export function applyResolvedTheme(theme: ResolvedTheme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const variables = themeVariables[theme];
  for (const [name, value] of Object.entries(variables)) {
    document.documentElement.style.setProperty(name, value);
  }
}

export function getTerminalTheme(theme: ResolvedTheme) {
  if (theme === "light") {
    return {
      background: "#f8fafc",
      foreground: "#0f172a",
      cursor: "#0284c7",
      cursorAccent: "#f8fafc",
      selectionBackground: "rgba(14, 116, 144, 0.22)",
      black: "#1f2937",
      red: "#dc2626",
      green: "#15803d",
      yellow: "#b45309",
      blue: "#2563eb",
      magenta: "#9333ea",
      cyan: "#0f766e",
      white: "#e2e8f0",
      brightBlack: "#475569",
      brightRed: "#ef4444",
      brightGreen: "#22c55e",
      brightYellow: "#f59e0b",
      brightBlue: "#3b82f6",
      brightMagenta: "#a855f7",
      brightCyan: "#14b8a6",
      brightWhite: "#0f172a",
    };
  }

  return {
    background: "#030712",
    foreground: "#e2e8f0",
    cursor: "#7dd3fc",
    cursorAccent: "#030712",
    selectionBackground: "rgba(125, 211, 252, 0.22)",
    black: "#111827",
    red: "#f87171",
    green: "#34d399",
    yellow: "#fbbf24",
    blue: "#60a5fa",
    magenta: "#c084fc",
    cyan: "#67e8f9",
    white: "#e2e8f0",
    brightBlack: "#64748b",
    brightRed: "#fca5a5",
    brightGreen: "#6ee7b7",
    brightYellow: "#fcd34d",
    brightBlue: "#93c5fd",
    brightMagenta: "#d8b4fe",
    brightCyan: "#a5f3fc",
    brightWhite: "#f8fafc",
  };
}
