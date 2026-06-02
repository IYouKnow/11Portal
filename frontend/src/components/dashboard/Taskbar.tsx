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
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-slate-300/85 bg-white/72 px-2.5 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-window/82 dark:shadow-[0_14px_34px_rgba(0,0,0,0.32)]">
        {apps.map((app) => (
          (() => {
            const appIsOpen = isAppOpen(app.id);
            const appIsMinimized = isAppMinimized(app.id);
            const appIsActive = activeApp === app.id && appIsOpen && !appIsMinimized;

            return (
              <button
                key={app.id}
                className={`group relative flex h-14 w-14 items-center justify-center rounded-xl transition duration-150 ${
                  app.available
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-55"
                }`}
                disabled={!app.available}
                onClick={app.available ? () => void onToggleApp(app.id) : undefined}
                title={
                  appIsOpen
                    ? appIsMinimized
                      ? `Restore ${app.label}`
                      : activeApp === app.id
                        ? `Minimize ${app.label}`
                        : `Focus ${app.label}`
                    : `Open ${app.label}`
                }
                type="button"
              >
                <span className="pointer-events-none absolute -top-10 rounded-md border border-line/70 bg-panel/96 px-2 py-1 text-[11px] text-ink opacity-0 shadow-soft transition duration-150 group-hover:-translate-y-0.5 group-hover:opacity-100 dark:border-white/10 dark:bg-window/94">
                  {app.label}
                </span>
                <span
                  className={`absolute inset-0 rounded-xl transition duration-150 ${
                    appIsActive
                      ? "bg-surface/58 dark:bg-white/4"
                      : appIsOpen
                        ? "bg-surface/72 dark:bg-white/4"
                        : "bg-transparent group-hover:bg-surface/60 dark:group-hover:bg-white/4"
                  }`}
                />
                <span
                  className={`relative flex h-11 w-11 items-center justify-center rounded-lg border transition duration-150 ${
                    appIsActive
                      ? "border-slate-300 bg-white/92 text-ink shadow-[0_6px_18px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-window/90"
                      : appIsOpen
                        ? "border-slate-300/95 bg-white/78 text-ink shadow-[0_3px_10px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-window/86 dark:shadow-none"
                        : "border-slate-200/0 bg-transparent text-muted group-hover:border-slate-300/90 group-hover:bg-white/72 group-hover:text-ink group-hover:shadow-[0_3px_10px_rgba(15,23,42,0.05)] dark:group-hover:border-white/8 dark:group-hover:bg-window/78 dark:group-hover:shadow-none"
                  }`}
                >
                  <AppIcon appId={app.id} />
                </span>
                {appIsOpen ? (
                  <span
                    className={`absolute bottom-1.5 h-1.5 rounded-full transition-all duration-150 ${
                      appIsActive ? "w-5 bg-accent" : "w-1.5 bg-line-strong"
                    }`}
                  />
                ) : null}
              </button>
            );
          })()
        ))}
      </div>
    </div>
  );
}
