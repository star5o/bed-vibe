const TOKEN_KEY = 'rv_jwt'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(jwt: string): void {
  localStorage.setItem(TOKEN_KEY, jwt)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export async function apiAuthStatus(): Promise<{ needsSetup: boolean; registrationEnabled: boolean }> {
  const res = await fetch('/api/auth/status')
  return res.json()
}

export async function apiLogin(username: string, password: string): Promise<string> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Login failed')
  }
  const { jwt } = await res.json()
  setToken(jwt)
  return jwt
}

export async function apiRegister(username: string, password: string, displayName?: string): Promise<string> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, displayName }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Registration failed')
  }
  const { jwt } = await res.json()
  setToken(jwt)
  return jwt
}

export async function apiFetch(path: string, opts?: RequestInit): Promise<Response> {
  const token = getToken()
  const res = await fetch(path, {
    ...opts,
    headers: {
      ...opts?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
  })
  if (res.status === 401) {
    clearToken()
    window.location.reload()
  }
  return res
}
