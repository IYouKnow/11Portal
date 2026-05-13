import {
  type FormEvent,
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

type AppID = "chromium" | "terminal" | "settings";

type DesktopApp = {
  id: AppID;
  label: string;
  subtitle: string;
  badge?: string;
  available: boolean;
};

type WindowState = {
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  position: { x: number; y: number };
  lastFloatingPosition: { x: number; y: number };
  zIndex: number;
};

type WindowMap = Record<AppID, WindowState>;

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
    subtitle: "Web workspace",
    badge: "Live",
    available: true,
  },
  {
    id: "terminal",
    label: "Terminal",
    subtitle: "Linux shell",
    badge: "Shell",
    available: true,
  },
  {
    id: "settings",
    label: "Settings",
    subtitle: "Access and system",
    badge: "Admin",
    available: true,
  },
];

const initialWindows: WindowMap = {
  chromium: {
    open: false,
    minimized: false,
    maximized: false,
    position: { x: 24, y: 96 },
    lastFloatingPosition: { x: 24, y: 96 },
    zIndex: 1,
  },
  terminal: {
    open: false,
    minimized: false,
    maximized: false,
    position: { x: 72, y: 136 },
    lastFloatingPosition: { x: 72, y: 136 },
    zIndex: 1,
  },
  settings: {
    open: false,
    minimized: false,
    maximized: false,
    position: { x: 128, y: 112 },
    lastFloatingPosition: { x: 128, y: 112 },
    zIndex: 1,
  },
};

function initials(label: string) {
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function windowTitle(appId: AppID) {
  if (appId === "chromium") {
    return "Chromium";
  }
  if (appId === "terminal") {
    return "Terminal";
  }
  return "Settings";
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
  const [draggingApp, setDraggingApp] = useState<AppID | null>(null);
  const dragStateRef = useRef<DragState>(null);
  const nextZIndexRef = useRef(4);

  const activeWorkspace = useMemo(() => {
    return workspaces[0]?.name ?? "Primary Workspace";
  }, [workspaces]);
  const isAdmin = user.role === "admin";
  const chromiumSrc = overview.platform.chromiumURL || "/chromium/";

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
            position: nextWindow.lastFloatingPosition,
          },
        };
      }

      return {
        ...current,
        [appId]: {
          ...nextWindow,
          maximized: true,
          lastFloatingPosition: nextWindow.position,
        },
      };
    });
    focusApp(appId);
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      if ((event.buttons & 1) !== 1) {
        dragStateRef.current = null;
        setDraggingApp(null);
        return;
      }

      setWindows((current) => {
        const targetWindow = current[dragState.appId];
        if (targetWindow.maximized) {
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
      setWindows((current) => ({
        ...current,
        [dragState.appId]: {
          ...current[dragState.appId],
          lastFloatingPosition: current[dragState.appId].position,
        },
      }));
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

    if (appWindow.maximized) {
      const restoredWidth = Math.min(window.innerWidth * 0.78, 980);
      const pointerRatio =
        window.innerWidth > 0 ? event.clientX / window.innerWidth : 0.5;
      const anchorX = Math.max(
        28,
        Math.min(restoredWidth - 28, restoredWidth * pointerRatio),
      );

      nextPosition = {
        x: Math.max(
          -restoredWidth + 120,
          Math.min(event.clientX - anchorX, window.innerWidth - 120),
        ),
        y: Math.max(-28, Math.min(event.clientY - 16, window.innerHeight - 48)),
      };

      setWindows((current) => ({
        ...current,
        [appId]: {
          ...current[appId],
          maximized: false,
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
        {isAdmin ? (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
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
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
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

    return renderSettingsContent();
  };

  const visibleApps = apps
    .filter((app) => windows[app.id].open && !windows[app.id].minimized)
    .sort((left, right) => windows[left.id].zIndex - windows[right.id].zIndex);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-ink">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_28%),linear-gradient(180deg,rgba(8,12,22,0.82),rgba(4,6,10,0.98))]" />
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {apps.map((app) => (
              <button
                key={app.id}
                className={`group rounded-3xl border p-5 text-left backdrop-blur transition ${
                  app.available
                    ? "border-white/10 bg-white/8 hover:border-accent/40 hover:bg-white/12"
                    : "border-white/8 bg-black/20 opacity-85"
                }`}
                onClick={app.available ? () => void toggleApp(app.id) : undefined}
                type="button"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm font-semibold tracking-[0.18em] text-ink">
                    {initials(app.label)}
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] text-muted">
                    {app.badge ?? "App"}
                  </span>
                </div>

                <h2 className="text-lg font-medium text-ink">{app.label}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{app.subtitle}</p>
              </button>
            ))}
          </div>

          <div className="pointer-events-none mt-auto flex justify-center pt-8">
            <div className="pointer-events-auto flex items-center gap-3 rounded-[1.75rem] border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl">
              {apps.map((app) => (
                <button
                  key={app.id}
                  className={`relative flex h-12 w-12 items-center justify-center rounded-2xl border text-xs font-semibold tracking-[0.18em] transition ${
                    activeApp === app.id &&
                    isAppOpen(app.id) &&
                    !isAppMinimized(app.id)
                      ? "border-accent/40 bg-accent/15 text-accent"
                      : app.available
                        ? "border-white/10 bg-white/5 text-ink hover:bg-white/10"
                        : "border-white/10 bg-black/20 text-muted"
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
                  {initials(app.label)}
                  {isAppOpen(app.id) ? (
                    <span className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-accent" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visibleApps.map((app) => {
          const appWindow = windows[app.id];

          return (
            <div
              key={app.id}
              className={`absolute ${
                appWindow.maximized
                  ? "inset-0 h-screen w-screen"
                  : "h-[min(70vh,720px)] w-[min(78vw,980px)]"
              }`}
              onMouseDown={() => focusApp(app.id)}
              style={{
                zIndex: 20 + appWindow.zIndex,
                left: appWindow.maximized ? undefined : `${appWindow.position.x}px`,
                top: appWindow.maximized ? undefined : `${appWindow.position.y}px`,
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
