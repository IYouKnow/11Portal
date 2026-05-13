import {
  type FormEvent,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  closeBrowserRuntime,
  type Overview,
  type User,
  type Workspace,
} from "../lib/api";
import { TerminalPanel } from "./TerminalPanel";

type DashboardProps = {
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

type AppID = "chromium" | "terminal" | "remoteDesktop" | "settings";

type DesktopApp = {
  id: AppID;
  label: string;
  available: boolean;
};

type WindowState = {
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  snapped: SnapMode | null;
  position: { x: number; y: number };
  lastFloatingPosition: { x: number; y: number };
  zIndex: number;
};

type WindowMap = Record<AppID, WindowState>;

type SnapMode =
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

type DragState = {
  appId: AppID;
  pointerId: number;
  offsetX: number;
  offsetY: number;
} | null;

const apps: DesktopApp[] = [
  {
    id: "chromium",
    label: "Chromium",
    available: true,
  },
  {
    id: "terminal",
    label: "Terminal",
    available: true,
  },
  {
    id: "remoteDesktop",
    label: "Remote Desktop",
    available: true,
  },
  {
    id: "settings",
    label: "Settings",
    available: true,
  },
];

const initialWindows: WindowMap = {
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

const DEFAULT_WALLPAPER = "gradient";
const CUSTOM_WALLPAPER_STORAGE_MARKER = "__portal_custom_wallpaper__";
const WALLPAPER_DB_NAME = "portal-wallpapers";
const WALLPAPER_STORE_NAME = "wallpapers";

const wallpaperPresets = [
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
] as const;

type WallpaperPresetId = (typeof wallpaperPresets)[number]["id"];

type WallpaperState = {
  mode: "preset" | "custom";
  presetId: WallpaperPresetId;
  image: string;
  overlay: string;
};

type RemoteDesktopProfile = {
  id: string;
  label: string;
  host: string;
  port: string;
  username: string;
};

function openWallpaperDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(WALLPAPER_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WALLPAPER_STORE_NAME)) {
        database.createObjectStore(WALLPAPER_STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Could not open wallpaper storage."));
    };
  });
}

function readWallpaperImage(storageKey: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    openWallpaperDatabase()
      .then((database) => {
        const transaction = database.transaction(WALLPAPER_STORE_NAME, "readonly");
        const store = transaction.objectStore(WALLPAPER_STORE_NAME);
        const request = store.get(storageKey);

        request.onsuccess = () => {
          resolve(typeof request.result === "string" ? request.result : null);
        };
        request.onerror = () => {
          reject(request.error ?? new Error("Could not read wallpaper image."));
        };
        transaction.oncomplete = () => {
          database.close();
        };
      })
      .catch(reject);
  });
}

function writeWallpaperImage(storageKey: string, image: string): Promise<void> {
  return new Promise((resolve, reject) => {
    openWallpaperDatabase()
      .then((database) => {
        const transaction = database.transaction(WALLPAPER_STORE_NAME, "readwrite");
        const store = transaction.objectStore(WALLPAPER_STORE_NAME);
        const request = store.put(image, storageKey);

        request.onerror = () => {
          reject(request.error ?? new Error("Could not save wallpaper image."));
        };
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error("Could not save wallpaper image."));
        };
      })
      .catch(reject);
  });
}

function deleteWallpaperImage(storageKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    openWallpaperDatabase()
      .then((database) => {
        const transaction = database.transaction(WALLPAPER_STORE_NAME, "readwrite");
        const store = transaction.objectStore(WALLPAPER_STORE_NAME);
        const request = store.delete(storageKey);

        request.onerror = () => {
          reject(request.error ?? new Error("Could not clear wallpaper image."));
        };
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error("Could not clear wallpaper image."));
        };
      })
      .catch(reject);
  });
}

function initials(label: string) {
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function renderAppIcon(appId: AppID) {
  if (appId === "chromium") {
    return (
      <svg aria-hidden="true" className="h-9 w-9" viewBox="0 0 48 48" fill="none">
        <rect
          x="7"
          y="10"
          width="34"
          height="28"
          rx="8"
          fill="#0F172A"
          stroke="#7DD3FC"
          strokeWidth="2"
        />
        <path
          d="M7 18h34"
          stroke="#7DD3FC"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="13" cy="14" r="1.4" fill="#F87171" />
        <circle cx="18" cy="14" r="1.4" fill="#FBBF24" />
        <circle cx="23" cy="14" r="1.4" fill="#34D399" />
        <circle
          cx="24"
          cy="28"
          r="7"
          stroke="#E0F2FE"
          strokeWidth="2"
        />
        <path
          d="M17 28h14M24 21c2.3 2 3.5 4.33 3.5 7S26.3 33 24 35c-2.3-2-3.5-4.33-3.5-7S21.7 23 24 21Z"
          stroke="#E0F2FE"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (appId === "terminal") {
    return (
      <svg aria-hidden="true" className="h-9 w-9" viewBox="0 0 48 48" fill="none">
        <rect x="7" y="9" width="34" height="30" rx="7" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />
        <path d="m16 18 6 6-6 6" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M25 30h8" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (appId === "remoteDesktop") {
    return (
      <svg aria-hidden="true" className="h-9 w-9" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="9" width="24" height="18" rx="4.5" fill="#0F172A" stroke="#67E8F9" strokeWidth="2" />
        <rect x="18" y="21" width="24" height="18" rx="4.5" fill="#111827" stroke="#22C55E" strokeWidth="2" />
        <path d="M12 31h10" stroke="#E5F9FF" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M24 17h7" stroke="#C7F9CC" strokeWidth="2.2" strokeLinecap="round" />
        <path d="m26 30 3 3 6-6" stroke="#86EFAC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-9 w-9" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="8" width="32" height="32" rx="8" fill="#111827" stroke="#A78BFA" strokeWidth="2" />
      <circle cx="24" cy="24" r="7" stroke="#E9D5FF" strokeWidth="2.5" />
      <path d="M24 13v4M24 31v4M35 24h-4M17 24h-4M31.8 16.2l-2.8 2.8M19 29l-2.8 2.8M31.8 31.8 29 29M19 19l-2.8-2.8" stroke="#E9D5FF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function windowTitle(appId: AppID) {
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

function detectSnapMode(pointerX: number, pointerY: number): SnapMode | "maximize" | null {
  const edgeThreshold = 36;
  const topThreshold = 44;
  const cornerThreshold = 140;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const nearLeft = pointerX <= edgeThreshold;
  const nearRight = pointerX >= viewportWidth - edgeThreshold;
  const nearTop = pointerY <= topThreshold;
  const nearBottom = pointerY >= viewportHeight - edgeThreshold;
  const inTopLeftCorner = pointerX <= cornerThreshold && pointerY <= cornerThreshold;
  const inTopRightCorner =
    pointerX >= viewportWidth - cornerThreshold && pointerY <= cornerThreshold;
  const inBottomLeftCorner =
    pointerX <= cornerThreshold && pointerY >= viewportHeight - cornerThreshold;
  const inBottomRightCorner =
    pointerX >= viewportWidth - cornerThreshold &&
    pointerY >= viewportHeight - cornerThreshold;

  if (inTopLeftCorner) {
    return "top-left";
  }
  if (inTopRightCorner) {
    return "top-right";
  }
  if (inBottomLeftCorner) {
    return "bottom-left";
  }
  if (inBottomRightCorner) {
    return "bottom-right";
  }
  if (nearTop) {
    return "maximize";
  }
  if (nearLeft) {
    return "left";
  }
  if (nearRight) {
    return "right";
  }
  if (nearBottom) {
    return null;
  }

  return null;
}

function getSnapBounds(mode: SnapMode | "maximize") {
  if (mode === "maximize") {
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }

  if (mode === "left") {
    return { left: 0, top: 0, width: window.innerWidth / 2, height: window.innerHeight };
  }

  if (mode === "right") {
    return {
      left: window.innerWidth / 2,
      top: 0,
      width: window.innerWidth / 2,
      height: window.innerHeight,
    };
  }

  const isLeft = mode === "top-left" || mode === "bottom-left";
  const isTop = mode === "top-left" || mode === "top-right";

  return {
    left: isLeft ? 0 : window.innerWidth / 2,
    top: isTop ? 0 : window.innerHeight / 2,
    width: window.innerWidth / 2,
    height: window.innerHeight / 2,
  };
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
  const [activeApp, setActiveApp] = useState<AppID | null>(null);
  const [windows, setWindows] = useState<WindowMap>(initialWindows);
  const [isBusy, setIsBusy] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<User["role"]>("user");
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState("");
  const [wallpaperError, setWallpaperError] = useState<string | null>(null);
  const [remoteDesktopProfiles, setRemoteDesktopProfiles] = useState<RemoteDesktopProfile[]>([]);
  const [remoteDesktopLabel, setRemoteDesktopLabel] = useState("");
  const [remoteDesktopHost, setRemoteDesktopHost] = useState("");
  const [remoteDesktopPort, setRemoteDesktopPort] = useState("3389");
  const [remoteDesktopUsername, setRemoteDesktopUsername] = useState("");
  const [wallpaper, setWallpaper] = useState<WallpaperState>(() => ({
    mode: "preset",
    presetId: DEFAULT_WALLPAPER,
    image: "",
    overlay:
      "radial-gradient(circle at top left,rgba(125,211,252,0.18),transparent 24%),radial-gradient(circle at bottom right,rgba(16,185,129,0.14),transparent 28%),linear-gradient(180deg,rgba(8,12,22,0.82),rgba(4,6,10,0.98))",
  }));
  const [draggingApp, setDraggingApp] = useState<AppID | null>(null);
  const [snapPreview, setSnapPreview] = useState<SnapMode | "maximize" | null>(null);
  const dragStateRef = useRef<DragState>(null);
  const nextZIndexRef = useRef(4);

  const activeWorkspace = useMemo(() => {
    return workspaces[0]?.name ?? "Primary Workspace";
  }, [workspaces]);
  const isAdmin = user.role === "admin";
  const chromiumSrc = overview.platform.chromiumURL || "/chromium/";
  const remoteDesktopURL = overview.platform.remoteDesktopURL?.trim() || "";
  const wallpaperStorageKey = `portal.wallpaper.${user.id}`;
  const remoteDesktopProfilesStorageKey = `portal.remoteDesktopProfiles.${user.id}`;

  const applyPresetWallpaper = (presetId: WallpaperPresetId) => {
    const preset = wallpaperPresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    setWallpaper({
      mode: "preset",
      presetId: preset.id,
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
            setCustomWallpaperUrl(
              storedImage.startsWith("data:") ? "" : storedImage,
            );
            return;
          }
        }

        if (parsed.presetId) {
          const preset = wallpaperPresets.find((item) => item.id === parsed.presetId);
          if (preset && !cancelled) {
            setWallpaper({
              mode: "preset",
              presetId: preset.id,
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

    const raw = window.localStorage.getItem(remoteDesktopProfilesStorageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as RemoteDesktopProfile[];
      if (Array.isArray(parsed)) {
        setRemoteDesktopProfiles(
          parsed.filter((item) => {
            return (
              typeof item?.id === "string" &&
              typeof item?.label === "string" &&
              typeof item?.host === "string" &&
              typeof item?.port === "string" &&
              typeof item?.username === "string"
            );
          }),
        );
      }
    } catch {
      // Ignore invalid saved profiles.
    }
  }, [remoteDesktopProfilesStorageKey]);

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
          window.localStorage.setItem(wallpaperStorageKey, JSON.stringify(wallpaper));
        }

        if (!cancelled) {
          setWallpaperError(null);
        }
      } catch {
        if (!cancelled) {
          setWallpaperError("Wallpaper could not be saved locally. Try a smaller image.");
        }
      }
    };

    void persistWallpaper();

    return () => {
      cancelled = true;
    };
  }, [wallpaper, wallpaperStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        remoteDesktopProfilesStorageKey,
        JSON.stringify(remoteDesktopProfiles),
      );
    } catch {
      // Ignore local profile persistence failures.
    }
  }, [remoteDesktopProfiles, remoteDesktopProfilesStorageKey]);

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

  const handleSaveRemoteDesktopProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const label = remoteDesktopLabel.trim();
    const host = remoteDesktopHost.trim();
    const port = remoteDesktopPort.trim() || "3389";
    const username = remoteDesktopUsername.trim();

    if (!label || !host || !username) {
      return;
    }

    setRemoteDesktopProfiles((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label,
        host,
        port,
        username,
      },
      ...current,
    ]);
    setRemoteDesktopLabel("");
    setRemoteDesktopHost("");
    setRemoteDesktopPort("3389");
    setRemoteDesktopUsername("");
  };

  const handleDeleteRemoteDesktopProfile = (profileId: string) => {
    setRemoteDesktopProfiles((current) =>
      current.filter((profile) => profile.id !== profileId),
    );
  };

  const renderWallpaperSection = () => (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted">
            Personalization
          </p>
          <h2 className="mt-2 text-xl font-medium text-ink">Wallpaper</h2>
        </div>
        <button
          className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-muted transition hover:text-ink"
          onClick={() => applyPresetWallpaper(DEFAULT_WALLPAPER)}
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
                  : "border-white/10 bg-black/20 hover:border-white/20"
              }`}
              onClick={() => applyPresetWallpaper(preset.id)}
              type="button"
            >
              <div
                className="h-24 w-full"
                style={{
                  backgroundImage: preset.image
                    ? `${preset.overlay}, url("${preset.image}")`
                    : preset.overlay,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }}
              />
              <div className="px-3 py-2 text-sm text-ink">{preset.label}</div>
            </button>
          );
        })}
      </div>

      <form className="mt-5 flex flex-col gap-3" onSubmit={handleWallpaperUrlSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm text-muted">Image URL</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
            onChange={(event) => setCustomWallpaperUrl(event.target.value)}
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
          <label className="cursor-pointer rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-ink transition hover:bg-white/10">
            Upload image
            <input
              accept="image/*"
              className="hidden"
              onChange={handleWallpaperUpload}
              type="file"
            />
          </label>
        </div>
      </form>

      <p className="mt-4 text-xs leading-5 text-muted">
        Wallpapers are saved in this browser, so each device can keep its own desktop look.
      </p>

      {wallpaperError ? (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {wallpaperError}
        </div>
      ) : null}
    </section>
  );

  const renderSettingsContent = () => (
    <div className="grid h-[calc(100%-32px)] grid-cols-[220px_1fr] bg-[#06080d]">
      <aside className="border-r border-white/10 bg-black/30 p-4">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
          Settings
        </p>
        <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <p className="text-sm font-medium text-ink">Access control</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Manage who can enter Portal and which role they receive.
          </p>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">
            Signed in
          </p>
          <p className="mt-2 text-sm text-ink">{user.email}</p>
          <p className="mt-1 text-xs text-muted">Role: {user.role}</p>
        </div>
      </aside>

      <div className="overflow-auto p-5">
        {renderWallpaperSection()}

        {isAdmin ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-muted">
                    Access
                  </p>
                  <h2 className="mt-2 text-xl font-medium text-ink">
                    Team users
                  </h2>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-muted">
                  {users.length} accounts
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {users.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {account.email}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Created {new Date(account.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${
                        account.role === "admin"
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-sky-500/15 text-sky-200"
                      }`}
                    >
                      {account.role}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-muted">
                Admin only
              </p>
              <h2 className="mt-2 text-xl font-medium text-ink">
                Create account
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Registration is disabled publicly. Create credentials here and
                pass them to the user directly.
              </p>

              <form className="mt-5 space-y-4" onSubmit={handleCreateUser}>
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Email</span>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
                    onChange={(event) => setNewUserEmail(event.target.value)}
                    required
                    type="email"
                    value={newUserEmail}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-muted">
                    Temporary password
                  </span>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
                    minLength={10}
                    onChange={(event) => setNewUserPassword(event.target.value)}
                    required
                    type="password"
                    value={newUserPassword}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Role</span>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
                    onChange={(event) =>
                      setNewUserRole(event.target.value as User["role"])
                    }
                    value={newUserRole}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>

                <button
                  className="w-full rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isCreatingUser}
                  type="submit"
                >
                  {isCreatingUser ? "Creating account..." : "Create account"}
                </button>
              </form>
            </section>
          </div>
        ) : (
          <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-muted">
              Access
            </p>
            <h2 className="mt-2 text-xl font-medium text-ink">
              User account
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Your account can access the Portal workspace. Admin accounts can
              create and manage other users from this settings app.
            </p>
          </section>
        )}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderRemoteDesktopContent = () => (
    <div className="grid h-[calc(100%-32px)] grid-cols-[320px_1fr] bg-[#05070b]">
      <aside className="flex flex-col border-r border-white/10 bg-black/35">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
            Remote Desktop
          </p>
          <h2 className="mt-2 text-lg font-medium text-ink">Saved machines</h2>
        </div>

        <form className="space-y-3 border-b border-white/10 px-5 py-4" onSubmit={handleSaveRemoteDesktopProfile}>
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-muted">
              Connection name
            </span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
              onChange={(event) => setRemoteDesktopLabel(event.target.value)}
              placeholder="Production Windows Server"
              value={remoteDesktopLabel}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-muted">
              Host
            </span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
              onChange={(event) => setRemoteDesktopHost(event.target.value)}
              placeholder="10.0.0.25"
              value={remoteDesktopHost}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-muted">
                Port
              </span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
                onChange={(event) => setRemoteDesktopPort(event.target.value)}
                placeholder="3389"
                value={remoteDesktopPort}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-muted">
                Username
              </span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
                onChange={(event) => setRemoteDesktopUsername(event.target.value)}
                placeholder="Administrator"
                value={remoteDesktopUsername}
              />
            </label>
          </div>

          <button
            className="w-full rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent transition hover:bg-accent/20"
            type="submit"
          >
            Save machine
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">
              Profiles
            </p>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-muted">
              {remoteDesktopProfiles.length}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {remoteDesktopProfiles.length > 0 ? (
              remoteDesktopProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{profile.label}</p>
                      <p className="mt-1 text-xs text-muted">
                        {profile.host}:{profile.port}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        User: {profile.username}
                      </p>
                    </div>
                    <button
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-muted transition hover:text-ink"
                      onClick={() => handleDeleteRemoteDesktopProfile(profile.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-muted">
                No saved machines yet.
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/25 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">
              Gateway
            </p>
            <h2 className="mt-1 text-lg font-medium text-ink">
              {remoteDesktopURL ? "Session" : "Not configured"}
            </h2>
          </div>

          {remoteDesktopURL ? (
            <a
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink transition hover:bg-white/10"
              href={remoteDesktopURL}
              rel="noreferrer"
              target="_blank"
            >
              Open full page
            </a>
          ) : null}
        </div>

        {remoteDesktopURL ? (
          <iframe
            className="h-full w-full border-0 bg-black"
            src={remoteDesktopURL}
            title="Portal Remote Desktop"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
                {renderAppIcon("remoteDesktop")}
              </div>
              <h3 className="mt-5 text-2xl font-medium text-ink">Remote Desktop</h3>
              <p className="mt-3 text-sm leading-7 text-muted">
                Configure <code>PORTAL_REMOTE_DESKTOP_PUBLIC_URL</code> to open sessions here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

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
      return <TerminalPanel active={windows.terminal.open && !windows.terminal.minimized} />;
    }

    if (appId === "remoteDesktop") {
      return renderRemoteDesktopContent();
    }

    return renderSettingsContent();
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
        <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/20 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-muted">
              Portal OS
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{activeWorkspace}</p>
              <p className="text-xs text-muted">
                {overview.stats.workspaceCount} workspace · Chromium ready
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted sm:flex">
              <span className="text-ink">{user.email}</span>
              <span
                className={`rounded-full px-2 py-0.5 uppercase tracking-[0.22em] ${
                  isAdmin
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "bg-sky-500/15 text-sky-200"
                }`}
              >
                {user.role}
              </span>
            </div>
            <button
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink transition hover:bg-white/10"
              onClick={() => void onRefresh()}
              type="button"
            >
              Refresh
            </button>
            <button
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-muted transition hover:text-ink"
              onClick={() => void onLogout()}
              type="button"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="relative flex flex-1 flex-col px-5 py-5">
          <div className="grid auto-rows-max grid-cols-[repeat(auto-fit,minmax(88px,88px))] gap-x-5 gap-y-6 content-start justify-start">
            {apps.map((app) => (
              <button
                key={app.id}
                className={`group flex w-[88px] flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition ${
                  app.available
                    ? "hover:bg-white/10 focus-visible:bg-white/10"
                    : "opacity-50"
                }`}
                onClick={app.available ? () => void toggleApp(app.id) : undefined}
                type="button"
              >
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl border backdrop-blur-sm transition ${
                    activeApp === app.id && isAppOpen(app.id) && !isAppMinimized(app.id)
                      ? "border-accent/45 bg-accent/15 shadow-[0_0_22px_rgba(56,189,248,0.18)]"
                      : "border-white/10 bg-black/25 group-hover:border-white/20 group-hover:bg-white/10"
                  }`}
                >
                  {renderAppIcon(app.id)}
                </div>
                <span className="max-w-full text-sm font-medium leading-5 text-ink [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]">
                  {app.label}
                </span>
              </button>
            ))}
          </div>

          <div className="pointer-events-none mt-auto flex justify-center pt-10">
            <div className="pointer-events-auto flex items-end gap-2 rounded-xl border border-white/15 bg-black/35 px-3 py-2.5 shadow-[0_28px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
              {apps.map((app) => (
                <button
                  key={app.id}
                  className={`group relative flex flex-col items-center justify-end rounded-2xl transition ${
                    activeApp === app.id &&
                    isAppOpen(app.id) &&
                    !isAppMinimized(app.id)
                      ? "text-accent"
                      : app.available
                        ? "text-ink"
                        : "text-muted"
                  }`}
                  disabled={!app.available}
                  onClick={app.available ? () => void toggleApp(app.id) : undefined}
                  title={
                    isAppOpen(app.id)
                      ? isAppMinimized(app.id)
                        ? `Restore ${app.label}`
                        : activeApp === app.id
                          ? `Minimize ${app.label}`
                          : `Focus ${app.label}`
                      : `Open ${app.label}`
                  }
                  type="button"
                >
                  <span className="pointer-events-none absolute -top-9 rounded-md border border-white/10 bg-black/75 px-2.5 py-1 text-[11px] text-ink opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition duration-200 group-hover:-translate-y-1 group-hover:opacity-100">
                    {app.label}
                  </span>
                  <span
                    className={`relative flex h-14 w-14 items-center justify-center rounded-lg border backdrop-blur-md transition duration-200 group-hover:-translate-y-1 group-hover:scale-105 ${
                      activeApp === app.id && isAppOpen(app.id) && !isAppMinimized(app.id)
                        ? "border-accent/45 bg-accent/15 shadow-[0_10px_28px_rgba(56,189,248,0.22)]"
                        : app.available
                          ? "border-white/10 bg-white/8 group-hover:border-white/20 group-hover:bg-white/14"
                          : "border-white/10 bg-black/20"
                    }`}
                  >
                    {renderAppIcon(app.id)}
                  </span>
                  {isAppOpen(app.id) ? (
                    <span
                      className={`mt-2 h-1.5 rounded-full transition-all ${
                        activeApp === app.id && !isAppMinimized(app.id)
                          ? "w-5 bg-accent"
                          : "w-1.5 bg-white/70"
                      }`}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>

        {draggingApp && snapPreview ? (
          <div className="pointer-events-none absolute inset-0 z-40 p-2">
            <div
              className="absolute rounded-[1.6rem] border border-sky-300/45 bg-sky-400/14 shadow-[0_0_0_1px_rgba(125,211,252,0.14)_inset]"
              style={getSnapBounds(snapPreview)}
            />
          </div>
        ) : null}

        {visibleApps.map((app) => {
          const appWindow = windows[app.id];
          const snappedBounds = appWindow.snapped
            ? getSnapBounds(appWindow.snapped)
            : null;
          const isFramedToViewport = appWindow.maximized || snappedBounds !== null;

          return (
            <div
              key={app.id}
              className={`absolute ${
                isFramedToViewport
                  ? "h-screen w-screen"
                  : "h-[min(70vh,720px)] w-[min(78vw,980px)]"
              }`}
              onMouseDown={() => focusApp(app.id)}
              style={{
                zIndex: 20 + appWindow.zIndex,
                left: isFramedToViewport
                  ? appWindow.maximized
                    ? 0
                    : snappedBounds?.left
                  : `${appWindow.position.x}px`,
                top: isFramedToViewport
                  ? appWindow.maximized
                    ? 0
                    : snappedBounds?.top
                  : `${appWindow.position.y}px`,
                width: appWindow.maximized ? "100vw" : snappedBounds?.width,
                height: appWindow.maximized ? "100vh" : snappedBounds?.height,
              }}
            >
              <div
                className={`h-full overflow-hidden border shadow-[0_24px_90px_rgba(0,0,0,0.5)] ${
                  activeApp === app.id
                    ? "border-accent/30 bg-[#07090d]"
                    : "border-white/10 bg-[#07090d]/95"
                } ${appWindow.maximized ? "rounded-none" : "rounded-2xl"}`}
              >
                <div
                  className="flex h-8 select-none items-center justify-between border-b border-white/10 bg-black/45 px-3"
                  onDoubleClick={() => toggleMaximize(app.id)}
                  onPointerDown={(event) => startDragging(app.id, event)}
                >
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
                    {windowTitle(app.id)}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      className="flex h-6 min-w-[1.9rem] items-center justify-center rounded-md border border-white/15 bg-white/5 px-1.5 text-[10px] font-semibold text-slate-200 transition hover:border-white/25 hover:bg-white/10"
                      onClick={() => minimizeApp(app.id)}
                      onPointerDown={stopWindowControlPointer}
                      type="button"
                    >
                      -
                    </button>
                    <button
                      className="flex h-6 min-w-[1.9rem] items-center justify-center rounded-md border border-accent/35 bg-accent/10 px-1.5 text-[9px] font-semibold text-accent transition hover:border-accent/55 hover:bg-accent/20"
                      onClick={() => toggleMaximize(app.id)}
                      onPointerDown={stopWindowControlPointer}
                      type="button"
                    >
                      {appWindow.maximized ? (
                        <svg
                          aria-hidden="true"
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <rect
                            height="11"
                            rx="1.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            width="11"
                            x="5"
                            y="8"
                          />
                          <path
                            d="M9 8V5h10v10h-3"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                          />
                        </svg>
                      ) : (
                        <svg
                          aria-hidden="true"
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <rect
                            height="14"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            width="14"
                            x="5"
                            y="5"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      className="flex h-6 min-w-[1.9rem] items-center justify-center rounded-md border border-red-400/35 bg-red-500/10 px-1.5 text-[10px] font-semibold text-red-200 transition hover:border-red-300/55 hover:bg-red-500/20"
                      onClick={() => void closeApp(app.id)}
                      onPointerDown={stopWindowControlPointer}
                      type="button"
                    >
                      x
                    </button>
                  </div>
                </div>

                {renderWindowContent(app.id)}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
