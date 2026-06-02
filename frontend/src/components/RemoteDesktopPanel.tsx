import { FormEvent, useEffect, useState } from "react";
import {
  createRemoteDesktopProfile,
  deleteRemoteDesktopProfile,
  launchRemoteDesktopSession,
  listRemoteDesktopProfiles,
  type RemoteDesktopProfile,
} from "../lib/api";

type RemoteDesktopPanelProps = {
  enabled: boolean;
  gatewayURL: string;
};

export function RemoteDesktopPanel({ enabled, gatewayURL }: RemoteDesktopPanelProps) {
  const [profiles, setProfiles] = useState<RemoteDesktopProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [sessionURL, setSessionURL] = useState("");
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [launchingSession, setLaunchingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("3389");
  const [domain, setDomain] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [ignoreCert, setIgnoreCert] = useState(true);
  const [sessionUsername, setSessionUsername] = useState("");
  const [password, setPassword] = useState("");

  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) ?? null;

  useEffect(() => {
    setSessionURL("");
    setPassword("");
    setSessionUsername(selectedProfile?.username ?? "");
  }, [selectedProfileId, selectedProfile?.username]);

  useEffect(() => {
    let cancelled = false;

    const loadProfiles = async () => {
      setLoadingProfiles(true);
      try {
        const { items } = await listRemoteDesktopProfiles();
        if (cancelled) {
          return;
        }

        setProfiles(items);
        setSelectedProfileId((current) => current ?? items[0]?.id ?? null);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load remote desktop profiles",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingProfiles(false);
        }
      }
    };

    if (enabled) {
      void loadProfiles();
    } else {
      setLoadingProfiles(false);
    }

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    setError(null);

    try {
      const { item } = await createRemoteDesktopProfile({
        name,
        host,
        port: Number.parseInt(port, 10) || 3389,
        domain,
        username: profileUsername,
        ignoreCert,
      });

      setProfiles((current) =>
        [...current, item].sort((left, right) => left.name.localeCompare(right.name)),
      );
      setSelectedProfileId(item.id);
      setName("");
      setHost("");
      setPort("3389");
      setDomain("");
      setProfileUsername("");
      setIgnoreCert(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save remote desktop profile",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteProfile = async (profileId: number) => {
    setError(null);

    try {
      await deleteRemoteDesktopProfile(profileId);
      setProfiles((current) => {
        const nextProfiles = current.filter((profile) => profile.id !== profileId);
        setSelectedProfileId((currentSelected) => {
          if (currentSelected !== profileId) {
            return currentSelected;
          }

          return nextProfiles[0]?.id ?? null;
        });
        return nextProfiles;
      });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete remote desktop profile",
      );
    }
  };

  const handleConnect = async () => {
    if (!selectedProfile) {
      setError("Choose a saved machine first.");
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
      const { url } = await launchRemoteDesktopSession(
        selectedProfile.id,
        sessionUsername.trim(),
        password,
      );
      setSessionURL(url);
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

  const canEmbed = enabled && sessionURL.trim() !== "";

  return (
    <div className="grid h-full grid-cols-[320px_1fr] bg-panel">
      <aside className="flex flex-col border-r border-line bg-panel/95">
        <div className="border-b border-line px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
            Remote Desktop
          </p>
          <h2 className="mt-2 text-lg font-medium text-ink">Windows machines</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Save machine profiles here. Portal handles the Guacamole session behind the
            scenes so users stay inside the native app.
          </p>
        </div>

        <form className="space-y-3 border-b border-line px-5 py-4" onSubmit={handleSaveProfile}>
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-muted">
              Profile name
            </span>
            <input
              className="w-full rounded-2xl border border-line bg-surface-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
              onChange={(event) => setName(event.target.value)}
              placeholder="Production Windows Server"
              value={name}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-muted">
              Host
            </span>
            <input
              className="w-full rounded-2xl border border-line bg-surface-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
              onChange={(event) => setHost(event.target.value)}
              placeholder="10.0.0.25"
              value={host}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-muted">
                Port
              </span>
              <input
                className="w-full rounded-2xl border border-line bg-surface-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
                onChange={(event) => setPort(event.target.value)}
                placeholder="3389"
                value={port}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-muted">
                Domain
              </span>
              <input
                className="w-full rounded-2xl border border-line bg-surface-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
                onChange={(event) => setDomain(event.target.value)}
                placeholder="CONTOSO"
                value={domain}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-muted">
              Default username
            </span>
            <input
              className="w-full rounded-2xl border border-line bg-surface-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
              onChange={(event) => setProfileUsername(event.target.value)}
              placeholder="Administrator"
              value={profileUsername}
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-line bg-panel/70 px-4 py-3 text-sm text-ink">
            <input
              checked={ignoreCert}
              className="h-4 w-4 accent-accent"
              onChange={(event) => setIgnoreCert(event.target.checked)}
              type="checkbox"
            />
            Ignore invalid RDP certificates
          </label>

          <button
            className="w-full rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={savingProfile || !enabled}
            type="submit"
          >
            {savingProfile ? "Saving..." : "Save machine"}
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Profiles</p>
            <span className="rounded-full border border-line bg-surface/80 px-2.5 py-1 text-[11px] text-muted">
              {profiles.length}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {loadingProfiles ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface/70 p-4 text-sm text-muted">
                Loading saved machines...
              </div>
            ) : profiles.length > 0 ? (
              profiles.map((profile) => {
                const isSelected = profile.id === selectedProfileId;

                return (
                  <div
                    key={profile.id}
                    className={`block w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-accent/40 bg-accent/10"
                        : "border-line bg-surface/80 hover:bg-surface"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        className="flex-1 text-left"
                        onClick={() => setSelectedProfileId(profile.id)}
                        type="button"
                      >
                        <p className="text-sm font-medium text-ink">{profile.name}</p>
                        <p className="mt-1 text-xs text-muted">
                          {profile.host}:{profile.port}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {profile.domain ? `${profile.domain}\\` : ""}
                          {profile.username || "Ask for username at connect"}
                        </p>
                      </button>
                      <button
                        className="rounded-xl border border-line bg-panel/70 px-3 py-2 text-xs text-muted transition hover:text-ink"
                        onClick={() => void handleDeleteProfile(profile.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-line bg-surface/70 p-4 text-sm leading-6 text-muted">
                No saved machines yet.
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-window-chrome/80 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Gateway</p>
            <h2 className="mt-1 text-lg font-medium text-ink">
              {selectedProfile ? selectedProfile.name : "Choose a machine"}
            </h2>
          </div>

          {canEmbed ? (
            <a
              className="rounded-2xl border border-line bg-surface/80 px-4 py-2 text-sm text-ink transition hover:bg-surface"
              href={sessionURL}
              rel="noreferrer"
              target="_blank"
            >
              Open full page
            </a>
          ) : null}
        </div>

        {enabled ? (
          <>
            <div className="border-b border-line bg-panel/85 px-5 py-4">
              {selectedProfile ? (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {selectedProfile.host}:{selectedProfile.port}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Domain: {selectedProfile.domain || "None"}
                    </p>
                  </div>

                  <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row">
                    <input
                      className="min-w-[220px] rounded-2xl border border-line bg-surface-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
                      onChange={(event) => setSessionUsername(event.target.value)}
                      placeholder="Username for this session"
                      value={sessionUsername}
                    />
                    <input
                      className="min-w-[240px] rounded-2xl border border-line bg-surface-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Password for this session"
                      type="password"
                      value={password}
                    />
                    <button
                      className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={launchingSession}
                      onClick={() => void handleConnect()}
                      type="button"
                    >
                      {launchingSession ? "Connecting..." : "Connect"}
                    </button>
                    {sessionURL ? (
                      <button
                        className="rounded-2xl border border-line bg-surface/80 px-4 py-3 text-sm text-ink transition hover:bg-surface"
                        onClick={() => setSessionURL("")}
                        type="button"
                      >
                        Disconnect
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted">
                  Select a saved machine to start an RDP session inside Portal.
                </p>
              )}

              {error ? (
                <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-ink">
                  {error}
                </div>
              ) : null}
            </div>

            {sessionURL ? (
              <iframe
                className="h-full w-full border-0 bg-canvas"
                src={sessionURL}
                title="Portal Remote Desktop"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8">
                <div className="max-w-lg rounded-[2rem] border border-line bg-surface/80 p-8 text-center shadow-soft">
                  <h3 className="text-2xl font-medium text-ink">Remote Desktop ready</h3>
                  <p className="mt-3 text-sm leading-7 text-muted">
                    Save a machine, enter credentials at connect time, and Portal will open
                    the Guacamole-backed RDP session right here.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-lg rounded-[2rem] border border-line bg-surface/80 p-8 text-center shadow-soft">
              <h3 className="text-2xl font-medium text-ink">Remote Desktop</h3>
              <p className="mt-3 text-sm leading-7 text-muted">
                Configure Portal&apos;s internal Guacamole gateway to enable native RDP
                sessions in this app.
              </p>
              {gatewayURL ? (
                <p className="mt-3 text-xs text-muted">Gateway path: {gatewayURL}</p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
