import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  GLOBAL_THEME_STORAGE_KEY,
  applyResolvedTheme,
  getSystemTheme,
  getThemeStorageKey,
  readStoredThemeMode,
  type ResolvedTheme,
  type ThemeMode,
} from "./theme-config";
import { ThemeContext, type ThemeContextValue } from "./theme-context";

export function ThemeProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId: number | null;
}) {
  const storageKey = getThemeStorageKey(userId);
  const [mode, setMode] = useState<ThemeMode>(() => readStoredThemeMode(userId));
  const [hydratedStorageKey, setHydratedStorageKey] = useState(storageKey);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  useEffect(() => {
    setMode(readStoredThemeMode(userId));
    setHydratedStorageKey(storageKey);
  }, [storageKey, userId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (event?: MediaQueryListEvent) => {
      setSystemTheme(event?.matches ?? mediaQuery.matches ? "dark" : "light");
    };

    updateSystemTheme();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateSystemTheme);
      return () => mediaQuery.removeEventListener("change", updateSystemTheme);
    }

    mediaQuery.addListener(updateSystemTheme);
    return () => mediaQuery.removeListener(updateSystemTheme);
  }, []);

  const resolvedTheme = mode === "system" ? systemTheme : mode;

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window === "undefined" || hydratedStorageKey !== storageKey) {
      return;
    }

    window.localStorage.setItem(storageKey, mode);
    window.localStorage.setItem(GLOBAL_THEME_STORAGE_KEY, mode);
  }, [hydratedStorageKey, mode, storageKey]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      setMode,
    }),
    [mode, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
