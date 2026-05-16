import { AppIcon } from "./AppIcon";
import { apps } from "./constants";
import type { AppID } from "./types";

type TaskbarProps = {
  activeApp: AppID | null;
  isAppMinimized: (appId: AppID) => boolean;
  isAppOpen: (appId: AppID) => boolean;
  onToggleApp: (appId: AppID) => void | Promise<void>;
};

export function Taskbar({
  activeApp,
  isAppMinimized,
  isAppOpen,
  onToggleApp,
}: TaskbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
      <div className="pointer-events-auto flex items-end gap-2 rounded-xl border border-white/15 bg-black/35 px-3 py-2.5 shadow-[0_28px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        {apps.map((app) => (
          <button
            key={app.id}
            className={`group relative flex flex-col items-center justify-end rounded-2xl transition ${
              activeApp === app.id && isAppOpen(app.id) && !isAppMinimized(app.id)
                ? "text-accent"
                : app.available
                  ? "text-ink"
                  : "text-muted"
            }`}
            disabled={!app.available}
            onClick={app.available ? () => void onToggleApp(app.id) : undefined}
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
              <AppIcon appId={app.id} />
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
  );
}
