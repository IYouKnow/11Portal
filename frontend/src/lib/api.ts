export type User = {
  id: number;
  email: string;
  role: "admin" | "user";
  createdAt: string;
};

export type Workspace = {
  id: number;
  name: string;
  slug: string;
  description: string;
  status: string;
};

export type Overview = {
  platform: {
    name: string;
    publicURL: string;
    workspacesRoot: string;
    runtime: string;
    chromiumURL: string;
    remoteDesktopGatewayURL: string;
    remoteDesktopEnabled: boolean;
  };
  stats: {
    workspaceCount: number;
    terminalStatus: string;
    remoteDesktop: string;
  };
};

export type NetworkScanItem = {
  ip: string;
  hostname: string;
  mac: string;
};

export type NetworkScanSummary = {
  scannedCidrs: string[];
  skippedCidrs: string[];
  totalIps: number;
};

export type NetworkScanResponse = {
  items: NetworkScanItem[];
  summary: NetworkScanSummary;
};

export type RemoteDesktopProfile = {
  id: number;
  userId: number;
  name: string;
  host: string;
  port: number;
  domain: string;
  username: string;
  ignoreCert: boolean;
  createdAt: string;
};

export type Note = {
  id: number;
  userId: number;
  title: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type TerminalSession = {
  id: string;
  type: "local" | "ssh";
  ownerUserId: number;
  title: string;
  createdAt: string;
  lastActiveAt: string;
};

export type SshConnectPayload = {
  host: string;
  port: number;
  username: string;
  authType: "password" | "private_key";
  password?: string;
  privateKey?: string;
  passphrase?: string;
};

export type CreateSessionRequest =
  | { type: "local"; command?: string }
  | { type: "ssh"; ssh: SshConnectPayload };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function login(email: string, password: string) {
  return request<{ user: User }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  return request<void>("/api/v1/auth/logout", {
    method: "POST",
  });
}

export async function getCurrentUser() {
  return request<{ user: User }>("/api/v1/auth/me");
}

export async function getOverview() {
  return request<Overview>("/api/v1/system/overview");
}

export async function getWorkspaces() {
  return request<{ items: Workspace[] }>("/api/v1/workspaces");
}

export async function listUsers() {
  return request<{ items: User[] }>("/api/v1/users");
}

export async function createUser(email: string, password: string, role: User["role"]) {
  return request<{ user: User }>("/api/v1/users", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
}

export async function openBrowserRuntime() {
  return request<{ ok: boolean; started: boolean }>("/api/v1/browser/open", {
    method: "POST",
  });
}

export async function closeBrowserRuntime() {
  return request<{ ok: boolean }>("/api/v1/browser/close", {
    method: "POST",
  });
}

export async function createTerminalSession(payload: CreateSessionRequest) {
  return request<{ item: TerminalSession }>("/api/v1/terminal/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listTerminalSessions() {
  return request<{ items: TerminalSession[] }>("/api/v1/terminal/sessions");
}

export async function closeTerminalSession(sessionId: string) {
  return request<{ ok: boolean }>(`/api/v1/terminal/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export async function listRemoteDesktopProfiles() {
  return request<{ items: RemoteDesktopProfile[] }>("/api/v1/remote-desktop/profiles");
}

export async function createRemoteDesktopProfile(payload: {
  name: string;
  host: string;
  port: number;
  domain: string;
  username: string;
  ignoreCert: boolean;
}) {
  return request<{ item: RemoteDesktopProfile }>("/api/v1/remote-desktop/profiles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteRemoteDesktopProfile(profileId: number) {
  return request<{ ok: boolean }>(`/api/v1/remote-desktop/profiles/${profileId}`, {
    method: "DELETE",
  });
}

export async function launchRemoteDesktopSession(
  profileId: number,
  username: string,
  password: string,
) {
  return request<{ url: string }>("/api/v1/remote-desktop/launch", {
    method: "POST",
    body: JSON.stringify({ profileId, username, password }),
  });
}

export async function scanNetwork(cidrs: string[] = []) {
  return request<NetworkScanResponse>("/api/v1/network/scan", {
    method: "POST",
    body: JSON.stringify({ cidrs }),
  });
}

export async function listNotes() {
  return request<{ items: Note[] }>("/api/v1/notes");
}

export async function createNote(payload: { title?: string; text?: string } = {}) {
  return request<{ item: Note }>("/api/v1/notes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateNote(
  noteId: number,
  payload: { title?: string; text?: string },
) {
  return request<{ item: Note }>(`/api/v1/notes/${noteId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteNote(noteId: number) {
  return request<{ ok: boolean }>(`/api/v1/notes/${noteId}`, {
    method: "DELETE",
  });
}
