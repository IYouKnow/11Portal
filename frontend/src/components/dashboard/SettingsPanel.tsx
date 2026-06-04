import type { ChangeEvent } from "react";
import {
  Monitor,
  Moon,
  MousePointerClick,
  PanelBottom,
  Sun,
  Upload,
} from "lucide-react";
import type { User } from "../../lib/api";
import { useTheme } from "../../theme-context";
import {
  buildWallpaperBackgroundImage,
  getWallpaperOverlay,
  wallpaperPresets,
} from "./constants";
import type { DesktopLaunchMode, WallpaperPresetId, WallpaperState } from "./types";

type SettingsPanelProps = {
  desktopLaunchMode: DesktopLaunchMode;
  error: string | null;
  onApplyPresetWallpaper: (presetId: WallpaperPresetId) => void;
  onDesktopLaunchModeChange: (mode: DesktopLaunchMode) => void;
  onShowDockChange: (value: boolean) => void;
  onWallpaperUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  showDock: boolean;
  user: User;
  wallpaper: WallpaperState;
  wallpaperError: string | null;
};

function SectionLabel({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.26em] text-muted">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-medium text-ink">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

export function SettingsPanel({
  desktopLaunchMode,
  error,
  onApplyPresetWallpaper,
  onDesktopLaunchModeChange,
  onShowDockChange,
  onWallpaperUpload,
  showDock,
  user,
  wallpaper,
  wallpaperError,
}: SettingsPanelProps) {
  const { mode, resolvedTheme, setMode } = useTheme();
  const effectiveThemeLabel =
    mode === "system"
      ? `System (${resolvedTheme})`
      : `${mode[0].toUpperCase()}${mode.slice(1)}`;

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_1fr] overflow-hidden bg-panel">
      <aside className="settings-scrollbar overflow-y-auto border-r border-line bg-[linear-gradient(180deg,rgb(var(--color-panel))_0%,rgb(var(--color-surface))_100%)] p-5">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Settings</p>

        <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-line bg-surface-soft shadow-soft">
          <div
            className="h-36 border-b border-line"
            style={{
              backgroundImage: buildWallpaperBackgroundImage(
                wallpaper.overlay,
                wallpaper.image,
              ),
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Monitor className="h-5 w-5" strokeWidth={1.9} />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">Workspace style</p>
                <p className="text-xs text-muted">{effectiveThemeLabel}</p>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="rounded-2xl border border-line bg-panel/80 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Signed in</p>
                <p className="mt-2 break-all text-sm font-medium text-ink">{user.email}</p>
                <p className="mt-1 text-xs text-muted">Role: {user.role}</p>
              </div>

              <div className="rounded-2xl border border-line bg-panel/80 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">Dock</p>
                    <p className="mt-1 text-xs text-muted">
                      {showDock
                        ? "Always visible on desktop"
                        : "Auto-hides until you move to the bottom edge"}
                    </p>
                  </div>
                  <PanelBottom className="h-4 w-4 text-muted" strokeWidth={1.9} />
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-panel/80 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">Launch mode</p>
                    <p className="mt-1 text-xs text-muted">
                      {desktopLaunchMode === "double"
                        ? "Double click to open apps"
                        : "Single click to open apps"}
                    </p>
                  </div>
                  <MousePointerClick className="h-4 w-4 text-muted" strokeWidth={1.9} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="settings-scrollbar min-h-0 overflow-y-auto bg-surface/45 p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-5">
          <section className="rounded-[2rem] border border-line bg-panel/84 p-6 shadow-soft backdrop-blur-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <SectionLabel
                eyebrow="Appearance"
                title="Theme"
                description="Set the interface tone for this device. Light and dark stay consistent across the desktop and app windows."
              />
              <div className="inline-flex rounded-full border border-line bg-surface/80 p-1">
                {(["light", "dark"] as const).map((themeMode) => {
                  const isSelected = mode === themeMode;
                  const Icon = themeMode === "light" ? Sun : Moon;

                  return (
                    <button
                      key={themeMode}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                        isSelected
                          ? "bg-accent text-white shadow-[0_10px_22px_rgba(14,165,233,0.28)]"
                          : "text-muted hover:text-ink"
                      }`}
                      onClick={() => setMode(themeMode)}
                      type="button"
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.9} />
                      <span className="capitalize">{themeMode}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-line bg-panel/84 p-6 shadow-soft backdrop-blur-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <SectionLabel
                eyebrow="Personalization"
                title="Wallpaper"
                description="Choose a background that fits this workspace. Presets are quick, and custom images stay saved in this browser."
              />
              <button
                className="rounded-2xl border border-line bg-surface/80 px-4 py-2 text-sm text-muted transition hover:border-line-strong/50 hover:text-ink"
                onClick={() => onApplyPresetWallpaper("gradient")}
                type="button"
              >
                Reset wallpaper
              </button>
            </div>

            <div className="settings-scrollbar mt-6 flex gap-3 overflow-x-auto pb-2">
              {wallpaperPresets.map((preset) => {
                const isSelected =
                  wallpaper.mode === "preset" && wallpaper.presetId === preset.id;

                return (
                  <button
                    key={preset.id}
                    className={`min-w-[148px] flex-none overflow-hidden rounded-[1.4rem] border text-left transition ${
                      isSelected
                        ? "border-accent/45 bg-accent/10 shadow-[0_14px_30px_rgba(14,165,233,0.12)]"
                        : "border-line bg-panel/78 hover:border-line-strong/40 hover:bg-surface"
                    }`}
                    onClick={() => onApplyPresetWallpaper(preset.id as WallpaperPresetId)}
                    type="button"
                  >
                    <div
                      className="h-28 w-full"
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
                    <div className="flex items-center justify-between px-3 py-3">
                      <span className="text-sm font-medium text-ink">{preset.label}</span>
                      {isSelected ? (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-white">
                          Active
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}

              <label className="group min-w-[148px] flex-none cursor-pointer overflow-hidden rounded-[1.4rem] border border-dashed border-line bg-panel/78 transition hover:border-line-strong/40 hover:bg-surface">
                <div className="flex h-28 w-full items-center justify-center bg-[linear-gradient(180deg,rgba(14,165,233,0.08),rgba(255,255,255,0.02))] dark:bg-[linear-gradient(180deg,rgba(125,211,252,0.08),rgba(255,255,255,0.02))]">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-panel/80 text-muted transition group-hover:text-ink">
                    <Upload className="h-5 w-5" strokeWidth={1.9} />
                  </div>
                </div>
                <div className="px-3 py-3">
                  <p className="text-sm font-medium text-ink">Upload image</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Choose a wallpaper from your computer.
                  </p>
                </div>
                <input
                  accept="image/*"
                  className="hidden"
                  onChange={onWallpaperUpload}
                  type="file"
                />
              </label>
            </div>

            <p className="mt-4 text-xs leading-5 text-muted">
              Custom wallpapers are stored locally for this browser profile.
            </p>

            {wallpaperError ? (
              <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-ink">
                {wallpaperError}
              </div>
            ) : null}
          </section>

          <section className="rounded-[2rem] border border-line bg-panel/84 p-6 shadow-soft backdrop-blur-sm">
            <SectionLabel
              eyebrow="Desktop"
              title="Interaction"
              description="Choose how apps open from the desktop and whether the dock stays visible or auto-hides."
            />

            <div className="mt-6 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-[1.4rem] border p-4 transition ${
                    desktopLaunchMode === "double"
                      ? "border-accent/40 bg-accent/10"
                      : "border-line bg-surface/70 hover:border-line-strong/40 hover:bg-surface"
                  }`}
                >
                  <input
                    checked={desktopLaunchMode === "double"}
                    className="mt-1 h-4 w-4 accent-accent"
                    name="desktop-launch-mode"
                    onChange={() => onDesktopLaunchModeChange("double")}
                    type="radio"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="h-4 w-4 text-muted" strokeWidth={1.9} />
                      <p className="text-sm font-medium text-ink">Double click</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted">
                      First click selects the app. Second click opens it.
                    </p>
                  </div>
                </label>

                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-[1.4rem] border p-4 transition ${
                    desktopLaunchMode === "single"
                      ? "border-accent/40 bg-accent/10"
                      : "border-line bg-surface/70 hover:border-line-strong/40 hover:bg-surface"
                  }`}
                >
                  <input
                    checked={desktopLaunchMode === "single"}
                    className="mt-1 h-4 w-4 accent-accent"
                    name="desktop-launch-mode"
                    onChange={() => onDesktopLaunchModeChange("single")}
                    type="radio"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="h-4 w-4 text-muted" strokeWidth={1.9} />
                      <p className="text-sm font-medium text-ink">Single click</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted">
                      Clicking an app selects it and opens it right away.
                    </p>
                  </div>
                </label>
              </div>

              <div className="rounded-[1.4rem] border border-line bg-surface/72 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <PanelBottom className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.9} />
                      <h3 className="text-sm font-medium text-ink">Dock behavior</h3>
                    </div>
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-muted">
                      Keep the dock always visible, or let it auto-hide and reappear when you move the pointer to the bottom.
                    </p>
                  </div>
                  <label className="inline-flex shrink-0 cursor-pointer items-center gap-3 rounded-full border border-line bg-panel px-3 py-2 text-sm text-ink transition hover:border-line-strong/40 hover:bg-surface">
                    <span className="text-xs uppercase tracking-[0.22em] text-muted">
                      {showDock ? "Visible" : "Auto-hide"}
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
            </div>
          </section>

          {error ? (
            <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-ink">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
