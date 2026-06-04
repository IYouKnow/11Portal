import {
  type ChangeEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  closeBrowserRuntime,
  closeTerminalSession,
  listTerminalSessions,
} from "../lib/api";
import { NetworkScannerPanel } from "./NetworkScannerPanel";
import { NotepadPanel } from "./NotepadPanel";
import { ShortcutPanel } from "./ShortcutPanel";
import { RemoteDesktopPanel } from "./RemoteDesktopPanel";
import { TerminalPanel } from "./TerminalPanel";
import {
  apps,
  buildWallpaperBackgroundImage,
  CUSTOM_WALLPAPER_STORAGE_MARKER,
  DEFAULT_WALLPAPER,
  DESKTOP_ICON_HEIGHT,
  DESKTOP_ICON_WIDTH,
  getCustomWallpaperOverlay,
  getWallpaperOverlay,
  getWallpaperPreset,
  initialDesktopIcons,
  initialWallpaper,
  initialWindows,
} from "./dashboard/constants";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { DesktopSurface } from "./dashboard/DesktopSurface";
import {
  clampDesktopIconPosition,
  detectSnapMode,
  getSelectionBounds,
  getSnapBounds,
  normalizeDesktopIconPositions,
  rectanglesIntersect,
  snapDesktopIconGroup,
  translateDesktopIconGroup,
} from "./dashboard/desktopUtils";
import { SettingsPanel } from "./dashboard/SettingsPanel";
import { Taskbar } from "./dashboard/Taskbar";
import type {
  AppID,
  DashboardProps,
  DesktopLaunchMode,
  DesktopSelectionState,
  DragState,
  IconDragState,
  IconPositionMap,
  ResizeDirection,
  ResizeState,
  ShortcutDefinition,
  WallpaperPresetId,
  WallpaperState,
  WindowInstance,
} from "./dashboard/types";
import { WindowFrame } from "./dashboard/WindowFrame";
import {
  deleteWallpaperImage,
  readWallpaperImage,
  writeWallpaperImage,
} from "./dashboard/wallpaperStorage";
import { useTheme } from "../theme-context";

function createWindowInstanceId(appId: AppID) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${appId}-${crypto.randomUUID()}`;
  }

  return `${appId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createShortcutId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `shortcut-${crypto.randomUUID()}`;
  }

  return `shortcut-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function Dashboard({
  user,
  overview,
  workspaces,
  users,
  error,
  onRefresh,
  onLogout,
  onCreateUser,
}: DashboardProps) {
  const { resolvedTheme } = useTheme();
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");
  const [wallpaperError, setWallpaperError] = useState<string | null>(null);
  const [wallpaper, setWallpaper] = useState<WallpaperState>(initialWallpaper);
  const [draggingApp, setDraggingApp] = useState<AppID | null>(null);
  const [draggingDesktopIcon, setDraggingDesktopIcon] =
    useState<string | null>(null);
  const [desktopIcons, setDesktopIcons] =
    useState<IconPositionMap>(initialDesktopIcons);
  const [desktopIconsLoaded, setDesktopIconsLoaded] = useState(false);
  const [shortcuts, setShortcuts] = useState<ShortcutDefinition[]>([]);
  const [shortcutsLoaded, setShortcutsLoaded] = useState(false);
  const [desktopLaunchMode, setDesktopLaunchMode] =
    useState<DesktopLaunchMode>("double");
  const [showDock, setShowDock] = useState(true);
  const [dockPeekVisible, setDockPeekVisible] = useState(true);
  const [pendingTerminalLaunch, setPendingTerminalLaunch] = useState<{
    id: number;
    command: string;
  } | null>(null);
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);
  const [shortcutContextMenu, setShortcutContextMenu] = useState<{
    shortcutId: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedDesktopApps, setSelectedDesktopApps] = useState<string[]>([]);
  const [desktopSelection, setDesktopSelection] =
    useState<DesktopSelectionState>(null);
  const [snapPreview, setSnapPreview] = useState<
    ReturnType<typeof detectSnapMode>
  >(null);
  const dragStateRef = useRef<DragState>(null);
  const resizeStateRef = useRef<ResizeState>(null);
  const iconDragStateRef = useRef<IconDragState>(null);
  const suppressIconClickRef = useRef<string | null>(null);
  const shortcutContextMenuRef = useRef<HTMLDivElement | null>(null);
  const desktopIconsRef = useRef<IconPositionMap>(initialDesktopIcons);
  const desktopAreaRef = useRef<HTMLDivElement | null>(null);
  const nextZIndexRef = useRef(4);

  const activeWorkspace = useMemo(() => {
    return workspaces[0]?.name ?? "Primary Workspace";
  }, [workspaces]);
  const isAdmin = user.role === "admin";
  const chromiumSrc = overview.platform.chromiumURL || "/chromium/";
  const remoteDesktopGatewayURL =
    overview.platform.remoteDesktopGatewayURL?.trim() || "";
  const wallpaperStorageKey = `portal.wallpaper.${user.id}`;
  const desktopIconsStorageKey = `portal.desktop-icons.${user.id}`;
  const shortcutsStorageKey = `portal.shortcuts.${user.id}`;
  const desktopLaunchModeStorageKey = `portal.desktop-launch-mode.${user.id}`;
  const showDockStorageKey = `portal.show-dock.${user.id}`;
  const minWindowSize = {
    width: 420,
    height: 280,
  };

  const activeWindow = useMemo(
    () => windows.find((window) => window.id === activeWindowId) ?? null,
    [activeWindowId, windows],
  );
  const activeApp = activeWindow?.appId ?? null;
  const isDockVisible = showDock || dockPeekVisible;
  const desktopItemIds = useMemo(
    () => [
      ...apps
        .map((app) => app.id)
        .filter((appId) => appId !== "shortcutManager"),
      ...shortcuts.map((shortcut) => shortcut.id),
    ],
    [shortcuts],
  );
  const shortcutById = useMemo(() => {
    return new Map(shortcuts.map((shortcut) => [shortcut.id, shortcut] as const));
  }, [shortcuts]);
  const editingShortcut = useMemo(
    () => shortcuts.find((shortcut) => shortcut.id === editingShortcutId) ?? null,
    [editingShortcutId, shortcuts],
  );

  const createWindow = (appId: AppID): WindowInstance => {
    const template = initialWindows[appId];
    return {
      id: createWindowInstanceId(appId),
      appId,
      open: true,
      minimized: false,
      maximized: false,
      snapped: null,
      position: { ...template.position },
      lastFloatingPosition: { ...template.lastFloatingPosition },
      size: { ...template.size },
      lastFloatingSize: { ...template.lastFloatingSize },
      zIndex: nextZIndexRef.current++,
    };
  };

  const focusWindow = (windowId: string) => {
    setWindows((current) =>
      current.map((window) =>
        window.id === windowId
          ? {
              ...window,
              zIndex: nextZIndexRef.current++,
            }
          : window,
      ),
    );
    setActiveWindowId(windowId);
  };

  const getWindowsForApp = (appId: AppID) =>
    windows.filter((window) => window.appId === appId);

  const getTopWindowForApp = (appId: AppID) => {
    return [...getWindowsForApp(appId)].sort((left, right) => right.zIndex - left.zIndex)[0] ?? null;
  };

  const applyPresetWallpaper = (presetId: WallpaperPresetId) => {
    const preset = getWallpaperPreset(presetId);
    if (!preset) {
      return;
    }

    setWallpaper({
      mode: "preset",
      presetId,
      image: preset.image,
      overlay: preset.overlay[resolvedTheme],
    });
    setWallpaperError(null);
  };

  const applyCustomWallpaper = (image: string) => {
    const normalized = image.trim();
    if (!normalized) {
      setWallpaperError("Enter an image URL or choose a file first.");
      return;
    }

    setWallpaper({
      mode: "custom",
      presetId: DEFAULT_WALLPAPER,
      image: normalized,
      overlay: getCustomWallpaperOverlay(resolvedTheme),
    });
    setWallpaperError(null);
  };

  const isAppOpen = (appId: AppID) => getWindowsForApp(appId).length > 0;
  const isAppMinimized = (appId: AppID) => {
    const openWindows = getWindowsForApp(appId);
    return openWindows.length > 0 && openWindows.every((window) => window.minimized);
  };

  const openApp = (appId: AppID) => {
    const nextWindow = createWindow(appId);
    setWindows((current) => [...current, nextWindow]);
    setActiveWindowId(nextWindow.id);
  };

  const ensureAppVisible = (appId: AppID) => {
    const topWindow = getTopWindowForApp(appId);
    if (!topWindow) {
      openApp(appId);
      return;
    }

    if (topWindow.minimized) {
      restoreWindow(topWindow.id);
      return;
    }

    focusWindow(topWindow.id);
  };

  const normalizeShortcutUrl = (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      return "";
    }

    try {
      return new URL(trimmed).toString();
    } catch {
      try {
        return new URL(`https://${trimmed}`).toString();
      } catch {
        return "";
      }
    }
  };

  const normalizeIconUrl = (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      return "";
    }

    try {
      return new URL(trimmed).toString();
    } catch {
      return "";
    }
  };

  const normalizeShortcutCommand = (rawCommand: string) => rawCommand.trim();

  const openShortcut = async (shortcutId: string) => {
    const shortcut = shortcutById.get(shortcutId);
    if (!shortcut) {
      return;
    }

    if (shortcut.kind === "terminal") {
      const command = normalizeShortcutCommand(shortcut.url);
      if (!command) {
        return;
      }

      setPendingTerminalLaunch({
        id: Date.now(),
        command,
      });
      ensureAppVisible("terminal");
      return;
    }

    const normalizedUrl = normalizeShortcutUrl(shortcut.url);
    if (normalizedUrl) {
      window.open(normalizedUrl, "_blank", "noreferrer");
    }
  };

  const openShortcutEditor = (shortcutId: string) => {
    setEditingShortcutId(shortcutId);
    setShortcutContextMenu(null);
    ensureAppVisible("shortcutManager");
  };

  const deleteShortcut = (shortcutId: string) => {
    setShortcuts((current) => current.filter((shortcut) => shortcut.id !== shortcutId));
    setSelectedDesktopApps((current) => current.filter((id) => id !== shortcutId));
    setShortcutContextMenu(null);

    setEditingShortcutId((current) => (current === shortcutId ? null : current));
  };

  const placeNewShortcut = (shortcutId: string) => {
    const desktopBounds = desktopAreaRef.current?.getBoundingClientRect();
    if (!desktopBounds) {
      return;
    }

    const fallbackPosition = {
      x: initialDesktopIcons.settings.x,
      y: initialDesktopIcons.settings.y,
    };

    setDesktopIcons((current) =>
      normalizeDesktopIconPositions(
        {
          ...current,
          [shortcutId]: fallbackPosition,
        },
        desktopBounds,
        shortcutId,
      ),
    );
  };

  const restoreWindow = (windowId: string) => {
    setWindows((current) =>
      current.map((window) =>
        window.id === windowId
          ? {
              ...window,
              minimized: false,
              zIndex: nextZIndexRef.current++,
            }
          : window,
      ),
    );
    setActiveWindowId(windowId);
  };

  const minimizeWindow = (windowId: string) => {
    setWindows((current) =>
      current.map((window) =>
        window.id === windowId
          ? {
              ...window,
              minimized: true,
            }
          : window,
      ),
    );
    setActiveWindowId((current) => (current === windowId ? null : current));
  };

  const closeWindow = async (windowId: string) => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    try {
      const targetWindow = windows.find((window) => window.id === windowId);
      if (!targetWindow) {
        return;
      }

      const remainingWindows = windows.filter((window) => window.id !== windowId);
      const remainingWindowsForApp = remainingWindows.filter(
        (window) => window.appId === targetWindow.appId,
      );

      if (targetWindow.appId === "chromium" && remainingWindowsForApp.length === 0) {
        await closeBrowserRuntime();
      }

      if (targetWindow.appId === "terminal" && remainingWindowsForApp.length === 0) {
        const { items } = await listTerminalSessions();
        await Promise.allSettled(
          items.map((session) => closeTerminalSession(session.id)),
        );
      }

      setWindows(remainingWindows);
      setActiveWindowId((current) => {
        if (current !== windowId) {
          return current;
        }

        const nextActive = [...remainingWindows]
          .sort((left, right) => right.zIndex - left.zIndex)
          [0];

        return nextActive?.id ?? null;
      });
    } finally {
      setIsBusy(false);
    }
  };

  const toggleApp = async (appId: AppID) => {
    if (isBusy) {
      return;
    }

    const topWindow = getTopWindowForApp(appId);
    if (!topWindow) {
      openApp(appId);
      return;
    }

    if (topWindow.minimized) {
      restoreWindow(topWindow.id);
      return;
    }

    if (activeWindowId === topWindow.id) {
      minimizeWindow(topWindow.id);
      return;
    }

    focusWindow(topWindow.id);
  };

  const launchApp = (appId: AppID) => {
    openApp(appId);
  };

  const toggleMaximize = (windowId: string) => {
    const targetWindow = windows.find((window) => window.id === windowId);
    if (!targetWindow) {
      return;
    }

    setWindows((current) => {
      return current.map((window) => {
        if (window.id !== windowId) {
          return window;
        }

        if (window.maximized) {
          return {
            ...window,
            maximized: false,
            snapped: null,
            position: window.lastFloatingPosition,
          };
        }

        return {
          ...window,
          maximized: true,
          snapped: null,
          lastFloatingPosition: window.position,
        };
      });
    });
    focusWindow(windowId);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    const loadWallpaper = async () => {
      const raw = window.localStorage.getItem(wallpaperStorageKey);
        if (!raw) {
          if (!cancelled) {
            applyPresetWallpaper(DEFAULT_WALLPAPER);
        }
        return;
      }

      try {
        const parsed = JSON.parse(raw) as Partial<WallpaperState>;
        if (parsed.mode === "custom" && parsed.image) {
          const storedImage =
            parsed.image === CUSTOM_WALLPAPER_STORAGE_MARKER
              ? await readWallpaperImage(wallpaperStorageKey)
              : parsed.image;

          if (storedImage && !cancelled) {
            setWallpaper({
              mode: "custom",
              presetId: DEFAULT_WALLPAPER,
              image: storedImage,
              overlay: getCustomWallpaperOverlay(resolvedTheme),
            });
            return;
          }
        }

        if (parsed.presetId) {
          const preset = getWallpaperPreset(parsed.presetId as WallpaperPresetId);
          if (preset && !cancelled) {
            setWallpaper({
              mode: "preset",
              presetId: preset.id as WallpaperPresetId,
              image: preset.image,
              overlay: preset.overlay[resolvedTheme],
            });
            return;
          }
        }
      } catch {
        // Ignore invalid local storage and fall back to default wallpaper.
      }

      if (!cancelled) {
        applyPresetWallpaper(DEFAULT_WALLPAPER);
      }
    };

    void loadWallpaper();

    return () => {
      cancelled = true;
    };
  }, [resolvedTheme, wallpaperStorageKey]);

  useEffect(() => {
    setWallpaper((current) => {
      if (current.mode === "custom") {
        const nextOverlay = getCustomWallpaperOverlay(resolvedTheme);
        return current.overlay === nextOverlay
          ? current
          : {
              ...current,
              overlay: nextOverlay,
            };
      }

      const nextOverlay = getWallpaperOverlay(current.presetId, resolvedTheme);
      return current.overlay === nextOverlay
        ? current
        : {
            ...current,
            overlay: nextOverlay,
          };
    });
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(desktopIconsStorageKey);
    if (!raw) {
      setDesktopIcons(initialDesktopIcons);
      setDesktopIconsLoaded(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<
        Record<AppID, Partial<{ x: number; y: number }>>
      >;

      setDesktopIcons({
        chromium: {
          x:
            typeof parsed.chromium?.x === "number"
              ? parsed.chromium.x
              : initialDesktopIcons.chromium.x,
          y:
            typeof parsed.chromium?.y === "number"
              ? parsed.chromium.y
              : initialDesktopIcons.chromium.y,
        },
        terminal: {
          x:
            typeof parsed.terminal?.x === "number"
              ? parsed.terminal.x
              : initialDesktopIcons.terminal.x,
          y:
            typeof parsed.terminal?.y === "number"
              ? parsed.terminal.y
              : initialDesktopIcons.terminal.y,
        },
        remoteDesktop: {
          x:
            typeof parsed.remoteDesktop?.x === "number"
              ? parsed.remoteDesktop.x
              : initialDesktopIcons.remoteDesktop.x,
          y:
            typeof parsed.remoteDesktop?.y === "number"
              ? parsed.remoteDesktop.y
              : initialDesktopIcons.remoteDesktop.y,
        },
        networkScanner: {
          x:
            typeof parsed.networkScanner?.x === "number"
              ? parsed.networkScanner.x
              : initialDesktopIcons.networkScanner.x,
          y:
            typeof parsed.networkScanner?.y === "number"
              ? parsed.networkScanner.y
              : initialDesktopIcons.networkScanner.y,
        },
        notepad: {
          x:
            typeof parsed.notepad?.x === "number"
              ? parsed.notepad.x
              : initialDesktopIcons.notepad.x,
          y:
            typeof parsed.notepad?.y === "number"
              ? parsed.notepad.y
              : initialDesktopIcons.notepad.y,
        },
        settings: {
          x:
            typeof parsed.settings?.x === "number"
              ? parsed.settings.x
              : initialDesktopIcons.settings.x,
          y:
            typeof parsed.settings?.y === "number"
              ? parsed.settings.y
              : initialDesktopIcons.settings.y,
        },
      });
    } catch {
      setDesktopIcons(initialDesktopIcons);
    }

    setDesktopIconsLoaded(true);
  }, [desktopIconsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(shortcutsStorageKey);
    if (!raw) {
      setShortcuts([]);
      setShortcutsLoaded(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<ShortcutDefinition>[];
      const nextShortcuts = parsed
        .map((shortcut) => {
          if (
            typeof shortcut?.id !== "string" ||
            typeof shortcut?.label !== "string" ||
            typeof shortcut?.url !== "string" ||
            typeof shortcut?.createdAt !== "string"
          ) {
            return null;
          }

          return {
            ...shortcut,
            kind: shortcut.kind === "terminal" ? "terminal" : "browser",
            name:
              typeof shortcut.name === "string" && shortcut.name.trim()
                ? shortcut.name
                : shortcut.label,
            iconUrl:
              typeof shortcut.iconUrl === "string"
                ? normalizeIconUrl(shortcut.iconUrl)
                : "",
          } as ShortcutDefinition;
        })
        .filter((shortcut): shortcut is ShortcutDefinition => shortcut !== null);

      setShortcuts(nextShortcuts);
    } catch {
      setShortcuts([]);
    }

    setShortcutsLoaded(true);
  }, [shortcutsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(desktopLaunchModeStorageKey);
    if (raw === "single" || raw === "double") {
      setDesktopLaunchMode(raw);
      return;
    }

    setDesktopLaunchMode("double");
  }, [desktopLaunchModeStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(showDockStorageKey);
    if (raw === "false") {
      setShowDock(false);
      setDockPeekVisible(false);
      return;
    }

    setShowDock(true);
    setDockPeekVisible(true);
  }, [showDockStorageKey]);

  useEffect(() => {
    if (showDock) {
      setDockPeekVisible(true);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    let hideTimeout: number | null = null;
    const revealThreshold = 28;

    const hideDock = () => {
      if (hideTimeout !== null) {
        window.clearTimeout(hideTimeout);
      }
      hideTimeout = window.setTimeout(() => {
        setDockPeekVisible(false);
      }, 120);
    };

    const revealDock = () => {
      if (hideTimeout !== null) {
        window.clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      setDockPeekVisible(true);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const viewportHeight = window.innerHeight;
      const distanceFromBottom = viewportHeight - event.clientY;

      if (distanceFromBottom <= revealThreshold) {
        revealDock();
        return;
      }

      hideDock();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerdown", handlePointerMove);

    return () => {
      if (hideTimeout !== null) {
        window.clearTimeout(hideTimeout);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerMove);
    };
  }, [showDock]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        shortcutContextMenuRef.current?.contains(target)
      ) {
        return;
      }

      setShortcutContextMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShortcutContextMenu(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      const resizeState = resizeStateRef.current;
      if (resizeState && resizeState.pointerId === event.pointerId) {
        if ((event.buttons & 1) !== 1) {
          resizeStateRef.current = null;
          return;
        }

        const deltaX = event.clientX - resizeState.startX;
        const deltaY = event.clientY - resizeState.startY;

        setWindows((current) => {
          const targetWindow = current.find((window) => window.id === resizeState.windowId);
          if (!targetWindow) {
            return current;
          }
          if (targetWindow.maximized || targetWindow.snapped) {
            return current;
          }

          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          let nextX = resizeState.startPosition.x;
          let nextY = resizeState.startPosition.y;
          let nextWidth = resizeState.startSize.width;
          let nextHeight = resizeState.startSize.height;

          if (
            resizeState.direction === "right" ||
            resizeState.direction === "top-right" ||
            resizeState.direction === "bottom-right"
          ) {
            nextWidth = Math.min(
              Math.max(minWindowSize.width, resizeState.startSize.width + deltaX),
              viewportWidth - resizeState.startPosition.x,
            );
          }

          if (
            resizeState.direction === "bottom" ||
            resizeState.direction === "bottom-left" ||
            resizeState.direction === "bottom-right"
          ) {
            nextHeight = Math.min(
              Math.max(minWindowSize.height, resizeState.startSize.height + deltaY),
              viewportHeight - resizeState.startPosition.y,
            );
          }

          if (
            resizeState.direction === "left" ||
            resizeState.direction === "top-left" ||
            resizeState.direction === "bottom-left"
          ) {
            const maxLeft = resizeState.startPosition.x + resizeState.startSize.width - minWindowSize.width;
            nextX = Math.max(0, Math.min(resizeState.startPosition.x + deltaX, maxLeft));
            nextWidth = resizeState.startSize.width + (resizeState.startPosition.x - nextX);
          }

          if (
            resizeState.direction === "top" ||
            resizeState.direction === "top-left" ||
            resizeState.direction === "top-right"
          ) {
            const maxTop = resizeState.startPosition.y + resizeState.startSize.height - minWindowSize.height;
            nextY = Math.max(0, Math.min(resizeState.startPosition.y + deltaY, maxTop));
            nextHeight = resizeState.startSize.height + (resizeState.startPosition.y - nextY);
          }
          return current.map((window) =>
            window.id === resizeState.windowId
              ? {
                  ...window,
                  position: { x: nextX, y: nextY },
                  size: { width: nextWidth, height: nextHeight },
                  lastFloatingPosition: { x: nextX, y: nextY },
                  lastFloatingSize: { width: nextWidth, height: nextHeight },
                }
              : window,
          );
        });
        return;
      }

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      if ((event.buttons & 1) !== 1) {
        dragStateRef.current = null;
        setDraggingApp(null);
        setSnapPreview(null);
        return;
      }

      setSnapPreview(detectSnapMode(event.clientX, event.clientY));

      setWindows((current) => {
        const targetWindow = current.find((window) => window.id === dragState.windowId);
        if (!targetWindow) {
          return current;
        }
        if (targetWindow.maximized || targetWindow.snapped) {
          return current;
        }

        const width = targetWindow.size.width;
        const nextX = event.clientX - dragState.offsetX;
        const nextY = event.clientY - dragState.offsetY;

        return current.map((windowInstance) =>
          windowInstance.id === dragState.windowId
            ? {
                ...windowInstance,
                position: {
                  x: Math.max(-width + 120, Math.min(nextX, window.innerWidth - 120)),
                  y: Math.max(0, Math.min(nextY, window.innerHeight - 48)),
                },
              }
            : windowInstance,
        );
      });
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;
      if (resizeState && resizeState.pointerId === event.pointerId) {
        resizeStateRef.current = null;
        return;
      }

      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      dragStateRef.current = null;
      setDraggingApp(null);
      setWindows((current) => {
        const activePreview = detectSnapMode(event.clientX, event.clientY);

        if (activePreview === "maximize") {
          return current.map((window) =>
            window.id === dragState.windowId
              ? {
                  ...window,
                  maximized: true,
                  snapped: null,
                  lastFloatingPosition: window.position,
                }
              : window,
          );
        }

        if (activePreview) {
          return current.map((window) =>
            window.id === dragState.windowId
              ? {
                  ...window,
                  maximized: false,
                  snapped: activePreview,
                  lastFloatingPosition: window.position,
                }
              : window,
          );
        }

        return current.map((window) =>
          window.id === dragState.windowId
            ? {
                ...window,
                maximized: false,
                snapped: null,
                lastFloatingPosition: window.position,
              }
            : window,
        );
      });
      setSnapPreview(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, []);

  useEffect(() => {
    const clampWindowsToViewport = () => {
      setWindows((current) => {
        let changed = false;
        const nextWindows = current.map((windowInstance) => {
          if (windowInstance.maximized || windowInstance.snapped) {
            return windowInstance;
          }

          const nextWidth = Math.min(
            Math.max(windowInstance.size.width, minWindowSize.width),
            window.innerWidth,
          );
          const nextHeight = Math.min(
            Math.max(windowInstance.size.height, minWindowSize.height),
            window.innerHeight,
          );
          const nextX = Math.max(
            0,
            Math.min(windowInstance.position.x, window.innerWidth - nextWidth),
          );
          const nextY = Math.max(
            0,
            Math.min(windowInstance.position.y, window.innerHeight - nextHeight),
          );

          if (
            nextWidth !== windowInstance.size.width ||
            nextHeight !== windowInstance.size.height ||
            nextX !== windowInstance.position.x ||
            nextY !== windowInstance.position.y
          ) {
            changed = true;
            return {
              ...windowInstance,
              position: { x: nextX, y: nextY },
              lastFloatingPosition: { x: nextX, y: nextY },
              size: { width: nextWidth, height: nextHeight },
              lastFloatingSize: { width: nextWidth, height: nextHeight },
            };
          }

          return windowInstance;
        });

        return changed ? nextWindows : current;
      });
    };

    clampWindowsToViewport();
    window.addEventListener("resize", clampWindowsToViewport);

    return () => {
      window.removeEventListener("resize", clampWindowsToViewport);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !desktopIconsLoaded) {
      return;
    }

    window.localStorage.setItem(
      desktopIconsStorageKey,
      JSON.stringify(desktopIcons),
    );
  }, [desktopIcons, desktopIconsLoaded, desktopIconsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !shortcutsLoaded) {
      return;
    }

    window.localStorage.setItem(shortcutsStorageKey, JSON.stringify(shortcuts));
  }, [shortcuts, shortcutsLoaded, shortcutsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(desktopLaunchModeStorageKey, desktopLaunchMode);
  }, [desktopLaunchMode, desktopLaunchModeStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(showDockStorageKey, String(showDock));
  }, [showDock, showDockStorageKey]);

  useEffect(() => {
    desktopIconsRef.current = desktopIcons;
  }, [desktopIcons]);

  useEffect(() => {
    const clampIconsToDesktop = () => {
      const desktopBounds = desktopAreaRef.current?.getBoundingClientRect();
      if (!desktopBounds) {
        return;
      }

      setDesktopIcons((current) =>
        normalizeDesktopIconPositions(current, desktopBounds),
      );
    };

    clampIconsToDesktop();
    window.addEventListener("resize", clampIconsToDesktop);

    return () => {
      window.removeEventListener("resize", clampIconsToDesktop);
    };
  }, []);

  useEffect(() => {
    if (!desktopIconsLoaded || !shortcutsLoaded) {
      return;
    }

    const desktopBounds = desktopAreaRef.current?.getBoundingClientRect();
    if (!desktopBounds) {
      return;
    }

    setDesktopIcons((current) => {
      const nextIcons = { ...current };

      for (const shortcut of shortcuts) {
        if (!nextIcons[shortcut.id]) {
          nextIcons[shortcut.id] = {
            x: initialDesktopIcons.settings.x,
            y: initialDesktopIcons.settings.y,
          };
        }
      }

      return normalizeDesktopIconPositions(nextIcons, desktopBounds);
    });
  }, [desktopIconsLoaded, shortcuts, shortcutsLoaded]);

  useEffect(() => {
    const handleIconPointerMove = (event: PointerEvent) => {
      const dragState = iconDragStateRef.current;
      const desktopBounds = desktopAreaRef.current?.getBoundingClientRect();
      if (!dragState || dragState.pointerId !== event.pointerId || !desktopBounds) {
        return;
      }

      if ((event.buttons & 1) !== 1) {
        iconDragStateRef.current = null;
        setDraggingDesktopIcon(null);
        return;
      }

      const nextPosition = clampDesktopIconPosition(
        {
          x: event.clientX - desktopBounds.left - dragState.offsetX,
          y: event.clientY - desktopBounds.top - dragState.offsetY,
        },
        desktopBounds,
      );
      const draggedAppIds = dragState.appIds;
      const anchorInitialPosition = dragState.initialPositions[dragState.appId];
      const deltaX = nextPosition.x - anchorInitialPosition.x;
      const deltaY = nextPosition.y - anchorInitialPosition.y;

      const currentPosition = desktopIconsRef.current[dragState.appId];
      if (
        !dragState.moved &&
        (Math.abs(nextPosition.x - currentPosition.x) > 4 ||
          Math.abs(nextPosition.y - currentPosition.y) > 4)
      ) {
        dragState.moved = true;
      }

      setDesktopIcons(
        translateDesktopIconGroup(
          dragState.initialPositions,
          draggedAppIds,
          deltaX,
          deltaY,
          desktopBounds,
        ),
      );
    };

    const handleIconPointerEnd = (event: PointerEvent) => {
      const dragState = iconDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      iconDragStateRef.current = null;
      setDraggingDesktopIcon(null);

      if (dragState.moved) {
        const desktopBounds = desktopAreaRef.current?.getBoundingClientRect();
        if (desktopBounds) {
          setDesktopIcons((current) =>
            dragState.appIds.length > 1
              ? snapDesktopIconGroup(current, desktopBounds, dragState.appIds)
              : normalizeDesktopIconPositions(
                  current,
                  desktopBounds,
                  dragState.appId,
                ),
          );
        }

        suppressIconClickRef.current = dragState.appId;
        window.setTimeout(() => {
          if (suppressIconClickRef.current === dragState.appId) {
            suppressIconClickRef.current = null;
          }
        }, 0);
      }
    };

    window.addEventListener("pointermove", handleIconPointerMove);
    window.addEventListener("pointerup", handleIconPointerEnd);
    window.addEventListener("pointercancel", handleIconPointerEnd);

    return () => {
      window.removeEventListener("pointermove", handleIconPointerMove);
      window.removeEventListener("pointerup", handleIconPointerEnd);
      window.removeEventListener("pointercancel", handleIconPointerEnd);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    const persistWallpaper = async () => {
      try {
        if (wallpaper.mode === "custom" && wallpaper.image.startsWith("data:")) {
          await writeWallpaperImage(wallpaperStorageKey, wallpaper.image);
          window.localStorage.setItem(
            wallpaperStorageKey,
            JSON.stringify({
              ...wallpaper,
              image: CUSTOM_WALLPAPER_STORAGE_MARKER,
            }),
          );
        } else {
          await deleteWallpaperImage(wallpaperStorageKey);
          window.localStorage.setItem(
            wallpaperStorageKey,
            JSON.stringify(wallpaper),
          );
        }

        if (!cancelled) {
          setWallpaperError(null);
        }
      } catch {
        if (!cancelled) {
          setWallpaperError(
            "Wallpaper could not be saved locally. Try a smaller image.",
          );
        }
      }
    };

    void persistWallpaper();

    return () => {
      cancelled = true;
    };
  }, [wallpaper, wallpaperStorageKey]);

  const startDragging = (
    windowId: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    focusWindow(windowId);

    const appWindow = windows.find((window) => window.id === windowId);
    if (!appWindow) {
      return;
    }
    let nextPosition = appWindow.position;
    let offsetX = event.clientX - appWindow.position.x;
    let offsetY = event.clientY - appWindow.position.y;

    if (appWindow.maximized || appWindow.snapped) {
      const restoredWidth = Math.min(
        appWindow.lastFloatingSize.width,
        window.innerWidth,
      );
      const restoredHeight = Math.min(
        appWindow.lastFloatingSize.height,
        window.innerHeight,
      );
      const currentBounds = appWindow.maximized
        ? getSnapBounds("maximize")
        : getSnapBounds(appWindow.snapped ?? "left");
      const pointerRatio =
        currentBounds.width > 0
          ? (event.clientX - currentBounds.left) / currentBounds.width
          : 0.5;
      const pointerVerticalRatio =
        currentBounds.height > 0
          ? (event.clientY - currentBounds.top) / currentBounds.height
          : 0.1;
      const anchorX = Math.max(
        28,
        Math.min(restoredWidth - 28, restoredWidth * pointerRatio),
      );
      const anchorY = Math.max(
        16,
        Math.min(restoredHeight - 16, restoredHeight * pointerVerticalRatio),
      );

      nextPosition = {
        x: Math.max(
          0,
          Math.min(event.clientX - anchorX, window.innerWidth - restoredWidth),
        ),
        y: Math.max(0, Math.min(event.clientY - anchorY, window.innerHeight - restoredHeight)),
      };

      setWindows((current) =>
        current.map((window) =>
          window.id === windowId
            ? {
                ...window,
                maximized: false,
                snapped: null,
                position: nextPosition,
                lastFloatingPosition: nextPosition,
                size: {
                  width: restoredWidth,
                  height: restoredHeight,
                },
              }
            : window,
        ),
      );

      offsetX = event.clientX - nextPosition.x;
      offsetY = event.clientY - nextPosition.y;
    }

    dragStateRef.current = {
      windowId,
      pointerId: event.pointerId,
      offsetX,
      offsetY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingApp(appWindow.appId);
    setSnapPreview(detectSnapMode(event.clientX, event.clientY));
  };

  const startResizing = (
    windowId: string,
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    focusWindow(windowId);

    const appWindow = windows.find((window) => window.id === windowId);
    if (!appWindow) {
      return;
    }
    if (appWindow.maximized || appWindow.snapped) {
      return;
    }

    resizeStateRef.current = {
      windowId,
      pointerId: event.pointerId,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startPosition: appWindow.position,
      startSize: appWindow.size,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const stopWindowControlPointer = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
  };

  const stopWindowControlMouse = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreatingUser(true);

    try {
      await onCreateUser(newUserEmail, newUserPassword, newUserRole);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("user");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleCreateShortcut = (payload: {
    shortcutId: string | null;
    name: string;
    kind: "browser" | "terminal";
    url: string;
    iconUrl: string;
  }) => {
    const shortcutValue =
      payload.kind === "terminal"
        ? normalizeShortcutCommand(payload.url)
        : normalizeShortcutUrl(payload.url);
    if (!shortcutValue) {
      return;
    }

    const normalizedIconUrl = normalizeIconUrl(payload.iconUrl);
    const trimmedName = payload.name.trim();

    if (payload.shortcutId) {
      setShortcuts((current) =>
        current.map((shortcut) =>
          shortcut.id === payload.shortcutId
            ? {
                ...shortcut,
                name: trimmedName,
                label: trimmedName,
                url: shortcutValue,
                iconUrl: normalizedIconUrl,
                kind: payload.kind,
              }
            : shortcut,
        ),
      );
      setEditingShortcutId(null);
      setShortcutContextMenu(null);
      return;
    }

    const nextShortcut: ShortcutDefinition = {
      id: createShortcutId(),
      name: trimmedName,
      label: trimmedName,
      url: shortcutValue,
      iconUrl: normalizedIconUrl,
      kind: payload.kind,
      createdAt: new Date().toISOString(),
    };

    setShortcuts((current) => [...current, nextShortcut]);
    placeNewShortcut(nextShortcut.id);
  };

  const handleWallpaperUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setWallpaperError("That file could not be read as an image.");
        return;
      }

      applyCustomWallpaper(reader.result);
    };
    reader.onerror = () => {
      setWallpaperError("That file could not be loaded.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleDesktopPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }

    const desktopBounds = desktopAreaRef.current?.getBoundingClientRect();
    if (!desktopBounds) {
      return;
    }

    const startX = event.clientX - desktopBounds.left;
    const startY = event.clientY - desktopBounds.top;

    setSelectedDesktopApps([]);
    setDesktopSelection({
      pointerId: event.pointerId,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDesktopPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!desktopSelection || desktopSelection.pointerId !== event.pointerId) {
      return;
    }

    const desktopBounds = desktopAreaRef.current?.getBoundingClientRect();
    if (!desktopBounds) {
      return;
    }

    const nextSelection = {
      ...desktopSelection,
      currentX: Math.max(
        0,
        Math.min(event.clientX - desktopBounds.left, desktopBounds.width),
      ),
      currentY: Math.max(
        0,
        Math.min(event.clientY - desktopBounds.top, desktopBounds.height),
      ),
    };

    setDesktopSelection(nextSelection);

    const selectionBounds = getSelectionBounds(nextSelection);
    const selectedApps = desktopItemIds.filter((itemId) =>
      rectanglesIntersect(selectionBounds, {
        left: desktopIconsRef.current[itemId].x,
        top: desktopIconsRef.current[itemId].y,
        width: DESKTOP_ICON_WIDTH,
        height: DESKTOP_ICON_HEIGHT,
      }),
    );

    setSelectedDesktopApps(selectedApps);
  };

  const handleDesktopPointerEnd = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!desktopSelection || desktopSelection.pointerId !== event.pointerId) {
      return;
    }

    setDesktopSelection(null);
  };

  const startDesktopIconDrag = (
    appId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const desktopBounds = desktopAreaRef.current?.getBoundingClientRect();
    if (!desktopBounds) {
      return;
    }

    const position = desktopIconsRef.current[appId];
    const draggedAppIds =
      selectedDesktopApps.includes(appId) && selectedDesktopApps.length > 0
        ? selectedDesktopApps
        : [appId];

    if (!selectedDesktopApps.includes(appId) || selectedDesktopApps.length === 0) {
      setSelectedDesktopApps([appId]);
    }

    iconDragStateRef.current = {
      appId,
      appIds: draggedAppIds,
      pointerId: event.pointerId,
      offsetX: event.clientX - desktopBounds.left - position.x,
      offsetY: event.clientY - desktopBounds.top - position.y,
      moved: false,
      initialPositions: { ...desktopIconsRef.current },
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingDesktopIcon(appId);
  };

  const launchDesktopItem = async (itemId: string) => {
    if (shortcutById.has(itemId)) {
      await openShortcut(itemId);
      return;
    }

    launchApp(itemId as AppID);
  };

  const handleDesktopItemClick = async (itemId: string) => {
    if (suppressIconClickRef.current === itemId) {
      suppressIconClickRef.current = null;
      return;
    }

    setSelectedDesktopApps([itemId]);
    if (desktopLaunchMode !== "single") {
      return;
    }

    await launchDesktopItem(itemId);
  };

  const handleDesktopItemDoubleClick = async (itemId: string) => {
    if (suppressIconClickRef.current === itemId) {
      suppressIconClickRef.current = null;
      return;
    }

    setSelectedDesktopApps([itemId]);
    await launchDesktopItem(itemId);
  };

  const handleDesktopIconClick = handleDesktopItemClick;
  const handleDesktopIconDoubleClick = handleDesktopItemDoubleClick;

  const renderWindowContent = (windowInstance: WindowInstance) => {
    const { appId } = windowInstance;

    if (appId === "chromium") {
      return (
        <iframe
          key={windowInstance.id}
          className={`h-full w-full border-0 bg-canvas ${
            draggingApp === "chromium" ? "pointer-events-none" : ""
          }`}
          loading="lazy"
          src={chromiumSrc}
          title="Nortem Portal Chromium"
        />
      );
    }

    if (appId === "terminal") {
      return (
        <TerminalPanel
          active={activeWindowId === windowInstance.id && !windowInstance.minimized}
          launchRequest={pendingTerminalLaunch}
          onLaunchHandled={() => setPendingTerminalLaunch(null)}
        />
      );
    }

    if (appId === "remoteDesktop") {
      return (
        <RemoteDesktopPanel
          enabled={overview.platform.remoteDesktopEnabled}
          gatewayURL={remoteDesktopGatewayURL}
        />
      );
    }

    if (appId === "networkScanner") {
      return <NetworkScannerPanel />;
    }

    if (appId === "notepad") {
      return <NotepadPanel storageKey={`portal.notepad.${user.id}`} />;
    }

    if (appId === "shortcutManager") {
      return (
        <ShortcutPanel
          editingShortcut={editingShortcut}
          onCancelEdit={() => setEditingShortcutId(null)}
          onSaveShortcut={handleCreateShortcut}
        />
      );
    }

    return (
      <SettingsPanel
        desktopLaunchMode={desktopLaunchMode}
        error={error}
        onApplyPresetWallpaper={applyPresetWallpaper}
        onDesktopLaunchModeChange={setDesktopLaunchMode}
        onShowDockChange={setShowDock}
        onWallpaperUpload={handleWallpaperUpload}
        showDock={showDock}
        user={user}
        wallpaper={wallpaper}
        wallpaperError={wallpaperError}
      />
    );
  };

  const visibleWindows = [...windows]
    .filter((windowInstance) => !windowInstance.minimized)
    .sort((left, right) => left.zIndex - right.zIndex);
  const showDesktopGrid =
    wallpaper.mode === "preset" && wallpaper.presetId === DEFAULT_WALLPAPER;
  const showTopGlow = showDesktopGrid;

  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas text-ink">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: buildWallpaperBackgroundImage(
            wallpaper.overlay,
            wallpaper.image,
          ),
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />
      {showDesktopGrid ? (
        <div className="absolute inset-0 bg-portal-grid bg-[length:52px_52px] opacity-[0.14]" />
      ) : null}
      {showTopGlow ? (
        <div
          className="absolute inset-x-0 top-0 h-40"
          style={{ background: "var(--app-top-glow)" }}
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56"
        style={{ background: "var(--app-bottom-vignette)" }}
      />

      <div className="relative flex min-h-screen flex-col">
        <DashboardHeader
          activeWorkspace={activeWorkspace}
          isAdmin={isAdmin}
          onLogout={() => void onLogout()}
          onRefresh={() => void onRefresh()}
          user={user}
        />

        <div className={`relative flex flex-1 flex-col pt-3 ${showDock ? "pb-24" : "pb-6"}`}>
          <DesktopSurface
            desktopAreaRef={desktopAreaRef}
            desktopIcons={desktopIcons}
            desktopLaunchMode={desktopLaunchMode}
            desktopSelection={desktopSelection}
            draggingDesktopIcon={draggingDesktopIcon}
            resolvedTheme={resolvedTheme}
            shortcuts={shortcuts}
            useLightLabels={!showDesktopGrid}
            onDesktopIconClick={handleDesktopIconClick}
            onDesktopIconDoubleClick={handleDesktopIconDoubleClick}
            onDesktopPointerDown={handleDesktopPointerDown}
            onDesktopPointerEnd={handleDesktopPointerEnd}
            onDesktopPointerMove={handleDesktopPointerMove}
            onStartDesktopIconDrag={startDesktopIconDrag}
            onShortcutClick={handleDesktopItemClick}
            onShortcutDoubleClick={handleDesktopItemDoubleClick}
            onShortcutContextMenu={(shortcutId, x, y) => {
              const menuWidth = 192;
              const menuHeight = 92;
              const clampedX = Math.max(12, Math.min(x, window.innerWidth - menuWidth - 12));
              const clampedY = Math.max(12, Math.min(y, window.innerHeight - menuHeight - 12));

              setShortcutContextMenu({
                shortcutId,
                x: clampedX,
                y: clampedY,
              });
            }}
            onStartShortcutDrag={startDesktopIconDrag}
            selectedDesktopItems={selectedDesktopApps}
          />

          {shortcutContextMenu ? (
            <div
              ref={shortcutContextMenuRef}
              className="fixed z-[60] w-48 overflow-hidden rounded-2xl border border-line bg-panel/95 p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.24)] backdrop-blur-xl"
              style={{
                left: shortcutContextMenu.x,
                top: shortcutContextMenu.y,
              }}
              role="menu"
            >
              <button
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-surface"
                onClick={() => openShortcutEditor(shortcutContextMenu.shortcutId)}
                type="button"
              >
                Edit shortcut
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10"
                onClick={() => deleteShortcut(shortcutContextMenu.shortcutId)}
                type="button"
              >
                Delete shortcut
              </button>
            </div>
          ) : null}

          <Taskbar
            activeApp={activeApp}
            isAppMinimized={isAppMinimized}
            isAppOpen={isAppOpen}
            resolvedTheme={resolvedTheme}
            onToggleApp={toggleApp}
            visible={isDockVisible}
          />
        </div>

        {draggingApp && snapPreview ? (
          <div className="pointer-events-none absolute inset-0 z-40 p-2">
            <div
              className="absolute rounded-[1.6rem] border border-info/45 bg-selection/15 shadow-[0_0_0_1px_rgba(var(--color-selection),0.18)_inset]"
              style={getSnapBounds(snapPreview)}
            />
          </div>
        ) : null}

        {visibleWindows.map((windowInstance) => (
          <WindowFrame
            key={windowInstance.id}
            activeWindowId={activeWindowId}
            appId={windowInstance.appId}
            windowId={windowInstance.id}
            onClose={closeWindow}
            onFocus={focusWindow}
            onMinimize={minimizeWindow}
            onStartResizing={startResizing}
            onStartDragging={startDragging}
            onStopWindowControlMouse={stopWindowControlMouse}
            onStopWindowControlPointer={stopWindowControlPointer}
            onToggleMaximize={toggleMaximize}
            windowState={windowInstance}
          >
            {renderWindowContent(windowInstance)}
          </WindowFrame>
        ))}
      </div>
    </main>
  );
}
