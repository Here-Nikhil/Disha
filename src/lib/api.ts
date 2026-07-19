const BASE = import.meta.env.VITE_API_URL ?? "https://intellicode-navigator-production.up.railway.app";

let _token: string | null = null;
let _refreshFn: (() => Promise<string | null>) | null = null;

export function setAuthToken(token: string) {
  _token = token;
}

export function setTokenRefresher(fn: () => Promise<string | null>) {
  _refreshFn = fn;
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  if (_refreshFn) {
    try {
      const fresh = await _refreshFn();
      if (fresh) _token = fresh;
    } catch {
      // keep existing _token
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (_token) {
    headers["Authorization"] = `Bearer ${_token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const api = {
  getWorkspaces: () => req<any[]>("/workspaces"),
  createWorkspace: (name: string) =>
    req<any>("/workspaces", { method: "POST", body: JSON.stringify({ name }) }),
  deleteWorkspace: (id: string) =>
    req<any>(`/workspaces/${id}`, { method: "DELETE" }),
  getMessages: (workspaceId: string) =>
    req<any[]>(`/workspaces/${workspaceId}/messages`),
  sendMessage: (workspaceId: string, content: string) =>
    req<any>(`/workspaces/${workspaceId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  getTools: () => req<any[]>("/tools"),
  getPrompts: (workspaceId?: string) =>
    req<any[]>(`/prompts${workspaceId ? `?workspace_id=${workspaceId}` : ""}`),
  generatePrompt: (toolId: string, workspaceId: string, platform: string) =>
    req<any>(`/tools/${toolId}/generate-prompt`, {
      method: "POST",
      body: JSON.stringify({ workspace_id: workspaceId, platform }),
    }),
  getApiKeys: () => req<any[]>("/settings/api-keys"),
  saveApiKey: (provider: string, key: string) =>
    req<any>("/settings/api-keys", {
      method: "POST",
      body: JSON.stringify({ provider, api_key: key }),
    }),
};