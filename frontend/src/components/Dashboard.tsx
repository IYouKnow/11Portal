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
import { closeBrowserRuntime } from "../lib/api";
import { RemoteDesktopPanel } from "./RemoteDesktopPanel";
import { TerminalPanel } from "./TerminalPanel";
import {
  apps,
  CUSTOM_WALLPAPER_STORAGE_MARKER,
  DEFAULT_WALLPAPER,
  DESKTOP_ICON_HEIGHT,
  DESKTOP_ICON_WIDTH,
  initialDesktopIcons,
  initialWallpaper,
  initialWindows,
  wallpaperPresets,
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
  WallpaperPresetId,
  WallpaperState,
  WindowMap,
} from "./dashboard/types";
import { WindowFrame } from "./dashboard/WindowFrame";
import {
  deleteWallpaperImage,
  readWallpaperImage,
  writeWallpaperImage,
} from "./dashboard/wallpaperStorage";

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
  const [activeApp, setActiveApp] = useState<AppID | null>(null);
  const [windows, setWindows] = useState<WindowMap>(initialWindows);
  const [isBusy, setIsBusy] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState("");
  const [wallpaperError, setWallpaperError] = useState<string | null>(null);
  const [wallpaper, setWallpaper] = useState<WallpaperState>(initialWallpaper);
  const [draggingApp, setDraggingApp] = useState<AppID | null>(null);
  const [draggingDesktopIcon, setDraggingDesktopIcon] =
    useState<AppID | null>(null);
  const [desktopIcons, setDesktopIcons] =
    useState<IconPositionMap>(initialDesktopIcons);
  const [desktopIconsLoaded, setDesktopIconsLoaded] = useState(false);
  const [desktopLaunchMode, setDesktopLaunchMode] =
    useState<DesktopLaunchMode>("double");
  const [selectedDesktopApps, setSelectedDesktopApps] = useState<AppID[]>([]);
  const [desktopSelection, setDesktopSelection] =
    useState<DesktopSelectionState>(null);
  const [snapPreview, setSnapPreview] = useState<
    ReturnType<typeof detectSnapMode>
  >(null);
  const dragStateRef = useRef<DragState>(null);
  const iconDragStateRef = useRef<IconDragState>(null);
  const suppressIconClickRef = useRef<AppID | null>(null);
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
  const desktopLaunchModeStorageKey = `portal.desktop-launch-mode.${user.id}`;

  const applyPresetWallpaper = (presetId: WallpaperPresetId) => {
    const preset = wallpaperPresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    setWallpaper({
      mode: "preset",
      presetId,
      image: preset.image,
      overlay: preset.overlay,
    });
    setCustomWallpaperUrl("");
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
      overlay: "linear-gradient(180deg,rgba(2,6,23,0.26),rgba(2,6,23,0.74))",
    });
    setWallpaperError(null);
  };

  const isAppOpen = (appId: AppID) => windows[appId].open;
  const isAppMinimized = (appId: AppID) => windows[appId].minimized;

  const focusApp = (appId: AppID) => {
    setWindows((current) => ({
      ...current,
      [appId]: {
        ...current[appId],
        zIndex: nextZIndexRef.current++,
      },
    }));
    setActiveApp(appId);
  };

  const openApp = (appId: AppID) => {
    if (appId === "chromium") {
      setIframeKey((value) => value + 1);
    }

    setWindows((current) => ({
      ...current,
      [appId]: {
        ...current[appId],
        open: true,
        minimized: false,
        zIndex: nextZIndexRef.current++,
      },
    }));
    setActiveApp(appId);
  };

  const restoreApp = (appId: AppID) => {
    setWindows((current) => ({
      ...current,
      [appId]: {
        ...current[appId],
        minimized: false,
        zIndex: nextZIndexRef.current++,
      },
    }));
    setActiveApp(appId);
  };

  const minimizeApp = (appId: AppID) => {
    setWindows((current) => ({
      ...current,
      [appId]: {
        ...current[appId],
        minimized: true,
      },
    }));
    setActiveApp((current) => (current === appId ? null : current));
  };

  const closeApp = async (appId: AppID) => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    try {
      if (appId === "chromium") {
        await closeBrowserRuntime();
      }

      setWindows((current) => ({
        ...current,
        [appId]: {
          ...current[appId],
          open: false,
          minimized: false,
          maximized: false,
          snapped: null,
          position: current[appId].lastFloatingPosition,
        },
      }));
      setActiveApp((current) => (current === appId ? null : current));
    } finally {
      setIsBusy(false);
    }
  };

  const toggleApp = async (appId: AppID) => {
    if (isBusy) {
      return;
    }

    if (!isAppOpen(appId)) {
      openApp(appId);
      return;
    }

    if (isAppMinimized(appId)) {
      restoreApp(appId);
      return;
    }

    if (activeApp === appId) {
      minimizeApp(appId);
      return;
    }

    focusApp(appId);
  };

  const toggleMaximize = (appId: AppID) => {
    setWindows((current) => {
      const nextWindow = current[appId];
      if (nextWindow.maximized) {
        return {
          ...current,
          [appId]: {
            ...nextWindow,
            maximized: false,
            snapped: null,
            position: nextWindow.lastFloatingPosition,
          },
        };
      }

      return {
        ...current,
        [appId]: {
          ...nextWindow,
          maximized: true,
          snapped: null,
          lastFloatingPosition: nextWindow.position,
        },
      };
    });
    focusApp(appId);
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
              overlay:
                parsed.overlay ??
                "linear-gradient(180deg,rgba(2,6,23,0.26),rgba(2,6,23,0.74))",
            });
            setCustomWallpaperUrl(storedImage.startsWith("data:") ? "" : storedImage);
            return;
          }
        }

        if (parsed.presetId) {
          const preset = wallpaperPresets.find(
            (item) => item.id === parsed.presetId,
          );
          if (preset && !cancelled) {
            setWallpaper({
              mode: "preset",
              presetId: preset.id as WallpaperPresetId,
              image: preset.image,
              overlay: preset.overlay,
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
  }, [wallpaperStorageKey]);

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

    const raw = window.localStorage.getItem(desktopLaunchModeStorageKey);
    if (raw === "single" || raw === "double") {
      setDesktopLaunchMode(raw);
      return;
    }

    setDesktopLaunchMode("double");
  }, [desktopLaunchModeStorageKey]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
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
        const targetWindow = current[dragState.appId];
        if (targetWindow.maximized || targetWindow.snapped) {
          return current;
        }

        const width = Math.min(window.innerWidth * 0.78, 980);
        const nextX = event.clientX - dragState.offsetX;
        const nextY = event.clientY - dragState.offsetY;

        return {
          ...current,
          [dragState.appId]: {
            ...targetWindow,
            position: {
              x: Math.max(-width + 120, Math.min(nextX, window.innerWidth - 120)),
              y: Math.max(-28, Math.min(nextY, window.innerHeight - 48)),
            },
          },
        };
      });
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      dragStateRef.current = null;
      setDraggingApp(null);
      setWindows((current) => {
        const activePreview = detectSnapMode(event.clientX, event.clientY);

        if (activePreview === "maximize") {
          return {
            ...current,
            [dragState.appId]: {
              ...current[dragState.appId],
              maximized: true,
              snapped: null,
              lastFloatingPosition: current[dragState.appId].position,
            },
          };
        }

        if (activePreview) {
          return {
            ...current,
            [dragState.appId]: {
              ...current[dragState.appId],
              maximized: false,
              snapped: activePreview,
              lastFloatingPosition: current[dragState.appId].position,
            },
          };
        }

        return {
          ...current,
          [dragState.appId]: {
            ...current[dragState.appId],
            maximized: false,
            snapped: null,
            lastFloatingPosition: current[dragState.appId].position,
          },
        };
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
    if (typeof window === "undefined" || !desktopIconsLoaded) {
      return;
    }

    window.localStorage.setItem(
      desktopIconsStorageKey,
      JSON.stringify(desktopIcons),
    );
  }, [desktopIcons, desktopIconsLoaded, desktopIconsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(desktopLaunchModeStorageKey, desktopLaunchMode);
  }, [desktopLaunchMode, desktopLaunchModeStorageKey]);

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
    appId: AppID,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    focusApp(appId);

    const appWindow = windows[appId];
    let nextPosition = appWindow.position;
    let offsetX = event.clientX - appWindow.position.x;
    let offsetY = event.clientY - appWindow.position.y;

    if (appWindow.maximized || appWindow.snapped) {
      const restoredWidth = Math.min(window.innerWidth * 0.78, 980);
      const restoredHeight = Math.min(window.innerHeight * 0.7, 720);
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
          -restoredWidth + 120,
          Math.min(event.clientX - anchorX, window.innerWidth - 120),
        ),
        y: Math.max(-28, Math.min(event.clientY - anchorY, window.innerHeight - 48)),
      };

      setWindows((current) => ({
        ...current,
        [appId]: {
          ...current[appId],
          maximized: false,
          snapped: null,
          position: nextPosition,
          lastFloatingPosition: nextPosition,
        },
      }));

      offsetX = event.clientX - nextPosition.x;
      offsetY = event.clientY - nextPosition.y;
    }

    dragStateRef.current = {
      appId,
      pointerId: event.pointerId,
      offsetX,
      offsetY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingApp(appId);
    setSnapPreview(detectSnapMode(event.clientX, event.clientY));
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

      setCustomWallpaperUrl("");
      applyCustomWallpaper(reader.result);
    };
    reader.onerror = () => {
      setWallpaperError("That file could not be loaded.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleWallpaperUrlSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyCustomWallpaper(customWallpaperUrl);
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
    const selectedApps = apps
      .filter((app) =>
        rectanglesIntersect(selectionBounds, {
          left: desktopIconsRef.current[app.id].x,
          top: desktopIconsRef.current[app.id].y,
          width: DESKTOP_ICON_WIDTH,
          height: DESKTOP_ICON_HEIGHT,
        }),
      )
      .map((app) => app.id);

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
    appId: AppID,
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

  const handleDesktopIconClick = async (appId: AppID) => {
    if (suppressIconClickRef.current === appId) {
      suppressIconClickRef.current = null;
      return;
    }

    setSelectedDesktopApps([appId]);
    if (desktopLaunchMode !== "single") {
      return;
    }

    await toggleApp(appId);
  };

  const handleDesktopIconDoubleClick = async (appId: AppID) => {
    if (suppressIconClickRef.current === appId) {
      suppressIconClickRef.current = null;
      return;
    }

    setSelectedDesktopApps([appId]);
    await toggleApp(appId);
  };

  const renderWindowContent = (appId: AppID) => {
    if (appId === "chromium") {
      return (
        <iframe
          key={iframeKey}
          className={`h-[calc(100%-32px)] w-full border-0 bg-black ${
            draggingApp === "chromium" ? "pointer-events-none" : ""
          }`}
          loading="lazy"
          src={chromiumSrc}
          title="Portal Chromium"
        />
      );
    }

    if (appId === "terminal") {
      return (
        <TerminalPanel
          active={windows.terminal.open && !windows.terminal.minimized}
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

    return (
      <SettingsPanel
        customWallpaperUrl={customWallpaperUrl}
        desktopLaunchMode={desktopLaunchMode}
        error={error}
        isAdmin={isAdmin}
        isCreatingUser={isCreatingUser}
        newUserEmail={newUserEmail}
        newUserPassword={newUserPassword}
        newUserRole={newUserRole}
        onApplyPresetWallpaper={applyPresetWallpaper}
        onCreateUser={handleCreateUser}
        onCustomWallpaperUrlChange={setCustomWallpaperUrl}
        onDesktopLaunchModeChange={setDesktopLaunchMode}
        onNewUserEmailChange={setNewUserEmail}
        onNewUserPasswordChange={setNewUserPassword}
        onNewUserRoleChange={setNewUserRole}
        onWallpaperUpload={handleWallpaperUpload}
        onWallpaperUrlSubmit={handleWallpaperUrlSubmit}
        user={user}
        users={users}
        wallpaper={wallpaper}
        wallpaperError={wallpaperError}
      />
    );
  };

  const visibleApps = apps
    .filter((app) => windows[app.id].open && !windows[app.id].minimized)
    .sort((left, right) => windows[left.id].zIndex - windows[right.id].zIndex);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-ink">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: wallpaper.image
            ? `${wallpaper.overlay}, url("${wallpaper.image}")`
            : wallpaper.overlay,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />
      <div className="absolute inset-0 bg-portal-grid bg-[length:52px_52px] opacity-[0.14]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/6 to-transparent" />

      <div className="relative flex min-h-screen flex-col">
        <DashboardHeader
          activeWorkspace={activeWorkspace}
          isAdmin={isAdmin}
          onLogout={() => void onLogout()}
          onRefresh={() => void onRefresh()}
          overview={overview}
          user={user}
        />

        <div className="relative flex flex-1 flex-col pb-24 pt-3">
          <DesktopSurface
            activeApp={activeApp}
            desktopAreaRef={desktopAreaRef}
            desktopIcons={desktopIcons}
            desktopLaunchMode={desktopLaunchMode}
            desktopSelection={desktopSelection}
            draggingDesktopIcon={draggingDesktopIcon}
            isAppMinimized={isAppMinimized}
            isAppOpen={isAppOpen}
            onDesktopIconClick={handleDesktopIconClick}
            onDesktopIconDoubleClick={handleDesktopIconDoubleClick}
            onDesktopPointerDown={handleDesktopPointerDown}
            onDesktopPointerEnd={handleDesktopPointerEnd}
            onDesktopPointerMove={handleDesktopPointerMove}
            onStartDesktopIconDrag={startDesktopIconDrag}
            selectedDesktopApps={selectedDesktopApps}
          />

          <Taskbar
            activeApp={activeApp}
            isAppMinimized={isAppMinimized}
            isAppOpen={isAppOpen}
            onToggleApp={toggleApp}
          />
        </div>

        {draggingApp && snapPreview ? (
          <div className="pointer-events-none absolute inset-0 z-40 p-2">
            <div
              className="absolute rounded-[1.6rem] border border-sky-300/45 bg-sky-400/14 shadow-[0_0_0_1px_rgba(125,211,252,0.14)_inset]"
              style={getSnapBounds(snapPreview)}
            />
          </div>
        ) : null}

        {visibleApps.map((app) => (
          <WindowFrame
            key={app.id}
            activeApp={activeApp}
            appId={app.id}
            onClose={closeApp}
            onFocus={focusApp}
            onMinimize={minimizeApp}
            onStartDragging={startDragging}
            onStopWindowControlMouse={stopWindowControlMouse}
            onStopWindowControlPointer={stopWindowControlPointer}
            onToggleMaximize={toggleMaximize}
            windowState={windows[app.id]}
          >
            {renderWindowContent(app.id)}
          </WindowFrame>
        ))}
      </div>
    </main>
  );
}
