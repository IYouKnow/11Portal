import type {
  Overview,
  User,
  Workspace,
} from "../../lib/api";

export type DashboardProps = {
  user: User;
  overview: Overview;
  workspaces: Workspace[];
  users: User[];
  error: string | null;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
  onCreateUser: (
    email: string,
    password: string,
    role: User["role"],
  ) => Promise<void>;
};

export type AppID =
  | "chromium"
  | "terminal"
  | "remoteDesktop"
  | "networkScanner"
  | "notepad"
  | "shortcutManager"
  | "settings";

export type DesktopApp = {
  id: AppID;
  label: string;
  available: boolean;
};

export type ShortcutIconName =
  | "link"
  | "globe"
  | "folder"
  | "mail"
  | "code"
  | "image"
  | "play";

export type ShortcutKind =
  | "browser"
  | "terminal"
  | "remoteDesktop";

export type RemoteDesktopShortcutConfig = {
  profileId?: number;
  profileName?: string;
  host?: string;
  port?: number;
  domain?: string;
  ignoreCert?: boolean;
  sessionUsername: string;
  password: string;
};

export type ShortcutDefinition = {
  id: string;
  name: string;
  label: string;
  url: string;
  iconUrl: string;
  kind: ShortcutKind;
  remoteDesktop?: RemoteDesktopShortcutConfig;
  createdAt: string;
};

export type SnapMode =
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type WindowState = {
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  snapped: SnapMode | null;
  position: { x: number; y: number };
  lastFloatingPosition: { x: number; y: number };
  size: { width: number; height: number };
  lastFloatingSize: { width: number; height: number };
  zIndex: number;
};

export type WindowMap = Record<AppID, WindowState>;

export type WindowInstance = WindowState & {
  id: string;
  appId: AppID;
};

export type DragState = {
  windowId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
} | null;

export type ResizeDirection =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type ResizeState = {
  windowId: string;
  pointerId: number;
  direction: ResizeDirection;
  startX: number;
  startY: number;
  startPosition: { x: number; y: number };
  startSize: { width: number; height: number };
} | null;

export type IconPosition = {
  x: number;
  y: number;
};

export type IconPositionMap = Record<string, IconPosition>;

export type IconDragState = {
  appId: string;
  appIds: string[];
  pointerId: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
  initialPositions: IconPositionMap;
} | null;

export type DesktopSelectionState = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
} | null;

export type DesktopLaunchMode = "single" | "double";

export type WallpaperPreset = {
  id: string;
  label: string;
  image: string;
  overlay: {
    light: string;
    dark: string;
  };
};

export type WallpaperPresetId = "gradient" | "dunes" | "mountains" | "sea";

export type WallpaperState = {
  mode: "preset" | "custom";
  presetId: WallpaperPresetId;
  image: string;
  overlay: string;
};

export type NetworkScanItem = {
  ip: string;
  hostname: string;
  mac: string;
};

export type NetworkScanSummary = {
  scannedCidrs: string[];
  skippedCidrs: string[];
  totalIps: number;
};

export type NetworkScanResponse = {
  items: NetworkScanItem[];
  summary: NetworkScanSummary;
};
