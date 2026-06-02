import type {
  AppID,
  DesktopApp,
  IconPositionMap,
  WallpaperPreset,
  WallpaperPresetId,
  WindowMap,
} from "./types";
import type { ResolvedTheme } from "../../theme-config";

export const apps: DesktopApp[] = [
  { id: "chromium", label: "Chromium", available: true },
  { id: "terminal", label: "Terminal", available: true },
  { id: "remoteDesktop", label: "Remote Desktop", available: true },
  { id: "settings", label: "Settings", available: true },
];

export const initialWindows: WindowMap = {
  chromium: {
    open: false,
    minimized: false,
    maximized: false,
    snapped: null,
    position: { x: 24, y: 96 },
    lastFloatingPosition: { x: 24, y: 96 },
    size: { width: 980, height: 720 },
    lastFloatingSize: { width: 980, height: 720 },
    zIndex: 1,
  },
  terminal: {
    open: false,
    minimized: false,
    maximized: false,
    snapped: null,
    position: { x: 72, y: 136 },
    lastFloatingPosition: { x: 72, y: 136 },
    size: { width: 840, height: 560 },
    lastFloatingSize: { width: 840, height: 560 },
    zIndex: 1,
  },
  remoteDesktop: {
    open: false,
    minimized: false,
    maximized: false,
    snapped: null,
    position: { x: 156, y: 84 },
    lastFloatingPosition: { x: 156, y: 84 },
    size: { width: 960, height: 680 },
    lastFloatingSize: { width: 960, height: 680 },
    zIndex: 1,
  },
  settings: {
    open: false,
    minimized: false,
    maximized: false,
    snapped: null,
    position: { x: 128, y: 112 },
    lastFloatingPosition: { x: 128, y: 112 },
    size: { width: 760, height: 620 },
    lastFloatingSize: { width: 760, height: 620 },
    zIndex: 1,
  },
};

export const DEFAULT_WALLPAPER = "gradient";
export const CUSTOM_WALLPAPER_STORAGE_MARKER = "__portal_custom_wallpaper__";
export const DESKTOP_ICON_WIDTH = 88;
export const DESKTOP_ICON_HEIGHT = 110;
export const DESKTOP_ICON_MARGIN = 10;
export const DESKTOP_ICON_GAP_X = 16;
export const DESKTOP_ICON_GAP_Y = 6;

export const wallpaperPresets: WallpaperPreset[] = [
  {
    id: "gradient",
    label: "Aurora",
    image: "",
    overlay: {
      light:
        "radial-gradient(circle at top left,rgba(56,189,248,0.20),transparent 26%),radial-gradient(circle at bottom right,rgba(34,197,94,0.16),transparent 30%),linear-gradient(180deg,rgb(244,248,252) 0%,rgb(228,239,249) 58%,rgb(214,228,242) 100%)",
      dark:
        "radial-gradient(circle at top left,rgba(255,255,255,0.06),transparent 22%),radial-gradient(circle at bottom right,rgba(71,85,105,0.12),transparent 30%),linear-gradient(180deg,rgb(20,24,31) 0%,rgb(13,16,22) 52%,rgb(7,9,13) 100%)",
    },
  },
  {
    id: "dunes",
    label: "Dunes",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
    overlay: {
      light: "",
      dark: "",
    },
  },
  {
    id: "mountains",
    label: "Mountains",
    image:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
    overlay: {
      light: "",
      dark: "",
    },
  },
  {
    id: "sea",
    label: "Sea",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
    overlay: {
      light: "",
      dark: "",
    },
  },
];

export function getWallpaperPreset(presetId: WallpaperPresetId) {
  return wallpaperPresets.find((item) => item.id === presetId);
}

export function getWallpaperOverlay(
  presetId: WallpaperPresetId,
  resolvedTheme: ResolvedTheme,
) {
  const preset = getWallpaperPreset(presetId);
  return preset?.overlay[resolvedTheme] ?? wallpaperPresets[0].overlay[resolvedTheme];
}

export function getCustomWallpaperOverlay(resolvedTheme: ResolvedTheme) {
  return "";
}

export function buildWallpaperBackgroundImage(overlay: string, image: string) {
  if (!image) {
    return overlay;
  }

  return overlay ? `${overlay}, url("${image}")` : `url("${image}")`;
}

export const initialWallpaper = {
  mode: "preset",
  presetId: DEFAULT_WALLPAPER,
  image: "",
  overlay: wallpaperPresets[0].overlay.dark,
} as const;

export const initialDesktopIcons: IconPositionMap = {
  chromium: { x: DESKTOP_ICON_MARGIN, y: DESKTOP_ICON_MARGIN },
  terminal: { x: DESKTOP_ICON_MARGIN, y: DESKTOP_ICON_MARGIN + 116 },
  remoteDesktop: { x: DESKTOP_ICON_MARGIN, y: DESKTOP_ICON_MARGIN + 232 },
  settings: { x: DESKTOP_ICON_MARGIN, y: DESKTOP_ICON_MARGIN + 348 },
};

export function windowTitle(appId: AppID) {
  if (appId === "chromium") {
    return "Chromium";
  }
  if (appId === "terminal") {
    return "Terminal";
  }
  if (appId === "remoteDesktop") {
    return "Remote Desktop";
  }
  return "Settings";
}
