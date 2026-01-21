export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
import axios, { type AxiosInstance } from 'axios'

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
    const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
    // Avoid auto-redirect handling for auth endpoints (login / first-login change)
    const isAuthPath = path.startsWith('/auth')
    if ((res.status === 401 || res.status === 403) && !isAuthPath) {
        try {
            localStorage.removeItem('access_token')
            try { window.dispatchEvent(new Event('auth-changed')) } catch {}
        } catch {}
        // Avoid infinite loop if already on /auth
        try {
            const isOnAuth = typeof window !== 'undefined' && window.location && window.location.pathname === '/auth'
            if (!isOnAuth) {
                window.location.assign('/auth')
            }
        } catch {}
    }
    return res
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
    if (!res.ok) {
        let payload: any = null
        try {
            payload = await res.json()
        } catch {
            try { payload = await res.text() } catch {}
        }
        const err: any = new Error(`POST ${path} failed: ${res.status}`)
        err.status = res.status
        err.body = payload
        throw err
    }
    return (await res.json()) as T
}

// Axios client for components that prefer axios APIs (e.g., Recharts data loaders)
export const axiosClient: AxiosInstance = (() => {
    const instance = axios.create({ baseURL: API_BASE_URL })
    instance.interceptors.request.use((config) => {
        const token = getStoredToken()
        if (token) {
            config.headers = config.headers ?? {}
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    })
    instance.interceptors.response.use(
        (resp) => resp,
        (err) => {
            const status = err?.response?.status
            const path = err?.config?.url ?? ''
            const isAuthPath = path.startsWith('/auth')
            if ((status === 401 || status === 403) && !isAuthPath) {
                try {
                    localStorage.removeItem('access_token')
                    try { window.dispatchEvent(new Event('auth-changed')) } catch {}
                } catch {}
                try {
                    const isOnAuth = typeof window !== 'undefined' && window.location && window.location.pathname === '/auth'
                    if (!isOnAuth) {
                        window.location.assign('/auth')
                    }
                } catch {}
            }
            return Promise.reject(err)
        }
    )
    return instance
})()
