import type {
  AppID,
  DesktopApp,
  IconPositionMap,
  WallpaperPreset,
  WindowMap,
} from "./types";

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
    zIndex: 1,
  },
  terminal: {
    open: false,
    minimized: false,
    maximized: false,
    snapped: null,
    position: { x: 72, y: 136 },
    lastFloatingPosition: { x: 72, y: 136 },
    zIndex: 1,
  },
  remoteDesktop: {
    open: false,
    minimized: false,
    maximized: false,
    snapped: null,
    position: { x: 156, y: 84 },
    lastFloatingPosition: { x: 156, y: 84 },
    zIndex: 1,
  },
  settings: {
    open: false,
    minimized: false,
    maximized: false,
    snapped: null,
    position: { x: 128, y: 112 },
    lastFloatingPosition: { x: 128, y: 112 },
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
    overlay:
      "radial-gradient(circle at top left,rgba(125,211,252,0.18),transparent 24%),radial-gradient(circle at bottom right,rgba(16,185,129,0.14),transparent 28%),linear-gradient(180deg,rgba(8,12,22,0.82),rgba(4,6,10,0.98))",
  },
  {
    id: "dunes",
    label: "Dunes",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
    overlay:
      "linear-gradient(180deg,rgba(15,23,42,0.35),rgba(2,6,23,0.78))",
  },
  {
    id: "mountains",
    label: "Mountains",
    image:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
    overlay:
      "linear-gradient(180deg,rgba(3,7,18,0.30),rgba(2,6,23,0.76))",
  },
  {
    id: "sea",
    label: "Sea",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
    overlay:
      "linear-gradient(180deg,rgba(8,47,73,0.26),rgba(2,6,23,0.78))",
  },
];

export const initialWallpaper = {
  mode: "preset",
  presetId: DEFAULT_WALLPAPER,
  image: "",
  overlay:
    "radial-gradient(circle at top left,rgba(125,211,252,0.18),transparent 24%),radial-gradient(circle at bottom right,rgba(16,185,129,0.14),transparent 28%),linear-gradient(180deg,rgba(8,12,22,0.82),rgba(4,6,10,0.98))",
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
