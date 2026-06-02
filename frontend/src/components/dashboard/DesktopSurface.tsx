import type { PointerEvent as ReactPointerEvent, Ref } from "react";
import { AppIcon } from "./AppIcon";
import { apps, DESKTOP_ICON_HEIGHT, DESKTOP_ICON_WIDTH } from "./constants";
import { getSelectionBounds } from "./desktopUtils";
import type {
  AppID,
  DesktopLaunchMode,
  DesktopSelectionState,
  IconPositionMap,
} from "./types";

type DesktopSurfaceProps = {
  activeApp: AppID | null;
  desktopAreaRef: Ref<HTMLDivElement>;
  desktopIcons: IconPositionMap;
  desktopLaunchMode: DesktopLaunchMode;
  desktopSelection: DesktopSelectionState;
  draggingDesktopIcon: AppID | null;
  isAppMinimized: (appId: AppID) => boolean;
  isAppOpen: (appId: AppID) => boolean;
  onDesktopPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDesktopPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDesktopPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDesktopIconClick: (appId: AppID) => void | Promise<void>;
  onDesktopIconDoubleClick: (appId: AppID) => void | Promise<void>;
  onStartDesktopIconDrag: (
    appId: AppID,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  selectedDesktopApps: AppID[];
};

export function DesktopSurface({
  activeApp,
  desktopAreaRef,
  desktopIcons,
  desktopLaunchMode,
  desktopSelection,
  draggingDesktopIcon,
  isAppMinimized,
  isAppOpen,
  onDesktopPointerDown,
  onDesktopPointerMove,
  onDesktopPointerEnd,
  onDesktopIconClick,
  onDesktopIconDoubleClick,
  onStartDesktopIconDrag,
  selectedDesktopApps,
}: DesktopSurfaceProps) {
  return (
    <div
      ref={desktopAreaRef}
      className="relative min-h-0 flex-1"
      onPointerDown={onDesktopPointerDown}
      onPointerMove={onDesktopPointerMove}
      onPointerUp={onDesktopPointerEnd}
      onPointerCancel={onDesktopPointerEnd}
    >
      {apps.map((app) => (
        <button
          key={app.id}
          className={`group absolute flex w-[88px] flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition ${
            app.available
              ? selectedDesktopApps.includes(app.id)
                ? "bg-white/10"
                : "hover:bg-white/10 focus-visible:bg-white/10"
              : "opacity-50"
          } select-none ${
            draggingDesktopIcon === app.id
              ? "cursor-grabbing"
              : "cursor-default"
          }`}
          onClick={app.available ? () => void onDesktopIconClick(app.id) : undefined}
          onDoubleClick={
            app.available && desktopLaunchMode === "double"
              ? () => void onDesktopIconDoubleClick(app.id)
              : undefined
          }
          onPointerDown={
            app.available
              ? (event) => onStartDesktopIconDrag(app.id, event)
              : undefined
          }
          style={{
            left: desktopIcons[app.id].x,
            top: desktopIcons[app.id].y,
          }}
          type="button"
        >
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl border backdrop-blur-sm transition ${
              selectedDesktopApps.includes(app.id)
                ? "border-white/20 bg-white/10"
                : activeApp === app.id && isAppOpen(app.id) && !isAppMinimized(app.id)
                  ? "border-accent/45 bg-accent/15 shadow-[0_0_22px_rgba(56,189,248,0.18)]"
                  : "border-white/10 bg-black/25 group-hover:border-white/20 group-hover:bg-white/10"
            }`}
          >
            <AppIcon appId={app.id} />
          </div>
          <span className="max-w-full px-1.5 py-0.5 text-sm font-medium leading-5 text-ink [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]">
            {app.label}
          </span>
        </button>
      ))}

      {desktopSelection ? (
        <div
          className="pointer-events-none absolute border border-sky-300/70 bg-sky-400/15 shadow-[0_0_0_1px_rgba(125,211,252,0.25)_inset]"
          style={getSelectionBounds(desktopSelection)}
        />
      ) : null}
    </div>
  );
}
