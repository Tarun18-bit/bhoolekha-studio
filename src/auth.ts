// Session handling: the token is attached to every /api call, and a 401 sends the
// user back to the login screen. Roles are enforced on the server; the UI only hides
// buttons the server would refuse anyway.

export type Role = 'operator' | 'verifier' | 'admin';
export interface SessionUser {
  username: string;
  displayName: string;
  designation: string;
  role: Role;
  officerId: string;
  permissions: string[];
}

const KEY = 'bhoolekha.token';

export function getToken(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}
export function setToken(t: string | null) {
  try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
export const can = (u: SessionUser | null, perm: string) => !!u && u.permissions.includes(perm);

let installed = false;
export function installAuthFetch() {
  if (installed) return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    const isApi = url.startsWith('/api') || url.includes('/api/');
    if (!isApi) return orig(input, init);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    const t = getToken();
    if (t && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${t}`);
    const resp = await orig(input, { ...init, headers });
    if (resp.status === 401 && !url.includes('/api/auth/login')) {
      setToken(null);
      window.dispatchEvent(new Event('auth:expired'));
    }
    return resp;
  };
}

export async function login(username: string, password: string): Promise<SessionUser> {
  const r = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status >= 502 && r.status <= 504) throw new Error('Cannot reach the backend. Start it with: python -m uvicorn main:app --port 8001');
  if (!r.ok) throw new Error(d.detail || `Login failed (HTTP ${r.status})`);
  setToken(d.token);
  return d.user;
}

export async function restoreSession(): Promise<SessionUser | null> {
  if (!getToken()) return null;
  try {
    const r = await fetch('/api/auth/me');
    if (!r.ok) return null;
    return (await r.json()).user;
  } catch { return null; }
}

/** Reads `detail` from a failed API response for a readable error message. */
export async function apiError(resp: Response): Promise<string> {
  try { const d = await resp.json(); return d.detail || `HTTP ${resp.status}`; } catch { return `HTTP ${resp.status}`; }
}
