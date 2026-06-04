import { type FormEvent, useEffect, useState } from "react";
import { Link2, Monitor, TerminalSquare } from "lucide-react";
import type {
  RemoteDesktopShortcutConfig,
  ShortcutDefinition,
  ShortcutKind,
} from "./dashboard/types";

type ShortcutPanelProps = {
  editingShortcut: ShortcutDefinition | null;
  onSaveShortcut: (payload: {
    shortcutId: string | null;
    name: string;
    kind: ShortcutKind;
    url: string;
    iconUrl: string;
    remoteDesktop?: RemoteDesktopShortcutConfig;
  }) => Promise<void> | void;
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
  const [kind, setKind] = useState<ShortcutKind>("browser");
  const [url, setUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [remoteProfileName, setRemoteProfileName] = useState("");
  const [remoteHost, setRemoteHost] = useState("");
  const [remotePort, setRemotePort] = useState("3389");
  const [remoteDomain, setRemoteDomain] = useState("");
  const [remoteIgnoreCert, setRemoteIgnoreCert] = useState(true);
  const [remoteSessionUsername, setRemoteSessionUsername] = useState("");
  const [remotePassword, setRemotePassword] = useState("");

  useEffect(() => {
    if (!editingShortcut) {
      setName("");
      setKind("browser");
      setUrl("");
      setIconUrl("");
      setRemoteProfileName("");
      setRemoteHost("");
      setRemotePort("3389");
      setRemoteDomain("");
      setRemoteIgnoreCert(true);
      setRemoteSessionUsername("");
      setRemotePassword("");
      setError(null);
      return;
    }

    setName(editingShortcut.name);
    setKind(editingShortcut.kind);
    setUrl(editingShortcut.url);
    setIconUrl(editingShortcut.iconUrl);
    setRemoteProfileName(editingShortcut.remoteDesktop?.profileName ?? editingShortcut.name);
    setRemoteHost(editingShortcut.remoteDesktop?.host ?? "");
    setRemotePort(String(editingShortcut.remoteDesktop?.port ?? 3389));
    setRemoteDomain(editingShortcut.remoteDesktop?.domain ?? "");
    setRemoteIgnoreCert(editingShortcut.remoteDesktop?.ignoreCert ?? true);
    setRemoteSessionUsername(editingShortcut.remoteDesktop?.sessionUsername ?? "");
    setRemotePassword(editingShortcut.remoteDesktop?.password ?? "");
    setError(null);
  }, [editingShortcut]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      let shortcutValue = "";
      let remoteDesktop: RemoteDesktopShortcutConfig | undefined;

      if (kind === "terminal") {
        shortcutValue = url.trim();
        if (!shortcutValue) {
          throw new Error("Enter a command.");
        }
      } else if (kind === "browser") {
        shortcutValue = normalizeUrl(url);
        if (!shortcutValue) {
          throw new Error("Enter a valid link.");
        }
      } else {
        const profileName = remoteProfileName.trim();
        const host = remoteHost.trim();
        const domain = remoteDomain.trim();
        const sessionUsername = remoteSessionUsername.trim();
        const password = remotePassword;
        const port = Number.parseInt(remotePort, 10) || 3389;

        if (!profileName) {
          throw new Error("Enter a profile name.");
        }
        if (!host) {
          throw new Error("Enter a host or IP address.");
        }
        if (!sessionUsername) {
          throw new Error("Enter the session username.");
        }
        if (!password) {
          throw new Error("Enter the session password.");
        }

        remoteDesktop = {
          profileName,
          host,
          port,
          domain,
          ignoreCert: remoteIgnoreCert,
          sessionUsername,
          password,
        };
        shortcutValue = "";
      }

      const normalizedIconUrl = normalizeUrl(iconUrl);
      const trimmedName =
        name.trim() ||
        (kind === "terminal"
          ? "Terminal shortcut"
          : kind === "remoteDesktop"
            ? "Remote Desktop shortcut"
            : "Browser shortcut");

      await onSaveShortcut({
        shortcutId: editingShortcut?.id ?? null,
        name: trimmedName,
        kind,
        url: shortcutValue,
        iconUrl: normalizedIconUrl,
        remoteDesktop,
      });

      if (!editingShortcut) {
        setName("");
        setKind("browser");
        setUrl("");
        setIconUrl("");
        setRemoteProfileName("");
        setRemoteHost("");
        setRemotePort("3389");
        setRemoteDomain("");
        setRemoteIgnoreCert(true);
        setRemoteSessionUsername("");
        setRemotePassword("");
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save shortcut.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <form
          className="space-y-3 rounded-[1.35rem] border border-line bg-panel/80 p-3.5 shadow-soft"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.26em] text-muted">
              Name
            </span>
            <input
              className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition focus:border-accent/60"
              onChange={(event) => setName(event.target.value)}
              placeholder="My shortcut"
              value={name}
            />
          </label>

          <div>
            <span className="mb-2 block text-[10px] uppercase tracking-[0.26em] text-muted">
              Type
            </span>
            <div className="grid gap-2 sm:grid-cols-3">
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
                {
                  id: "remoteDesktop" as const,
                  label: "Remote Desktop",
                  description: "Save host, domain, and credentials.",
                  icon: Monitor,
                },
              ].map((choice) => {
                const isSelected = choice.id === kind;
                const Icon = choice.icon;

                return (
                  <button
                    key={choice.id}
                    className={`flex min-h-20 items-start gap-2 rounded-[1rem] border px-3 py-2.5 text-left transition ${
                      isSelected
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-line bg-surface/70 hover:border-line-strong/40 hover:bg-surface"
                    }`}
                    onClick={() => setKind(choice.id)}
                    type="button"
                  >
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${isSelected ? "text-accent" : "text-muted"}`}
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

          {kind === "remoteDesktop" ? (
            <div className="space-y-3 rounded-[1.1rem] border border-line bg-surface/50 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.26em] text-muted">
                    Profile name
                  </span>
                  <input
                    className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
                    onChange={(event) => setRemoteProfileName(event.target.value)}
                    placeholder="Production Windows Server"
                    value={remoteProfileName}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.26em] text-muted">
                    Host
                  </span>
                  <input
                    className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
                    onChange={(event) => setRemoteHost(event.target.value)}
                    placeholder="192.168.0.10"
                    value={remoteHost}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.26em] text-muted">
                    Port
                  </span>
                  <input
                    className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
                    onChange={(event) => setRemotePort(event.target.value)}
                    placeholder="3389"
                    value={remotePort}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.26em] text-muted">
                    Domain
                  </span>
                  <input
                    className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
                    onChange={(event) => setRemoteDomain(event.target.value)}
                    placeholder="Nortem"
                    value={remoteDomain}
                  />
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-line bg-panel/70 px-3 py-2 text-sm text-ink sm:col-span-2">
                  <input
                    checked={remoteIgnoreCert}
                    className="h-4 w-4 accent-accent"
                    onChange={(event) => setRemoteIgnoreCert(event.target.checked)}
                    type="checkbox"
                  />
                  Ignore invalid RDP certificates
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.26em] text-muted">
                    Session username
                  </span>
                  <input
                    className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
                    onChange={(event) => setRemoteSessionUsername(event.target.value)}
                    placeholder="Administrator"
                    value={remoteSessionUsername}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.26em] text-muted">
                    Session password
                  </span>
                  <input
                    className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
                    onChange={(event) => setRemotePassword(event.target.value)}
                    placeholder="Password"
                    type="password"
                    value={remotePassword}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.26em] text-muted">
                  {kind === "terminal" ? "Command" : "Link"}
                </span>
                <input
                  className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={kind === "terminal" ? "ping 192.168.0.1" : "https://example.com"}
                  value={url}
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.26em] text-muted">
              Icon URL
              <span className="ml-2 text-[9px] tracking-[0.22em] text-muted/80">
                optional
              </span>
            </span>
            <input
              className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
              onChange={(event) => setIconUrl(event.target.value)}
              placeholder="https://example.com/icon.png"
              value={iconUrl}
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="h-9 flex-1 rounded-xl border border-accent/30 bg-accent/10 px-4 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              type="submit"
            >
              {isSaving
                ? "Saving..."
                : editingShortcut
                  ? "Save shortcut"
                  : "Create shortcut"}
            </button>

            {editingShortcut ? (
              <button
                className="h-9 rounded-xl border border-line bg-surface/70 px-4 text-sm font-medium text-ink transition hover:bg-surface sm:w-32"
                onClick={onCancelEdit}
                type="button"
              >
                Cancel
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger-ink">
              {error}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
