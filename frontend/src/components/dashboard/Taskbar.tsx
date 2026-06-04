import { AppIcon } from "./AppIcon";
import { apps } from "./constants";
import type { ResolvedTheme } from "../../theme-config";
import type { AppID } from "./types";

type TaskbarProps = {
  activeApp: AppID | null;
  isAppMinimized: (appId: AppID) => boolean;
  isAppOpen: (appId: AppID) => boolean;
  resolvedTheme: ResolvedTheme;
  visible: boolean;
  onToggleApp: (appId: AppID) => void | Promise<void>;
};

export function Taskbar({
  activeApp,
  isAppMinimized,
  isAppOpen,
  resolvedTheme,
  visible,
  onToggleApp,
}: TaskbarProps) {
  const tooltipStyle = {
    color: resolvedTheme === "light" ? "#000000" : "#ffffff",
  } as const;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4 transition-[opacity,transform] duration-200 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      <div
        className={`flex items-center gap-1.5 rounded-2xl border border-slate-300/85 bg-white/72 px-2.5 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur-xl transition dark:border-white/10 dark:bg-window/82 dark:shadow-[0_14px_34px_rgba(0,0,0,0.32)] ${
          visible ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        {apps.map((app) => (
          (() => {
            if (app.id === "shortcutManager") {
              return (
                <div key={app.id} className="flex items-center">
                  <div
                    aria-hidden="true"
                    className="mx-1 flex h-11 items-center px-1 text-[18px] leading-none text-muted/80"
                  >
                    |
                  </div>
                  <button
                    className={`group relative flex h-14 w-14 items-center justify-center rounded-xl transition duration-150 ${
                      app.available
                        ? "cursor-pointer"
                        : "cursor-not-allowed opacity-55"
                    }`}
                    disabled={!app.available}
                    onClick={
                      app.available ? () => void onToggleApp(app.id) : undefined
                    }
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
                    <span
                      className="pointer-events-none absolute -top-12 left-1/2 whitespace-nowrap rounded-md border border-black/10 bg-slate-900/92 px-2 py-1 text-[11px] text-black opacity-0 shadow-soft transition duration-150 -translate-x-1/2 group-hover:-translate-x-1/2 group-hover:-translate-y-0.5 group-hover:opacity-100 dark:border-white/10 dark:bg-window/94 dark:text-white"
                      style={tooltipStyle}
                    >
                      {app.label}
                    </span>
                    <span
                      className={`absolute inset-0 rounded-xl transition duration-150 ${
                        activeApp === app.id &&
                        isAppOpen(app.id) &&
                        !isAppMinimized(app.id)
                          ? "bg-surface/58 dark:bg-white/4"
                          : isAppOpen(app.id)
                            ? "bg-surface/72 dark:bg-white/4"
                            : "bg-transparent group-hover:bg-surface/60 dark:group-hover:bg-white/4"
                      }`}
                    />
                    <span
                      className={`relative flex h-11 w-11 items-center justify-center rounded-lg border transition duration-150 ${
                        activeApp === app.id &&
                        isAppOpen(app.id) &&
                        !isAppMinimized(app.id)
                          ? "border-slate-300 bg-white/92 text-black shadow-[0_6px_18px_rgba(15,23,42,0.10)] dark:border-white/5 dark:bg-white/10 dark:text-white dark:shadow-[0_8px_20px_rgba(0,0,0,0.22)]"
                          : isAppOpen(app.id)
                            ? "border-slate-300/95 bg-white/78 text-black shadow-[0_3px_10px_rgba(15,23,42,0.06)] dark:border-white/5 dark:bg-white/7 dark:text-white dark:shadow-none"
                            : "border-slate-200/0 bg-transparent text-black group-hover:border-slate-300/90 group-hover:bg-white/72 group-hover:text-black group-hover:shadow-[0_3px_10px_rgba(15,23,42,0.05)] dark:text-white/70 dark:group-hover:border-white/4 dark:group-hover:bg-white/6 dark:group-hover:text-white dark:group-hover:shadow-none"
                      }`}
                    >
                      <AppIcon appId={app.id} resolvedTheme={resolvedTheme} />
                    </span>
                    {isAppOpen(app.id) ? (
                      <span
                        className={`absolute bottom-1.5 h-1.5 rounded-full transition-all duration-150 ${
                          activeApp === app.id && !isAppMinimized(app.id)
                            ? "w-5 bg-accent"
                            : "w-1.5 bg-line-strong"
                        }`}
                      />
                    ) : null}
                  </button>
                </div>
              );
            }

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
                <span
                  className="pointer-events-none absolute -top-12 left-1/2 whitespace-nowrap rounded-md border border-black/10 bg-slate-900/92 px-2 py-1 text-[11px] text-black opacity-0 shadow-soft transition duration-150 -translate-x-1/2 group-hover:-translate-x-1/2 group-hover:-translate-y-0.5 group-hover:opacity-100 dark:border-white/10 dark:bg-window/94 dark:text-white"
                  style={tooltipStyle}
                >
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
                      ? "border-slate-300 bg-white/92 text-black shadow-[0_6px_18px_rgba(15,23,42,0.10)] dark:border-white/5 dark:bg-white/10 dark:text-white dark:shadow-[0_8px_20px_rgba(0,0,0,0.22)]"
                      : appIsOpen
                        ? "border-slate-300/95 bg-white/78 text-black shadow-[0_3px_10px_rgba(15,23,42,0.06)] dark:border-white/5 dark:bg-white/7 dark:text-white dark:shadow-none"
                        : "border-slate-200/0 bg-transparent text-black group-hover:border-slate-300/90 group-hover:bg-white/72 group-hover:text-black group-hover:shadow-[0_3px_10px_rgba(15,23,42,0.05)] dark:text-white/70 dark:group-hover:border-white/4 dark:group-hover:bg-white/6 dark:group-hover:text-white dark:group-hover:shadow-none"
                  }`}
                >
                  <AppIcon appId={app.id} resolvedTheme={resolvedTheme} />
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
