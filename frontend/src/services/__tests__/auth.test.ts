import { describe, it, expect, vi, beforeEach } from 'vitest'
import { login, verifyToken, logout } from '../auth'
import { API_BASE_URL } from '../api'

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
    ; (global as any).fetch = vi.fn(handler as any)
}

describe('auth service (unit)', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        try { localStorage.clear() } catch { }
    })

    it('login posts credentials and stores token', async () => {
        mockFetch(async (input, init) => {
            expect(String(input)).toBe(`${API_BASE_URL}/auth/login`)
            const req = new Request(input as any, init)
            expect(req.method).toBe('POST')
            expect(req.headers.get('Content-Type')).toContain('application/json')
            const body = await req.clone().text()
            expect(body).toBe(JSON.stringify({ identifier: 'user', password: 'pass' }))
            return new Response(JSON.stringify({ access_token: 'tok', token_type: 'bearer' }), { status: 200 })
        })

        const token = await login('user', 'pass')
        expect(token).toBe('tok')
        expect(localStorage.getItem('access_token')).toBe('tok')
    })

    it('verifyToken returns false when no token', async () => {
        expect(await verifyToken()).toBe(false)
    })

    it('verifyToken returns true on 200 and false on 401', async () => {
        localStorage.setItem('access_token', 'tok')
        // First a 200
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/auth/verify`)
            return new Response('{}', { status: 200 })
        })
        expect(await verifyToken()).toBe(true)

        // Then a 401
        localStorage.setItem('access_token', 'tok')
        mockFetch(async () => new Response('{}', { status: 401 }))
        const ok = await verifyToken()
        expect(ok).toBe(false)
    })

    it('logout calls backend (if token) then clears client token', async () => {
        localStorage.setItem('access_token', 'tok')
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/auth/logout`)
            return new Response('{}', { status: 200 })
        })
        logout()
        await new Promise((r) => setTimeout(r, 0))
        expect(localStorage.getItem('access_token')).toBeNull()
    })
})
