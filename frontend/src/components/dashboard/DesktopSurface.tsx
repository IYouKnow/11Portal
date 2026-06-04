import { useState, type PointerEvent as ReactPointerEvent, Ref } from "react";
import { Link2 } from "lucide-react";
import { AppIcon } from "./AppIcon";
import { apps } from "./constants";
import { getSelectionBounds } from "./desktopUtils";
import type { ResolvedTheme } from "../../theme-config";
import type {
  DesktopLaunchMode,
  DesktopSelectionState,
  IconPositionMap,
  ShortcutDefinition,
} from "./types";

type DesktopSurfaceProps = {
  desktopAreaRef: Ref<HTMLDivElement>;
  desktopIcons: IconPositionMap;
  desktopLaunchMode: DesktopLaunchMode;
  desktopSelection: DesktopSelectionState;
  draggingDesktopIcon: string | null;
  resolvedTheme: ResolvedTheme;
  useLightLabels: boolean;
  shortcuts: ShortcutDefinition[];
  onDesktopPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDesktopPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDesktopPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDesktopIconClick: (appId: string) => void | Promise<void>;
  onDesktopIconDoubleClick: (appId: string) => void | Promise<void>;
  onStartDesktopIconDrag: (
    appId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onShortcutClick: (shortcutId: string) => void | Promise<void>;
  onShortcutDoubleClick: (shortcutId: string) => void | Promise<void>;
  onShortcutContextMenu: (
    shortcutId: string,
    x: number,
    y: number,
  ) => void;
  onStartShortcutDrag: (
    shortcutId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  selectedDesktopItems: string[];
};

export function DesktopSurface({
  desktopAreaRef,
  desktopIcons,
  desktopLaunchMode,
  desktopSelection,
  draggingDesktopIcon,
  resolvedTheme,
  useLightLabels,
  shortcuts,
  onDesktopPointerDown,
  onDesktopPointerMove,
  onDesktopPointerEnd,
  onDesktopIconClick,
  onDesktopIconDoubleClick,
  onStartDesktopIconDrag,
  onShortcutClick,
  onShortcutDoubleClick,
  onShortcutContextMenu,
  onStartShortcutDrag,
  selectedDesktopItems,
}: DesktopSurfaceProps) {
  const desktopApps = apps.filter((app) => app.id !== "shortcutManager");

  return (
    <div
      ref={desktopAreaRef}
      className="relative min-h-0 flex-1"
      onPointerDown={onDesktopPointerDown}
      onPointerMove={onDesktopPointerMove}
      onPointerUp={onDesktopPointerEnd}
      onPointerCancel={onDesktopPointerEnd}
      >
      {desktopApps.map((app) => (
        <button
          key={app.id}
          className={`group absolute flex w-[88px] flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition ${
            app.available
              ? selectedDesktopItems.includes(app.id)
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
            left: desktopIcons[app.id]?.x ?? 0,
            top: desktopIcons[app.id]?.y ?? 0,
          }}
          type="button"
        >
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-black backdrop-blur-sm transition dark:text-white ${
              selectedDesktopItems.includes(app.id)
                ? "border-line-strong/40 bg-surface/70"
                : "border-line bg-panel/45 group-hover:border-line-strong/40 group-hover:bg-surface/70"
            }`}
          >
            <AppIcon appId={app.id} resolvedTheme={resolvedTheme} />
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

      {shortcuts.map((shortcut) => (
        <button
          key={shortcut.id}
          className={`group absolute flex w-[88px] flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition ${
            selectedDesktopItems.includes(shortcut.id)
              ? "bg-surface/70"
              : "hover:bg-surface/70 focus-visible:bg-surface/70"
          } select-none ${
            draggingDesktopIcon === shortcut.id ? "cursor-grabbing" : "cursor-default"
          }`}
          onClick={() => void onShortcutClick(shortcut.id)}
          onDoubleClick={
            desktopLaunchMode === "double"
              ? () => void onShortcutDoubleClick(shortcut.id)
              : undefined
          }
          onContextMenu={(event) => {
            event.preventDefault();
            onShortcutContextMenu(shortcut.id, event.clientX, event.clientY);
          }}
          onPointerDown={(event) => onStartShortcutDrag(shortcut.id, event)}
          style={{
            left: desktopIcons[shortcut.id]?.x ?? 0,
            top: desktopIcons[shortcut.id]?.y ?? 0,
          }}
          type="button"
        >
          <div
            className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border text-black backdrop-blur-sm transition dark:text-white ${
              selectedDesktopItems.includes(shortcut.id)
                ? "border-line-strong/40 bg-surface/70"
                : "border-line bg-panel/45 group-hover:border-line-strong/40 group-hover:bg-surface/70"
            }`}
          >
            <ShortcutDesktopIcon iconUrl={shortcut.iconUrl} />
          </div>
          <span
            className={`desktop-icon-label max-w-full px-1.5 py-0.5 text-sm font-medium leading-5 ${
              useLightLabels ? "text-white" : "text-ink"
            }`}
          >
            {shortcut.label}
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

function ShortcutDesktopIcon({ iconUrl }: { iconUrl: string }) {
  const [failed, setFailed] = useState(false);

  if (!iconUrl || failed) {
    return <Link2 aria-hidden="true" className="h-7 w-7" strokeWidth={1.9} />;
  }

  return (
    <img
      alt=""
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
      src={iconUrl}
    />
  );
}
