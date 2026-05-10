import { useMemo, useState } from "react";
import { type Overview, type User, type Workspace } from "../lib/api";

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
  {
    id: "terminal",
    label: "Terminal",
    subtitle: "Shell access",
    badge: "Soon",
    available: false,
  },
  {
    id: "files",
    label: "Files",
    subtitle: "Workspace storage",
    badge: "Soon",
    available: false,
  },
  {
    id: "containers",
    label: "Containers",
    subtitle: "Runtime control",
    badge: "Planned",
    available: false,
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

  const activeWorkspace = useMemo(() => {
    return workspaces[0]?.name ?? "Primary Workspace";
  }, [workspaces]);

  const openChromium = () => setActiveApp("chromium");
  const closeWindow = () => setActiveApp(null);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-ink">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_28%),linear-gradient(180deg,rgba(8,12,22,0.82),rgba(4,6,10,0.98))]" />
      <div className="absolute inset-0 bg-portal-grid bg-[length:52px_52px] opacity-[0.14]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/6 to-transparent" />

      <div className="relative flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-white/10 bg-black/20 px-5 py-4 backdrop-blur">
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
                onClick={app.available ? openChromium : undefined}
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
                  onClick={app.available ? openChromium : undefined}
                  type="button"
                >
                  {initials(app.label)}
                </button>
              ))}
            </div>
          </div>

          {activeApp === "chromium" ? (
            <div className="absolute inset-x-4 top-24 bottom-24 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#06080d] shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur sm:inset-x-6">
              <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-400/80" />
                    <span className="h-3 w-3 rounded-full bg-amber-300/80" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">Chromium</p>
                    <p className="text-xs text-muted">
                      Containerized browser session
                    </p>
                  </div>
                </div>

                <button
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-muted transition hover:text-ink"
                  onClick={closeWindow}
                  type="button"
                >
                  Close
                </button>
              </div>

              <iframe
                className="h-[calc(100%-73px)] w-full border-0 bg-black"
                loading="lazy"
                src="/chromium/"
                title="Portal Chromium"
              />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
