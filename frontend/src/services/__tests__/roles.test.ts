import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRoles, getRoleById, createRole, updateRole, deleteRole } from '../roles'
import { API_BASE_URL } from '../api'

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
    ; (global as any).fetch = vi.fn(handler as any)
}

describe('roles service', () => {
    beforeEach(() => { vi.restoreAllMocks() })

    it('getRoles and getRoleById', async () => {
        mockFetch(async (input) => {
            const url = String(input)
            expect([`${API_BASE_URL}/roles`, `${API_BASE_URL}/roles/1`]).toContain(url)
            return new Response(url.endsWith('/1') ? JSON.stringify({ id: 1, role: 'admin' }) : JSON.stringify([]), { status: 200 })
        })
        await getRoles()
        const r = await getRoleById(1)
        expect(r.id).toBe(1)
    })

    it('createRole posts JSON', async () => {
        mockFetch(async (input, init) => {
            expect(String(input)).toBe(`${API_BASE_URL}/roles`)
            const req = new Request(input as any, init)
            expect(req.method).toBe('POST')
            expect(req.headers.get('Content-Type')).toContain('application/json')
            const body = await req.clone().text()
            expect(JSON.parse(body)).toMatchObject({ role: 'member' })
            return new Response(JSON.stringify({ id: 2, role: 'member' }), { status: 200 })
        })
        const res = await createRole({ role: 'member' })
        expect(res.role).toBe('member')
    })

    it('updateRole and deleteRole', async () => {
        mockFetch(async (input, init) => {
            const url = String(input)
            const req = new Request(input as any, init)
            if (req.method === 'PATCH') {
                expect(url).toBe(`${API_BASE_URL}/roles/3`)
                return new Response(JSON.stringify({ id: 3, role: 'x' }), { status: 200 })
            }
            expect(url).toBe(`${API_BASE_URL}/roles/3`)
            return new Response(JSON.stringify({ status: 'ok', id: 3 }), { status: 200 })
        })
        await updateRole(3, { role: 'x' })
        await deleteRole(3)
    })
})