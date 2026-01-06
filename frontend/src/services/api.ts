export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

function getStoredToken(): string | null {
    try {
        return localStorage.getItem('access_token')
    } catch {
        return null
    }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = getStoredToken()
    const headers = new Headers(init.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${API_BASE_URL}${path}`, { ...init, headers })
}

export async function getJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await apiFetch(path, { ...init, method: init.method ?? 'GET' })
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
    return (await res.json()) as T
}

export async function postJson<T, B = unknown>(path: string, body?: B, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers || {})
    headers.set('Content-Type', 'application/json')
    const res = await apiFetch(path, {
        ...init,
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
    return (await res.json()) as T
}
