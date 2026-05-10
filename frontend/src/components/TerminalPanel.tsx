import { useEffect, useMemo, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

type TerminalPanelProps = {
  active: boolean;
};

export function TerminalPanel({ active }: TerminalPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const websocketURL = useMemo(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws/terminal`;
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    const host = hostRef.current;
    if (!host) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: "Consolas, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: "#030712",
        foreground: "#e2e8f0",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);
    fitAddon.fit();
    terminal.writeln("Portal terminal connecting...");

    const socket = new WebSocket(websocketURL);
    socketRef.current = socket;
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    socket.addEventListener("open", () => terminal.writeln("\r\nConnected.\r\n"));
    socket.addEventListener("message", (event) => terminal.write(String(event.data)));
    socket.addEventListener("close", () => terminal.writeln("\r\nSession closed."));
    socket.addEventListener("error", () => terminal.writeln("\r\nConnection error."));

    const onTerminalInput = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    const onResize = () => fitAddon.fit();
    window.addEventListener("resize", onResize);

    // Keep websocket alive while terminal app is open/minimized.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fitAddon.fit();
      }
    }, 1200);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", onResize);
      onTerminalInput.dispose();
      socket.close();
      terminal.dispose();
      socketRef.current = null;
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [active, websocketURL]);

  useEffect(() => {
    if (!active) {
      return;
    }

    fitAddonRef.current?.fit();
    terminalRef.current?.focus();
  }, [active]);

  return (
    <div className="h-[calc(100%-32px)] w-full bg-black p-2">
      <div className="h-full w-full rounded-lg border border-white/10 bg-black/80 p-2">
        <div className="h-full w-full" ref={hostRef} />
      </div>
    </div>
  );
}
