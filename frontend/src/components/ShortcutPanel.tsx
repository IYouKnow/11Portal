import { FormEvent, useEffect, useState } from "react";
import { Link2, TerminalSquare } from "lucide-react";
import type { ShortcutDefinition } from "./dashboard/types";

type ShortcutPanelProps = {
  editingShortcut: ShortcutDefinition | null;
  onSaveShortcut: (payload: {
    shortcutId: string | null;
    name: string;
    kind: "browser" | "terminal";
    url: string;
    iconUrl: string;
  }) => void;
  onCancelEdit: () => void;
};

function normalizeUrl(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return "";
    }
  }
}

export function ShortcutPanel({
  editingShortcut,
  onSaveShortcut,
  onCancelEdit,
}: ShortcutPanelProps) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"browser" | "terminal">("browser");
  const [url, setUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingShortcut) {
      setName("");
      setKind("browser");
      setUrl("");
      setIconUrl("");
      setError(null);
      return;
    }

    setName(editingShortcut.name);
    setKind(editingShortcut.kind);
    setUrl(editingShortcut.url);
    setIconUrl(editingShortcut.iconUrl);
    setError(null);
  }, [editingShortcut]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const shortcutValue =
      kind === "terminal" ? url.trim() : normalizeUrl(url);
    if (!shortcutValue) {
      setError(kind === "terminal" ? "Enter a command." : "Enter a valid link.");
      return;
    }

    const normalizedIconUrl = normalizeUrl(iconUrl);

    onSaveShortcut({
      shortcutId: editingShortcut?.id ?? null,
      name: name.trim() || (kind === "terminal" ? "Terminal shortcut" : "Browser shortcut"),
      kind,
      url: shortcutValue,
      iconUrl: normalizedIconUrl,
    });

    if (!editingShortcut) {
      setName("");
      setKind("browser");
      setUrl("");
      setIconUrl("");
    }
    setError(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="border-b border-line bg-[linear-gradient(180deg,rgb(var(--color-panel))_0%,rgb(var(--color-surface))_100%)] px-4 py-3.5">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted">Shortcut</p>
        <h2 className="mt-1.5 text-lg font-medium text-ink">
          {editingShortcut ? "Edit launcher" : "Create a launcher"}
        </h2>
        <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted">
          Pick browser or terminal, then paste the link or command. Add an icon
          image URL if you want, or leave it blank to use the default icon.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.26em] text-muted">
                Name
              </span>
              <input
                className="w-full rounded-xl border border-line bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent/60"
                onChange={(event) => setName(event.target.value)}
                placeholder="My shortcut"
                value={name}
              />
            </label>

            <div>
              <span className="mb-2 block text-[10px] uppercase tracking-[0.26em] text-muted">
                Type
              </span>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    id: "browser" as const,
                    label: "Browser",
                    description: "Open the link in a new tab.",
                    icon: Link2,
                  },
                  {
                    id: "terminal" as const,
                    label: "Terminal",
                    description: "Launch the terminal app.",
                    icon: TerminalSquare,
                  },
                ].map((choice) => {
                  const isSelected = choice.id === kind;
                  const Icon = choice.icon;

                  return (
              <button
                      key={choice.id}
                      className={`flex items-start gap-2 rounded-[1.1rem] border p-3 text-left transition ${
                        isSelected
                          ? "border-accent/40 bg-accent/10"
                          : "border-line bg-surface/70 hover:border-line-strong/40 hover:bg-surface"
                      }`}
                      onClick={() => setKind(choice.id)}
                      type="button"
                    >
                      <Icon
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted"
                        strokeWidth={1.9}
                      />
                      <div>
                        <p className="text-sm font-medium text-ink">{choice.label}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-muted">
                          {choice.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.26em] text-muted">
                {kind === "terminal" ? "Command" : "Link"}
              </span>
              <input
                className="w-full rounded-xl border border-line bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent/60"
                onChange={(event) => setUrl(event.target.value)}
                placeholder={kind === "terminal" ? "ping 192.168.0.1" : "https://example.com"}
                value={url}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.26em] text-muted">
                Icon URL (optional)
              </span>
              <input
                className="w-full rounded-xl border border-line bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent/60"
                onChange={(event) => setIconUrl(event.target.value)}
                placeholder="https://example.com/icon.png"
                value={iconUrl}
              />
            </label>

            <button
              className="w-full rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/20"
              type="submit"
            >
              {editingShortcut ? "Save shortcut" : "Create shortcut"}
            </button>

            {editingShortcut ? (
              <button
                className="w-full rounded-xl border border-line bg-surface/70 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-surface"
                onClick={onCancelEdit}
                type="button"
              >
                Cancel editing
              </button>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger-ink">
                {error}
              </div>
            ) : null}
        </form>
        </div>
      </div>
    </div>
  );
}
