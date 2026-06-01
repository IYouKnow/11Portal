import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { windowTitle } from "./constants";
import { getSnapBounds } from "./desktopUtils";
import type { AppID, ResizeDirection, WindowState } from "./types";

type WindowFrameProps = {
  activeApp: AppID | null;
  appId: AppID;
  children: ReactNode;
  onClose: (appId: AppID) => void | Promise<void>;
  onFocus: (appId: AppID) => void;
  onMinimize: (appId: AppID) => void;
  onStartResizing: (
    appId: AppID,
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onStartDragging: (
    appId: AppID,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onStopWindowControlMouse: (
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
  onStopWindowControlPointer: (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onToggleMaximize: (appId: AppID) => void;
  windowState: WindowState;
};

export function WindowFrame({
  activeApp,
  appId,
  children,
  onClose,
  onFocus,
  onMinimize,
  onStartResizing,
  onStartDragging,
  onStopWindowControlMouse,
  onStopWindowControlPointer,
  onToggleMaximize,
  windowState,
}: WindowFrameProps) {
  const snappedBounds = windowState.snapped
    ? getSnapBounds(windowState.snapped)
    : null;
  const isFramedToViewport = windowState.maximized || snappedBounds !== null;
  const resizeHandles: Array<{
    direction: ResizeDirection;
    className: string;
  }> = [
    { direction: "top", className: "left-3 right-3 top-0 h-1 cursor-ns-resize" },
    {
      direction: "right",
      className: "bottom-3 right-0 top-3 w-1 cursor-ew-resize",
    },
    {
      direction: "bottom",
      className: "bottom-0 left-3 right-3 h-1 cursor-ns-resize",
    },
    { direction: "left", className: "bottom-3 left-0 top-3 w-1 cursor-ew-resize" },
    {
      direction: "top-left",
      className: "left-0 top-0 h-3 w-3 cursor-nwse-resize",
    },
    {
      direction: "top-right",
      className: "right-0 top-0 h-3 w-3 cursor-nesw-resize",
    },
    {
      direction: "bottom-left",
      className: "bottom-0 left-0 h-3 w-3 cursor-nesw-resize",
    },
    {
      direction: "bottom-right",
      className: "bottom-0 right-0 h-3 w-3 cursor-nwse-resize",
    },
  ];

  return (
    <div
      className={`absolute ${
        isFramedToViewport
          ? "h-screen w-screen"
          : ""
      }`}
      onMouseDown={() => onFocus(appId)}
      style={{
        zIndex: 20 + windowState.zIndex,
        left: isFramedToViewport
          ? windowState.maximized
            ? 0
            : snappedBounds?.left
          : `${windowState.position.x}px`,
        top: isFramedToViewport
          ? windowState.maximized
            ? 0
            : snappedBounds?.top
          : `${windowState.position.y}px`,
        width: windowState.maximized
          ? "100vw"
          : snappedBounds?.width ?? `${windowState.size.width}px`,
        height: windowState.maximized
          ? "100vh"
          : snappedBounds?.height ?? `${windowState.size.height}px`,
      }}
    >
      <div
        className={`relative h-full overflow-hidden border shadow-[0_24px_90px_rgba(0,0,0,0.5)] ${
          activeApp === appId
            ? "border-accent/30 bg-[#07090d]"
            : "border-white/10 bg-[#07090d]/95"
        } ${windowState.maximized ? "rounded-none" : "rounded-2xl"}`}
      >
        {!isFramedToViewport
          ? resizeHandles.map((handle) => (
              <div
                key={handle.direction}
                className={`absolute z-20 touch-none ${handle.className}`}
                onPointerDown={(event) => onStartResizing(appId, handle.direction, event)}
              />
            ))
          : null}
        <div
          className="flex h-8 select-none items-center justify-between border-b border-white/10 bg-black/45 px-3"
          onDoubleClick={() => onToggleMaximize(appId)}
          onPointerDown={(event) => onStartDragging(appId, event)}
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
            {windowTitle(appId)}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              className="flex h-6 min-w-[1.9rem] items-center justify-center rounded-md border border-white/15 bg-white/5 px-1.5 text-[10px] font-semibold text-slate-200 transition hover:border-white/25 hover:bg-white/10"
              onClick={() => onMinimize(appId)}
              onMouseDown={onStopWindowControlMouse}
              onPointerDown={onStopWindowControlPointer}
              type="button"
            >
              -
            </button>
            <button
              className="flex h-6 min-w-[1.9rem] items-center justify-center rounded-md border border-accent/35 bg-accent/10 px-1.5 text-[9px] font-semibold text-accent transition hover:border-accent/55 hover:bg-accent/20"
              onClick={() => onToggleMaximize(appId)}
              onMouseDown={onStopWindowControlMouse}
              onPointerDown={onStopWindowControlPointer}
              type="button"
            >
              {windowState.maximized ? (
                <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <rect height="11" rx="1.5" stroke="currentColor" strokeWidth="1.8" width="11" x="5" y="8" />
                  <path
                    d="M9 8V5h10v10h-3"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              ) : (
                <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <rect height="14" rx="2" stroke="currentColor" strokeWidth="1.8" width="14" x="5" y="5" />
                </svg>
              )}
            </button>
            <button
              className="flex h-6 min-w-[1.9rem] items-center justify-center rounded-md border border-red-400/35 bg-red-500/10 px-1.5 text-[10px] font-semibold text-red-200 transition hover:border-red-300/55 hover:bg-red-500/20"
              onClick={() => void onClose(appId)}
              onMouseDown={onStopWindowControlMouse}
              onPointerDown={onStopWindowControlPointer}
              type="button"
            >
              x
            </button>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
