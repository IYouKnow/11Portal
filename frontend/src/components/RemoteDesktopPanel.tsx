import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  createRemoteDesktopProfile,
  launchRemoteDesktopSession,
} from "../lib/api";

type RemoteDesktopPanelProps = {
  enabled: boolean;
  gatewayURL: string;
  launchRequest?: {
    id: number;
    profileId: number;
    username: string;
    password: string;
  } | null;
  onLaunchHandled?: () => void;
};

type RemoteDesktopTab = {
  id: string;
  profileId: number;
  profileName: string;
  sessionUsername: string;
  url: string;
};

function createTabId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `remote-tab-${crypto.randomUUID()}`;
  }

  return `remote-tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function RemoteDesktopPanel({
  enabled,
  gatewayURL,
  launchRequest = null,
  onLaunchHandled,
}: RemoteDesktopPanelProps) {
  const [tabs, setTabs] = useState<RemoteDesktopTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [launchingSession, setLaunchingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("3389");
  const [domain, setDomain] = useState("");
  const [ignoreCert, setIgnoreCert] = useState(true);
  const [sessionUsername, setSessionUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const handledLaunchRequestId = useRef<number | null>(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null,
    [activeTabId, tabs],
  );

  useEffect(() => {
    if (tabs.length === 0) {
      if (activeTabId !== null) {
        setActiveTabId(null);
      }
      return;
    }

    if (!activeTabId || !tabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(tabs[tabs.length - 1]?.id ?? null);
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    if (!enabled || !launchRequest) {
      return;
    }

    if (handledLaunchRequestId.current === launchRequest.id || launchingSession) {
      return;
    }

    handledLaunchRequestId.current = launchRequest.id;

    const launchSession = async () => {
      setLaunchingSession(true);
      setError(null);

      try {
        const { url } = await launchRemoteDesktopSession(
          launchRequest.profileId,
          launchRequest.username.trim(),
          launchRequest.password,
        );

        const tabId = createTabId();
        setTabs((current) => [
          ...current,
          {
            id: tabId,
            profileId: launchRequest.profileId,
            profileName: `Profile ${launchRequest.profileId}`,
            sessionUsername: launchRequest.username.trim(),
            url,
          },
        ]);
        setActiveTabId(tabId);
      } catch (launchError) {
        setError(
          launchError instanceof Error
            ? launchError.message
            : "Failed to open remote desktop session",
        );
      } finally {
        setLaunchingSession(false);
        onLaunchHandled?.();
      }
    };

    void launchSession();
  }, [enabled, launchRequest, launchingSession, onLaunchHandled]);

  const handleConnect = async () => {
    const trimmedHost = host.trim();
    const trimmedSessionUsername = sessionUsername.trim();
    const trimmedDomain = domain.trim();
    const profileName = trimmedHost || "Remote Desktop";

    if (!trimmedHost) {
      setError("Enter a host or IP address.");
      return;
    }
    if (!sessionUsername.trim()) {
      setError("Enter a username for this session.");
      return;
    }

    if (!password) {
      setError("Enter a password for this session.");
      return;
    }

    setLaunchingSession(true);
    setError(null);

    try {
      const { item } = await createRemoteDesktopProfile({
        name: profileName,
        host: trimmedHost,
        port: Number.parseInt(port, 10) || 3389,
        domain: trimmedDomain,
        username: trimmedSessionUsername,
        ignoreCert,
      });

      const { url } = await launchRemoteDesktopSession(
        item.id,
        trimmedSessionUsername,
        password,
      );

      const tabId = createTabId();
      setTabs((current) => [
        ...current,
        {
          id: tabId,
          profileId: item.id,
          profileName,
          sessionUsername: trimmedSessionUsername,
          url,
        },
      ]);
      setActiveTabId(tabId);
      setPassword("");
    } catch (launchError) {
      setError(
        launchError instanceof Error
          ? launchError.message
          : "Failed to open remote desktop session",
      );
    } finally {
      setLaunchingSession(false);
    }
  };

  const handleCloseTab = (tabId: string) => {
    setTabs((current) => {
      const closingIndex = current.findIndex((tab) => tab.id === tabId);
      const nextTabs = current.filter((tab) => tab.id !== tabId);

      if (activeTabId === tabId) {
        const fallback =
          nextTabs[closingIndex] ?? nextTabs[closingIndex - 1] ?? nextTabs[0] ?? null;
        setActiveTabId(fallback?.id ?? null);
      }

      return nextTabs;
    });
  };

  const canOpenFullPage = enabled && activeTab !== null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[auto_minmax(0,1fr)]">
        <aside
          className={`flex min-h-0 flex-col border-b border-line bg-panel/95 transition-[width] duration-200 xl:border-b-0 xl:border-r ${
            sidebarCollapsed ? "xl:w-[56px]" : "xl:w-[260px]"
          }`}
        >
          <div className="flex items-center justify-end border-b border-line px-3 py-2.5">
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface/80 text-muted transition hover:bg-surface hover:text-ink"
              onClick={() => setSidebarCollapsed((current) => !current)}
              type="button"
              aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
              title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {sidebarCollapsed ? (
            <div className="flex flex-1 items-start justify-center p-2 pt-3 xl:items-center">
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface/80 text-muted transition hover:bg-surface hover:text-ink"
                onClick={() => setSidebarCollapsed(false)}
                type="button"
                aria-label="Open sidebar"
                title="Open sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <form
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3.5 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleConnect();
              }}
            >
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-muted">
                    Host
                  </span>
                  <input
                    className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
                    onChange={(event) => setHost(event.target.value)}
                    placeholder="192.168.0.10"
                    value={host}
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <label className="block">
                    <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-muted">
                      Port
                    </span>
                    <input
                      className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
                      onChange={(event) => setPort(event.target.value)}
                      placeholder="3389"
                      value={port}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-muted">
                      Domain
                    </span>
                    <input
                      className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
                      onChange={(event) => setDomain(event.target.value)}
                      placeholder="Nortem"
                      value={domain}
                    />
                  </label>
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-line bg-panel/70 px-3 py-2 text-sm text-ink">
                  <input
                    checked={ignoreCert}
                    className="h-4 w-4 accent-accent"
                    onChange={(event) => setIgnoreCert(event.target.checked)}
                    type="checkbox"
                  />
                  Ignore invalid RDP certificates
                </label>

                <label className="block">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-muted">
                    Session username
                  </span>
                  <input
                    className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
                    onChange={(event) => setSessionUsername(event.target.value)}
                    placeholder="Administrator"
                    value={sessionUsername}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-muted">
                    Session password
                  </span>
                  <input
                    className="h-9 w-full rounded-xl border border-line bg-surface-soft px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    type="password"
                    value={password}
                  />
                </label>
              </div>

              <div className="mt-auto space-y-2">
                <button
                  className="h-9 w-full rounded-xl border border-accent/30 bg-accent/10 px-4 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={launchingSession || !enabled}
                  type="submit"
                >
                  {launchingSession ? "Opening..." : "Open tab"}
                </button>

                {error ? (
                  <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-ink">
                    {error}
                  </div>
                ) : null}
              </div>
            </form>
          )}
        </aside>

        <div className="flex min-h-0 flex-col bg-window">
          <div className="flex items-center gap-3 border-b border-line bg-window-chrome/80 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 overflow-x-auto pr-2">
                {tabs.length > 0 ? (
                  tabs.map((tab) => {
                    const isActive = tab.id === activeTabId;

                    return (
                      <button
                        key={tab.id}
                        className={`group inline-flex max-w-[18rem] shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "border-accent/35 bg-accent/10 text-accent"
                            : "border-line bg-surface/75 text-muted hover:bg-surface hover:text-ink"
                        }`}
                        onClick={() => setActiveTabId(tab.id)}
                        title={`${tab.profileName} | ${tab.sessionUsername}`}
                        type="button"
                      >
                        <span className="min-w-0 truncate">{tab.profileName}</span>
                        <span className="hidden rounded-full border border-current/20 bg-current/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] sm:inline-flex">
                          {tab.sessionUsername}
                        </span>
                        <span
                          aria-hidden="true"
                          className="ml-0.5 text-base leading-none opacity-60 transition group-hover:opacity-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCloseTab(tab.id);
                          }}
                        >
                          x
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-full border border-dashed border-line bg-surface/60 px-3 py-2 text-sm text-muted">
                    No active sessions
                  </div>
                )}
              </div>
            </div>

            {canOpenFullPage ? (
              <a
                className="rounded-full border border-line bg-surface/80 px-3 py-1.5 text-sm text-ink transition hover:bg-surface"
                href={activeTab?.url}
                rel="noreferrer"
                target="_blank"
              >
                Open full page
              </a>
            ) : null}
          </div>

          {enabled ? (
            <div className="relative min-h-0 flex-1 bg-canvas">
              {tabs.length > 0 ? (
                tabs.map((tab) => {
                  const isActive = tab.id === activeTabId;

                  return (
                    <iframe
                      key={tab.id}
                      aria-hidden={!isActive}
                      className={`absolute inset-0 h-full w-full border-0 bg-canvas ${
                        isActive ? "opacity-100" : "pointer-events-none opacity-0"
                      }`}
                      src={tab.url}
                      title={`Nortem Portal Remote Desktop - ${tab.profileName}`}
                    />
                  );
                })
              ) : (
                <div className="flex h-full items-center justify-center p-8">
                  <div className="max-w-lg rounded-[2rem] border border-line bg-surface/80 p-8 text-center shadow-soft">
                    <h3 className="text-2xl font-medium text-ink">
                      Remote Desktop ready
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-muted">
                      Enter connection details on the left and open multiple remote
                      sessions as tabs.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <div className="max-w-lg rounded-[2rem] border border-line bg-surface/80 p-8 text-center shadow-soft">
                <h3 className="text-2xl font-medium text-ink">Remote Desktop</h3>
                <p className="mt-3 text-sm leading-7 text-muted">
                  Configure Nortem Portal&apos;s internal Guacamole gateway to enable
                  native RDP sessions in this app.
                </p>
                {gatewayURL ? (
                  <p className="mt-3 text-xs text-muted">Gateway path: {gatewayURL}</p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
