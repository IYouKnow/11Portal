export type User = {
  id: number;
  email: string;
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
  };
  stats: {
    workspaceCount: number;
    terminalStatus: string;
    remoteDesktop: string;
  };
};

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

export async function openBrowserRuntime() {
  return request<{ ok: boolean }>("/api/v1/browser/open", {
    method: "POST",
  });
}

export async function closeBrowserRuntime() {
  return request<{ ok: boolean }>("/api/v1/browser/close", {
    method: "POST",
  });
}
