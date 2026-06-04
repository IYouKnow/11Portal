import { memo, useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import {
  closeTerminalSession,
  createTerminalSession,
  listTerminalSessions,
  type TerminalSession,
} from "../lib/api";
import { type ResolvedTheme, getTerminalTheme } from "../theme-config";
import { useTheme } from "../theme-context";

type TerminalPanelProps = {
  active: boolean;
  refreshToken?: number;
  preferredSessionId?: string | null;
};

type SessionRuntime = {
  fitAddon: FitAddon;
  socket: WebSocket;
  terminal: Terminal;
};

type SessionHostMap = Record<string, HTMLDivElement | null>;

export const TerminalPanel = memo(function TerminalPanel({
  active,
  refreshToken = 0,
  preferredSessionId = null,
}: TerminalPanelProps) {
  const { resolvedTheme } = useTheme();
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hostsRef = useRef<SessionHostMap>({});
  const runtimesRef = useRef<Map<string, SessionRuntime>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const response = await listTerminalSessions();
        setSessions(response.items);
        setActiveSessionId((current) => {
          if (
            preferredSessionId &&
            response.items.some((session) => session.id === preferredSessionId)
          ) {
            return preferredSessionId;
          }

          return current ?? response.items[0]?.id ?? null;
        });
        setError(null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load terminal sessions.",
        );
      }
    };

    void loadSessions();
  }, [preferredSessionId, refreshToken]);

  useEffect(() => {
    if (!sessions.some((session) => session.id === activeSessionId)) {
      setActiveSessionId(sessions[0]?.id ?? null);
    }
  }, [activeSessionId, sessions]);

  useEffect(() => {
    if (preferredSessionId || !active || sessions.length > 0 || isCreatingSession) {
      return;
    }

    void handleCreateSession();
  }, [active, isCreatingSession, preferredSessionId, sessions.length]);

  useEffect(() => {
    for (const session of sessions) {
      const host = hostsRef.current[session.id];
      if (!host || runtimesRef.current.has(session.id)) {
        continue;
      }

      const runtime = createSessionRuntime(session.id, host, resolvedTheme);
      runtimesRef.current.set(session.id, runtime);
    }

    const knownSessionIds = new Set(sessions.map((session) => session.id));
    for (const [sessionId, runtime] of runtimesRef.current.entries()) {
      if (knownSessionIds.has(sessionId)) {
        continue;
      }

      runtime.socket.close();
      runtime.terminal.dispose();
      runtimesRef.current.delete(sessionId);
    }
  }, [resolvedTheme, sessions]);

  useEffect(() => {
    const theme = getTerminalTheme(resolvedTheme);
    for (const runtime of runtimesRef.current.values()) {
      runtime.terminal.options.theme = theme;
    }
  }, [resolvedTheme]);

  useEffect(() => {
    if (!activeSessionId || !active) {
      return;
    }

    const runtime = runtimesRef.current.get(activeSessionId);
    if (!runtime) {
      return;
    }

    window.requestAnimationFrame(() => {
      runtime.fitAddon.fit();
      runtime.terminal.focus();
    });
  }, [active, activeSessionId, sessions]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const fitActiveTerminal = () => {
      if (!activeSessionId) {
        return;
      }

      const runtime = runtimesRef.current.get(activeSessionId);
      runtime?.fitAddon.fit();
    };

    window.addEventListener("resize", fitActiveTerminal);
    return () => {
      window.removeEventListener("resize", fitActiveTerminal);
    };
  }, [active, activeSessionId]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (!activeSessionId || !active) {
        return;
      }

      const runtime = runtimesRef.current.get(activeSessionId);
      runtime?.fitAddon.fit();
    });

    resizeObserverRef.current = observer;
    for (const host of Object.values(hostsRef.current)) {
      if (host) {
        observer.observe(host);
      }
    }

    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
    };
  }, [active, activeSessionId, sessions]);

  useEffect(() => {
    return () => {
      for (const runtime of runtimesRef.current.values()) {
        runtime.socket.close();
        runtime.terminal.dispose();
      }
      runtimesRef.current.clear();
      resizeObserverRef.current?.disconnect();
    };
  }, []);

  const setSessionHost = (sessionId: string, host: HTMLDivElement | null) => {
    const previousHost = hostsRef.current[sessionId];
    if (previousHost === host) {
      return;
    }

    if (previousHost) {
      resizeObserverRef.current?.unobserve(previousHost);
    }

    hostsRef.current[sessionId] = host;
    if (!host) {
      return;
    }

    resizeObserverRef.current?.observe(host);

    const runtime = runtimesRef.current.get(sessionId);
    if (runtime) {
      window.requestAnimationFrame(() => runtime.fitAddon.fit());
      return;
    }

    const nextRuntime = createSessionRuntime(sessionId, host, resolvedTheme);
    runtimesRef.current.set(sessionId, nextRuntime);
  };

  const handleCreateSession = async () => {
    if (isCreatingSession) {
      return;
    }

    setIsCreatingSession(true);
    try {
      const response = await createTerminalSession({ type: "local" });
      setSessions((current) => [...current, response.item]);
      setActiveSessionId(response.item.id);
      setError(null);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create a terminal session.",
      );
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    const currentIndex = sessions.findIndex((session) => session.id === sessionId);
    const nextActiveSessionId =
      activeSessionId !== sessionId
        ? activeSessionId
        : sessions[currentIndex + 1]?.id ?? sessions[currentIndex - 1]?.id ?? null;

    try {
      await closeTerminalSession(sessionId);
      const runtime = runtimesRef.current.get(sessionId);
      if (runtime) {
        runtime.socket.close();
        runtime.terminal.dispose();
        runtimesRef.current.delete(sessionId);
      }

      setSessions((current) => current.filter((session) => session.id !== sessionId));
      setActiveSessionId(nextActiveSessionId);
      setError(null);
    } catch (closeError) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : "Unable to close the terminal session.",
      );
    }
  };

  return (
    <div className="h-full w-full bg-panel">
      <div className="flex h-full flex-col overflow-hidden bg-panel">
        <div className="border-b border-line bg-window-chrome/80 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;

              return (
                <div
                  key={session.id}
                  className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
                    isActive
                      ? "border-accent/45 bg-accent/12 text-ink"
                      : "border-line bg-surface/80 text-muted hover:border-line-strong/40 hover:bg-surface"
                  }`}
                >
                  <button
                    className="max-w-[11rem] truncate text-left"
                    onClick={() => setActiveSessionId(session.id)}
                    type="button"
                  >
                    {session.title}
                  </button>
                  <button
                    aria-label={`Close ${session.title}`}
                    className="rounded-md px-1 text-muted transition hover:bg-surface hover:text-ink"
                    onClick={() => void handleCloseSession(session.id)}
                    type="button"
                  >
                    x
                  </button>
                </div>
              );
            })}

            <button
              aria-label="Open new terminal session"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dashed border-accent/35 bg-accent/10 text-lg leading-none text-accent transition hover:border-accent/55 hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCreatingSession}
              onClick={() => void handleCreateSession()}
              type="button"
            >
              {isCreatingSession ? (
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                  ...
                </span>
              ) : (
                "+"
              )}
            </button>
          </div>
        </div>

        {error ? (
          <div className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger-ink">
            {error}
          </div>
        ) : null}

        <div className="relative flex-1 px-3 pb-3 pt-3">
          {sessions.length === 0 && !isCreatingSession ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-line bg-surface/70 text-sm text-muted">
              No terminal sessions yet.
            </div>
          ) : null}

          {sessions.map((session) => (
            <div
              key={session.id}
              className={`absolute inset-3 ${session.id === activeSessionId ? "block" : "hidden"}`}
            >
              <div
                className="h-full w-full"
                ref={(host) => setSessionHost(session.id, host)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

function createSessionRuntime(
  sessionId: string,
  host: HTMLDivElement,
  resolvedTheme: ResolvedTheme,
): SessionRuntime {
  host.innerHTML = "";

  const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: 13,
    theme: getTerminalTheme(resolvedTheme),
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(host);
  fitAddon.fit();
  terminal.writeln("Nortem Portal terminal connecting...");

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(
    `${protocol}//${window.location.host}/ws/terminal/${sessionId}`,
  );

  socket.addEventListener("open", () => {
    terminal.writeln("\r\nConnected.\r\n");
    terminal.focus();
  });

  socket.addEventListener("message", (event) => {
    terminal.write(String(event.data));
  });

  socket.addEventListener("close", () => {
    terminal.writeln("\r\nSession closed.");
  });

  socket.addEventListener("error", () => {
    terminal.writeln("\r\nConnection error.");
  });

  terminal.onData((data) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  });

  return {
    fitAddon,
    socket,
    terminal,
  };
}
