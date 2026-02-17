import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch, getJson, postJson, API_BASE_URL } from '../api'

function mockFetchOnce(responseInit: { status?: number; body?: any; headers?: HeadersInit }) {
    const { status = 200, body, headers } = responseInit
    const payload =
        typeof body === 'string' || body === undefined
            ? (body ?? '')
            : JSON.stringify(body)
        ; (global as any).fetch = vi.fn(async () =>
            new Response(payload, { status, headers: headers as any })
        )
}

describe('api.ts helpers', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        try { localStorage.clear() } catch { }
    })

    it('adds Authorization header when token exists', async () => {
        localStorage.setItem('access_token', 'abc123')
        const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const req = new Request(input as any, init)
            expect(req.headers.get('Authorization')).toBe('Bearer abc123')
            return new Response('{}', { status: 200 })
        })
            ; (global as any).fetch = spy as any

        const res = await apiFetch('/users')
        expect(res.ok).toBe(true)
        expect(spy).toHaveBeenCalledWith(`${API_BASE_URL}/users`, expect.any(Object))
    })

    it('clears token and redirects to /auth on 401 (non-auth path)', async () => {
        localStorage.setItem('access_token', 'abc123')
        const assignSpy = vi.spyOn(window.location, 'assign') as any
        mockFetchOnce({ status: 401, body: { detail: 'unauthorized' } })

        const res = await apiFetch('/users')
        expect(res.status).toBe(401)
        expect(localStorage.getItem('access_token')).toBeNull()
        expect(assignSpy).toHaveBeenCalledWith('/auth')
    })

    it('does not redirect for 401 on /auth paths', async () => {
        localStorage.setItem('access_token', 'abc123')
        const assignSpy = vi.spyOn(window.location, 'assign') as any
        mockFetchOnce({ status: 401, body: { detail: 'unauthorized' } })

        await apiFetch('/auth/login')
        expect(assignSpy).not.toHaveBeenCalled()
    })

    it('getJson throws on non-ok status', async () => {
        mockFetchOnce({ status: 500, body: 'server error' })
        await expect(getJson('/users')).rejects.toThrow('GET /users failed: 500')
    })

    it('postJson sends JSON and throws richly on error', async () => {
        const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const req = new Request(input as any, init)
            expect(req.headers.get('Content-Type')).toContain('application/json')
            const sent = await req.clone().text()
            expect(sent).toBe(JSON.stringify({ a: 1 }))
            return new Response(JSON.stringify({ error: 'bad' }), { status: 400 })
        })
            ; (global as any).fetch = fetchSpy as any

        await expect(postJson('/x', { a: 1 })).rejects.toMatchObject({ status: 400 })
    })
})
