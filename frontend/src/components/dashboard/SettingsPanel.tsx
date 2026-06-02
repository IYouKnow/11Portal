import type { ChangeEvent, FormEvent } from "react";
import type { User } from "../../lib/api";
import { useTheme } from "../../theme-context";
import {
  buildWallpaperBackgroundImage,
  getWallpaperOverlay,
  wallpaperPresets,
} from "./constants";
import type { DesktopLaunchMode, WallpaperPresetId, WallpaperState } from "./types";

type SettingsPanelProps = {
  customWallpaperUrl: string;
  desktopLaunchMode: DesktopLaunchMode;
  error: string | null;
  onApplyPresetWallpaper: (presetId: WallpaperPresetId) => void;
  onCustomWallpaperUrlChange: (value: string) => void;
  onDesktopLaunchModeChange: (mode: DesktopLaunchMode) => void;
  onShowDockChange: (value: boolean) => void;
  onWallpaperUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onWallpaperUrlSubmit: (event: FormEvent<HTMLFormElement>) => void;
  showDock: boolean;
  user: User;
  wallpaper: WallpaperState;
  wallpaperError: string | null;
};

export function SettingsPanel({
  customWallpaperUrl,
  desktopLaunchMode,
  error,
  onApplyPresetWallpaper,
  onCustomWallpaperUrlChange,
  onDesktopLaunchModeChange,
  onShowDockChange,
  onWallpaperUpload,
  onWallpaperUrlSubmit,
  showDock,
  user,
  wallpaper,
  wallpaperError,
}: SettingsPanelProps) {
  const { mode, resolvedTheme, setMode } = useTheme();

  return (
    <div className="grid h-full min-h-0 grid-cols-[220px_1fr] overflow-hidden bg-panel">
      <aside className="settings-scrollbar overflow-y-auto border-r border-line bg-panel/95 p-4">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
          Settings
        </p>
        <div className="mt-4 rounded-2xl border border-line bg-surface/80 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">
            Signed in
          </p>
          <p className="mt-2 text-sm text-ink">{user.email}</p>
          <p className="mt-1 text-xs text-muted">Role: {user.role}</p>
        </div>
      </aside>

      <div className="settings-scrollbar min-h-0 overflow-y-auto p-5">
        <section className="rounded-3xl border border-line bg-surface/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted">
                Appearance
              </p>
              <h2 className="mt-2 text-xl font-medium text-ink">Theme</h2>
            </div>
            <span className="rounded-full border border-line bg-panel/70 px-3 py-1 text-xs text-muted">
              {mode === "system"
                ? `System (${resolvedTheme})`
                : `${mode[0].toUpperCase()}${mode.slice(1)}`}
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-muted">
            Choose a light or dark interface, or follow this device&apos;s system setting.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(["light", "dark"] as const).map((themeMode) => {
              const isSelected = mode === themeMode;
              const label = `${themeMode[0].toUpperCase()}${themeMode.slice(1)}`;

              return (
                <button
                  key={themeMode}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-accent/45 bg-accent/10"
                      : "border-line bg-surface-soft hover:border-line-strong/40 hover:bg-surface"
                  }`}
                  onClick={() => setMode(themeMode)}
                  type="button"
                >
                  <p className="text-sm font-medium text-ink">{label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {`Always use the ${themeMode} interface.`}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-line bg-surface/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted">
                Personalization
              </p>
              <h2 className="mt-2 text-xl font-medium text-ink">Wallpaper</h2>
            </div>
            <button
              className="rounded-2xl border border-line bg-panel/70 px-3 py-2 text-xs text-muted transition hover:text-ink"
              onClick={() => onApplyPresetWallpaper("gradient")}
              type="button"
            >
              Reset
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {wallpaperPresets.map((preset) => {
              const isSelected =
                wallpaper.mode === "preset" && wallpaper.presetId === preset.id;

              return (
                <button
                  key={preset.id}
                  className={`overflow-hidden rounded-2xl border text-left transition ${
                    isSelected
                      ? "border-accent/45 bg-accent/10"
                      : "border-line bg-panel/70 hover:border-line-strong/40"
                  }`}
                  onClick={() => onApplyPresetWallpaper(preset.id as WallpaperPresetId)}
                  type="button"
                >
                  <div
                    className="h-24 w-full"
                    style={{
                      backgroundImage: buildWallpaperBackgroundImage(
                        getWallpaperOverlay(
                          preset.id as WallpaperPresetId,
                          resolvedTheme,
                        ),
                        preset.image,
                      ),
                      backgroundPosition: "center",
                      backgroundSize: "cover",
                    }}
                  />
                  <div className="px-3 py-2 text-sm text-ink">{preset.label}</div>
                </button>
              );
            })}
          </div>

          <form className="mt-5 flex flex-col gap-3" onSubmit={onWallpaperUrlSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm text-muted">Image URL</span>
              <input
                className="w-full rounded-2xl border border-line bg-surface-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
                onChange={(event) => onCustomWallpaperUrlChange(event.target.value)}
                placeholder="https://example.com/wallpaper.jpg"
                type="url"
                value={customWallpaperUrl}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent transition hover:bg-accent/20"
                type="submit"
              >
                Apply image URL
              </button>
              <label className="cursor-pointer rounded-2xl border border-line bg-panel/70 px-4 py-3 text-sm text-ink transition hover:bg-surface">
                Upload image
                <input
                  accept="image/*"
                  className="hidden"
                  onChange={onWallpaperUpload}
                  type="file"
                />
              </label>
            </div>
          </form>

          <p className="mt-4 text-xs leading-5 text-muted">
            Wallpapers are saved in this browser, so each device can keep its own desktop look.
          </p>

          {wallpaperError ? (
            <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-ink">
              {wallpaperError}
            </div>
          ) : null}
        </section>

        <section className="mt-4 rounded-3xl border border-line bg-surface/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted">
                Desktop
              </p>
              <h2 className="mt-2 text-xl font-medium text-ink">App launch</h2>
            </div>
            <span className="rounded-full border border-line bg-panel/70 px-3 py-1 text-xs text-muted">
              Default: double click
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-muted">
            Choose how desktop apps open when you select them.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-panel/70 p-4 transition hover:border-line-strong/40 hover:bg-surface">
              <input
                checked={desktopLaunchMode === "double"}
                className="mt-1 h-4 w-4 accent-accent"
                name="desktop-launch-mode"
                onChange={() => onDesktopLaunchModeChange("double")}
                type="radio"
              />
              <div>
                <p className="text-sm font-medium text-ink">Double click</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  First click selects the app. Second click opens it.
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-panel/70 p-4 transition hover:border-line-strong/40 hover:bg-surface">
              <input
                checked={desktopLaunchMode === "single"}
                className="mt-1 h-4 w-4 accent-accent"
                name="desktop-launch-mode"
                onChange={() => onDesktopLaunchModeChange("single")}
                type="radio"
              />
              <div>
                <p className="text-sm font-medium text-ink">Single click</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Clicking an app selects it and opens it right away.
                </p>
              </div>
            </label>
          </div>

          <div className="mt-6 border-t border-line pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-ink">Dock</h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Hide the bottom dock to keep the desktop clear.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-full border border-line bg-panel/70 px-3 py-2 text-sm text-ink transition hover:border-line-strong/40 hover:bg-surface">
                <span className="text-xs uppercase tracking-[0.22em] text-muted">
                  {showDock ? "On" : "Off"}
                </span>
                <input
                  checked={showDock}
                  className="h-4 w-4 accent-accent"
                  onChange={(event) => onShowDockChange(event.target.checked)}
                  type="checkbox"
                />
              </label>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-ink">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
