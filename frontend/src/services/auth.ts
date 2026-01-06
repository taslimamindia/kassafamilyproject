import { getJson, postJson } from './api'

export type LoginResponse = {
    access_token: string
    token_type: string
}

export async function login(identifier: string, password: string): Promise<string> {
    const data = await postJson<LoginResponse, { identifier: string; password: string }>(
        '/auth/login',
        { identifier, password },
    )
    localStorage.setItem('access_token', data.access_token)
    try {
        window.dispatchEvent(new Event('auth-changed'))
    } catch {}
    return data.access_token
}

export function getToken(): string | null {
    try {
        return localStorage.getItem('access_token')
    } catch {
        return null
    }
}

export async function verifyToken(): Promise<boolean> {
    const token = getToken()
    if (!token) return false
    try {
        await getJson('/auth/verify')
        return true
    } catch {
        return false
    }
}

export function logout(): void {
    // Try backend logout first to revoke token server-side
    const token = getToken()
    const revoke = async () => {
        if (token) {
            try {
                await postJson('/auth/logout')
            } catch {
                // Ignore errors; proceed to client logout
            }
        }
    }
    revoke().finally(() => {
        try {
            localStorage.removeItem('access_token')
            try {
                window.dispatchEvent(new Event('auth-changed'))
            } catch {}
        } catch { }
    })
}
