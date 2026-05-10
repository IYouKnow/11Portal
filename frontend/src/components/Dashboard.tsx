import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { closeBrowserRuntime, openBrowserRuntime, type Overview, type User, type Workspace } from "../lib/api";

type DashboardProps = {
  user: User;
  overview: Overview;
  workspaces: Workspace[];
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
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
  onRefresh,
  onLogout,
}: DashboardProps) {
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [windowPosition, setWindowPosition] = useState({ x: 20, y: 96 });
  const [isMaximized, setIsMaximized] = useState(false);
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

  const openChromium = async () => {
    if (isBusy) {
      return;
    }

    if (activeApp === "chromium") {
      setActiveApp(null);
      return;
    }

    setIsBusy(true);
    try {
      const runtime = await openBrowserRuntime();
      if (runtime.started) {
        setIframeKey((value) => value + 1);
      }
      setActiveApp("chromium");
    } finally {
      setIsBusy(false);
    }
  };

  const closeWindow = async () => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    try {
      await closeBrowserRuntime();
      setActiveApp(null);
    } finally {
      setIsBusy(false);
    }
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
    if (activeApp !== "chromium") {
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
  }, [activeApp, isMaximized]);

  useEffect(() => {
    if (activeApp !== "chromium") {
      return;
    }

    let cancelled = false;
    const ensureRunning = async () => {
      try {
        const runtime = await openBrowserRuntime();
        if (!cancelled && runtime.started) {
          setIframeKey((value) => value + 1);
        }
      } catch {
        // Keep retrying on the next interval; transient failures are expected during restarts.
      }
    };

    const interval = window.setInterval(() => {
      void ensureRunning();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeApp]);

  const startDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isMaximized) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - windowPosition.x,
      offsetY: event.clientY - windowPosition.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const stopWindowControlPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
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
            <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted sm:block">
              {user.email}
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
                onClick={app.available ? () => void openChromium() : undefined}
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
                <p className="mt-2 text-sm leading-6 text-muted">
                  {app.subtitle}
                </p>
              </button>
            ))}
          </div>

          <div className="pointer-events-none mt-auto flex justify-center pt-8">
            <div className="pointer-events-auto flex items-center gap-3 rounded-[1.75rem] border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl">
              {apps.map((app) => (
                <button
                  key={app.id}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-xs font-semibold tracking-[0.18em] transition ${
                    activeApp === app.id
                      ? "border-accent/40 bg-accent/15 text-accent"
                      : app.available
                        ? "border-white/10 bg-white/5 text-ink hover:bg-white/10"
                        : "border-white/10 bg-black/20 text-muted"
                  }`}
                  disabled={!app.available}
                  onClick={app.available ? () => void openChromium() : undefined}
                  type="button"
                >
                  {initials(app.label)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeApp === "chromium" ? (
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
                className="flex h-8 items-center justify-between border-b border-white/10 bg-black/45 px-3 select-none"
                onPointerDown={startDragging}
              >
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
                  Chromium
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    className="flex h-5 w-5 items-center justify-center rounded-sm text-xs text-muted transition hover:bg-white/10 hover:text-ink"
                    onPointerDown={stopWindowControlPointer}
                    onClick={toggleMaximize}
                    type="button"
                  >
                    {isMaximized ? "▢" : "□"}
                  </button>
                  <button
                    className="flex h-5 w-5 items-center justify-center rounded-sm text-xs text-muted transition hover:bg-red-500/20 hover:text-red-200"
                    onPointerDown={stopWindowControlPointer}
                    onClick={() => void closeWindow()}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              </div>

              <iframe
                key={iframeKey}
                className={`h-[calc(100%-32px)] w-full border-0 bg-black ${
                  isDragging ? "pointer-events-none" : ""
                }`}
                loading="lazy"
                src="/chromium/"
                title="Portal Chromium"
              />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
