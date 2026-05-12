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

type DesktopApp = {
  id: string;
  label: string;
  subtitle: string;
  badge?: string;
  available: boolean;
};

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
];

function initials(label: string) {
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [isChromiumOpen, setIsChromiumOpen] = useState(false);
  const [isChromiumMinimized, setIsChromiumMinimized] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isTerminalMinimized, setIsTerminalMinimized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [windowPosition, setWindowPosition] = useState({ x: 20, y: 96 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<User["role"]>("user");
  const windowRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const positionRef = useRef(windowPosition);
  const lastFloatingPositionRef = useRef(windowPosition);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    positionRef.current = windowPosition;
    if (windowRef.current) {
      windowRef.current.style.left = `${windowPosition.x}px`;
      windowRef.current.style.top = `${windowPosition.y}px`;
    }
  }, [windowPosition]);

  const activeWorkspace = useMemo(() => {
    return workspaces[0]?.name ?? "Primary Workspace";
  }, [workspaces]);
  const isAdmin = user.role === "admin";

  const chromiumSrc = overview.platform.chromiumURL || "/chromium/";

  const isAppOpen = (appId: string) =>
    appId === "chromium" ? isChromiumOpen : isTerminalOpen;

  const isAppMinimized = (appId: string) =>
    appId === "chromium" ? isChromiumMinimized : isTerminalMinimized;

  const toggleApp = async (appId: string) => {
    if (isBusy) {
      return;
    }

    if (!isAppOpen(appId)) {
      if (appId === "chromium") {
        setIframeKey((value) => value + 1);
        setIsChromiumOpen(true);
        setIsChromiumMinimized(false);
      } else {
        setIsTerminalOpen(true);
        setIsTerminalMinimized(false);
      }
      setActiveApp(appId);
      return;
    }

    if (isAppMinimized(appId)) {
      if (appId === "chromium") {
        setIsChromiumMinimized(false);
      } else {
        setIsTerminalMinimized(false);
      }
      setActiveApp(appId);
      return;
    }

    if (activeApp === appId) {
      if (appId === "chromium") {
        setIsChromiumMinimized(true);
      } else {
        setIsTerminalMinimized(true);
      }
      setActiveApp(null);
      return;
    }

    setActiveApp(appId);
  };

  const closeWindow = async () => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    try {
      if (activeApp === "chromium") {
        await closeBrowserRuntime();
        setIsChromiumOpen(false);
        setIsChromiumMinimized(false);
      } else if (activeApp === "terminal") {
        setIsTerminalOpen(false);
        setIsTerminalMinimized(false);
      }
      setActiveApp(null);
    } finally {
      setIsBusy(false);
    }
  };

  const minimizeWindow = () => {
    if (!activeApp || !isAppOpen(activeApp) || isAppMinimized(activeApp)) {
      return;
    }

    if (activeApp === "chromium") {
      setIsChromiumMinimized(true);
    } else if (activeApp === "terminal") {
      setIsTerminalMinimized(true);
    }
    setActiveApp(null);
  };

  const toggleMaximize = () => {
    if (isMaximized) {
      setIsMaximized(false);
      setWindowPosition(lastFloatingPositionRef.current);
      positionRef.current = lastFloatingPositionRef.current;
      return;
    }

    lastFloatingPositionRef.current = positionRef.current;
    setIsMaximized(true);
  };

  useEffect(() => {
    if (!activeApp || isAppMinimized(activeApp) || !isAppOpen(activeApp)) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      if ((event.buttons & 1) !== 1) {
        dragStateRef.current = null;
        setIsDragging(false);
        return;
      }

      if (isMaximized) {
        return;
      }

      const width = Math.min(window.innerWidth * 0.78, 980);
      const height = Math.min(window.innerHeight * 0.7, 720);
      const nextX = event.clientX - dragState.offsetX;
      const nextY = event.clientY - dragState.offsetY;

      const nextPosition = {
        x: Math.max(-width + 120, Math.min(nextX, window.innerWidth - 120)),
        y: Math.max(-28, Math.min(nextY, window.innerHeight - 48)),
      };

      positionRef.current = nextPosition;
      if (frameRef.current == null) {
        frameRef.current = window.requestAnimationFrame(() => {
          frameRef.current = null;
          if (windowRef.current) {
            windowRef.current.style.left = `${positionRef.current.x}px`;
            windowRef.current.style.top = `${positionRef.current.y}px`;
          }
        });
      }
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (dragState && dragState.pointerId === event.pointerId) {
        dragStateRef.current = null;
        setIsDragging(false);
        setWindowPosition(positionRef.current);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [
    activeApp,
    isChromiumMinimized,
    isChromiumOpen,
    isMaximized,
    isTerminalMinimized,
    isTerminalOpen,
  ]);

  const startDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    let nextPosition = windowPosition;
    let offsetX = event.clientX - windowPosition.x;
    let offsetY = event.clientY - windowPosition.y;

    if (isMaximized) {
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

      setIsMaximized(false);
      setWindowPosition(nextPosition);
      positionRef.current = nextPosition;

      offsetX = event.clientX - nextPosition.x;
      offsetY = event.clientY - nextPosition.y;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX,
      offsetY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const stopWindowControlPointer = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
  };

  const handleTitleBarDoubleClick = () => {
    toggleMaximize();
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

          {isAdmin ? (
            <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-white/10 bg-black/25 p-5 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-muted">
                      Access
                    </p>
                    <h2 className="mt-2 text-xl font-medium text-ink">Team users</h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted">
                    {users.length} accounts
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {users.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">{account.email}</p>
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
              </div>

              <section className="rounded-3xl border border-white/10 bg-black/25 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.28em] text-muted">
                  Admin only
                </p>
                <h2 className="mt-2 text-xl font-medium text-ink">Create account</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Registration is disabled publicly. Admins create credentials here
                  and share them directly with the user.
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
            </section>
          ) : (
            <section className="mt-6 rounded-3xl border border-white/10 bg-black/25 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.28em] text-muted">Access</p>
              <h2 className="mt-2 text-xl font-medium text-ink">Signed in as user</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Your account can access the Portal workspace. Admin accounts can
                also manage other users from this dashboard.
              </p>
            </section>
          )}

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

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
                        : `Minimize ${app.label}`
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
              <div className="mx-1 h-8 w-px bg-white/10" />
              <button
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-lg transition ${
                  isSettingsOpen
                    ? "border-accent/40 bg-accent/15 text-accent"
                    : "border-white/10 bg-white/5 text-ink hover:bg-white/10"
                }`}
                onClick={() => setIsSettingsOpen((value) => !value)}
                title="Dock settings"
                type="button"
              >
                ?
              </button>
            </div>
          </div>

          {isSettingsOpen ? (
            <div className="pointer-events-auto absolute bottom-28 left-1/2 z-40 w-[min(92vw,340px)] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur-xl">
              <h3 className="text-sm font-medium text-ink">Dock Settings</h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Chromium and Terminal support minimize-to-dock. Click an app icon
                to minimize, then click again to restore without losing session
                state.
              </p>
            </div>
          ) : null}
        </div>

        {activeApp && isAppOpen(activeApp) && !isAppMinimized(activeApp) ? (
          <div
            ref={windowRef}
            className={`absolute z-30 ${
              isMaximized
                ? "inset-0 h-screen w-screen"
                : "h-[min(70vh,720px)] w-[min(78vw,980px)]"
            }`}
            style={{
              left: isMaximized ? undefined : `${windowPosition.x}px`,
              top: isMaximized ? undefined : `${windowPosition.y}px`,
            }}
          >
            <div
              className={`h-full overflow-hidden border border-white/10 bg-[#07090d] shadow-[0_24px_90px_rgba(0,0,0,0.5)] ${
                isMaximized ? "rounded-none" : "rounded-2xl"
              }`}
            >
              <div
                className="flex h-8 select-none items-center justify-between border-b border-white/10 bg-black/45 px-3"
                onDoubleClick={handleTitleBarDoubleClick}
                onPointerDown={startDragging}
              >
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
                  {activeApp === "chromium" ? "Chromium" : "Terminal"}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    className="flex h-6 min-w-[1.9rem] items-center justify-center rounded-md border border-white/15 bg-white/5 px-1.5 text-[10px] font-semibold text-slate-200 transition hover:border-white/25 hover:bg-white/10"
                    onClick={minimizeWindow}
                    onPointerDown={stopWindowControlPointer}
                    type="button"
                  >
                    -
                  </button>
                  <button
                    className="flex h-6 min-w-[1.9rem] items-center justify-center rounded-md border border-accent/35 bg-accent/10 px-1.5 text-[9px] font-semibold text-accent transition hover:border-accent/55 hover:bg-accent/20"
                    onClick={toggleMaximize}
                    onPointerDown={stopWindowControlPointer}
                    type="button"
                  >
                    {isMaximized ? (
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
                    onClick={() => void closeWindow()}
                    onPointerDown={stopWindowControlPointer}
                    type="button"
                  >
                    x
                  </button>
                </div>
              </div>

              {activeApp === "chromium" ? (
                <iframe
                  key={iframeKey}
                  className={`h-[calc(100%-32px)] w-full border-0 bg-black ${
                    isDragging ? "pointer-events-none" : ""
                  }`}
                  loading="lazy"
                  src={chromiumSrc}
                  title="Portal Chromium"
                />
              ) : (
                <TerminalPanel active={isTerminalOpen} />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
