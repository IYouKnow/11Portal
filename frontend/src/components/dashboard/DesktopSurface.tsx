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
  desktopAreaRef: Ref<HTMLDivElement>;
  desktopIcons: IconPositionMap;
  desktopLaunchMode: DesktopLaunchMode;
  desktopSelection: DesktopSelectionState;
  draggingDesktopIcon: AppID | null;
  useLightLabels: boolean;
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
  desktopAreaRef,
  desktopIcons,
  desktopLaunchMode,
  desktopSelection,
  draggingDesktopIcon,
  useLightLabels,
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
                ? "bg-surface/70"
                : "hover:bg-surface/70 focus-visible:bg-surface/70"
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
            className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-ink backdrop-blur-sm transition dark:text-white ${
              selectedDesktopApps.includes(app.id)
                ? "border-line-strong/40 bg-surface/70"
                : "border-line bg-panel/45 group-hover:border-line-strong/40 group-hover:bg-surface/70"
            }`}
          >
            <AppIcon appId={app.id} />
          </div>
          <span
            className={`desktop-icon-label max-w-full px-1.5 py-0.5 text-sm font-medium leading-5 ${
              useLightLabels ? "text-white" : "text-ink"
            }`}
          >
            {app.label}
          </span>
        </button>
      ))}

      {desktopSelection ? (
        <div
          className="pointer-events-none absolute border border-info/70 bg-selection/15 shadow-[0_0_0_1px_rgba(var(--color-selection),0.25)_inset]"
          style={getSelectionBounds(desktopSelection)}
        />
      ) : null}
    </div>
  );
}
