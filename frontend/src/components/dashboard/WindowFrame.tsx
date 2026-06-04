import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { windowTitle } from "./constants";
import { getSnapBounds } from "./desktopUtils";
import type { AppID, ResizeDirection, WindowInstance } from "./types";

type WindowFrameProps = {
  activeWindowId: string | null;
  appId: AppID;
  children: ReactNode;
  windowId: string;
  onClose: (windowId: string) => void | Promise<void>;
  onFocus: (windowId: string) => void;
  onMinimize: (windowId: string) => void;
  onStartResizing: (
    windowId: string,
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onStartDragging: (
    windowId: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onStopWindowControlMouse: (
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
  onStopWindowControlPointer: (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onToggleMaximize: (windowId: string) => void;
  windowState: WindowInstance;
};

export function WindowFrame({
  activeWindowId,
  appId,
  children,
  windowId,
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
      onMouseDown={() => onFocus(windowId)}
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
        className={`relative flex h-full flex-col overflow-hidden border shadow-[0_24px_90px_rgba(0,0,0,0.5)] ${
          activeWindowId === windowId
            ? "border-accent/30 bg-window-active"
            : "border-line bg-window/95"
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
          className="flex h-10 shrink-0 select-none items-center justify-between border-b border-line bg-window-chrome/95 px-3"
          onDoubleClick={() => onToggleMaximize(windowId)}
          onPointerDown={(event) => onStartDragging(windowId, event)}
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
            {windowTitle(appId)}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              className="flex h-7 min-w-[2rem] items-center justify-center rounded-md border border-line bg-surface/80 px-1.5 text-[10px] font-semibold text-ink transition hover:border-line-strong/40 hover:bg-surface"
              onClick={() => onMinimize(windowId)}
              onMouseDown={onStopWindowControlMouse}
              onPointerDown={onStopWindowControlPointer}
              type="button"
            >
              -
            </button>
            <button
              className="flex h-7 min-w-[2rem] items-center justify-center rounded-md border border-accent/35 bg-accent/10 px-1.5 text-[9px] font-semibold text-accent transition hover:border-accent/55 hover:bg-accent/20"
              onClick={() => onToggleMaximize(windowId)}
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
              className="flex h-7 min-w-[2rem] items-center justify-center rounded-md border border-danger/35 bg-danger/10 px-1.5 text-[10px] font-semibold text-danger-ink transition hover:border-danger/55 hover:bg-danger/20"
              onClick={() => void onClose(windowId)}
              onMouseDown={onStopWindowControlMouse}
              onPointerDown={onStopWindowControlPointer}
              type="button"
            >
              x
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
