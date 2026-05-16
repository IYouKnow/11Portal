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

    host.innerHTML = "";

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

    socket.addEventListener("open", () => {
      terminal.writeln("\r\nConnected. Type commands directly (e.g. ssh user@host).\r\n");
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

    const onTerminalInput = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    const onResize = () => fitAddon.fit();
    window.addEventListener("resize", onResize);

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

  return (
    <div className="h-[calc(100%-32px)] w-full bg-[#05070c]">
      <div className="flex h-full flex-col overflow-hidden bg-[#05070c]">
        <div className="h-full w-full px-3 pb-3 pt-3">
          <div className="h-full w-full" ref={hostRef} />
        </div>
      </div>
    </div>
  );
}
