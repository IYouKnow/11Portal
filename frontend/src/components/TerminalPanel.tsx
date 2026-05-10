import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TerminalPanelProps = {
  active: boolean;
};

export function TerminalPanel({ active }: TerminalPanelProps) {
  const [lines, setLines] = useState<string[]>([
    "Portal terminal connected.",
    "",
  ]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  const websocketURL = useMemo(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws/terminal`;
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    const socket = new WebSocket(websocketURL);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setStatus("online");
      setLines((current) => [...current, "$ ", ""]);
    });

    socket.addEventListener("message", (event) => {
      setLines((current) => [...current, String(event.data)]);
    });

    socket.addEventListener("close", () => {
      setStatus("offline");
    });

    socket.addEventListener("error", () => {
      setStatus("error");
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [active, websocketURL]);

  useEffect(() => {
    outputRef.current?.scrollTo({
      top: outputRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const nextInput = input.trimEnd();
    socketRef.current.send(`${nextInput}\n`);
    setLines((current) => [...current, `> ${nextInput}`]);
    setInput("");
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/80 p-5 shadow-soft backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-ink">Terminal</h2>
          <p className="text-sm text-muted">
            Interactive shell session over WebSocket.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted">
          {status}
        </span>
      </div>

      <div
        ref={outputRef}
        className="terminal-scrollbar h-[360px] overflow-y-auto rounded-2xl border border-white/10 bg-black/50 p-4 font-mono text-sm leading-6 text-slate-200"
      >
        {lines.map((line, index) => (
          <pre key={`${line}-${index}`} className="m-0 whitespace-pre-wrap">
            {line}
          </pre>
        ))}
      </div>

      <form className="mt-4 flex gap-3" onSubmit={submit}>
        <input
          className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Enter command"
        />
        <button
          className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent transition hover:bg-accent/20"
          type="submit"
        >
          Send
        </button>
      </form>
    </section>
  );
}

