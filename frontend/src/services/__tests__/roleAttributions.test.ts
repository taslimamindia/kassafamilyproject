import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listRoleAttributions, assignRoleToUser, assignRoleToUsersBulk, removeRoleFromUsersBulk, removeRoleAttribution, getRolesForUser, removeRoleFromUser } from '../roleAttributions'
import { API_BASE_URL } from '../api'

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
    ; (global as any).fetch = vi.fn(handler as any)
}

describe('roleAttributions service', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('listRoleAttributions has default status=active', async () => {
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/role-attributions?status=active`)
            return new Response(JSON.stringify([]), { status: 200 })
        })
        await listRoleAttributions()
    })

    it('assignRoleToUser posts payload', async () => {
        mockFetch(async (input, init) => {
            expect(String(input)).toBe(`${API_BASE_URL}/role-attributions`)
            const req = new Request(input as any, init)
            expect(req.method).toBe('POST')
            const body = await req.clone().text()
            expect(body).toBe(JSON.stringify({ users_id: 1, roles_id: 2 }))
            return new Response(JSON.stringify({ id: 1, users_id: 1, roles_id: 2 }), { status: 200 })
        })
        const res = await assignRoleToUser(1, 2)
        expect(res.roles_id).toBe(2)
    })

    it('assignRoleToUsersBulk error includes status code in message', async () => {
        mockFetch(async () => new Response(JSON.stringify({ detail: 'nope' }), { status: 400 }))
        await expect(assignRoleToUsersBulk([1, 2], 3)).rejects.toThrow(/failed: 400/)
    })

    it('removeRoleFromUsersBulk error returns status code', async () => {
        mockFetch(async () => new Response('bad', { status: 500, statusText: 'E' }))
        await expect(removeRoleFromUsersBulk([1], 3)).rejects.toThrow(/500/)
    })

    it('removeRoleAttribution and removeRoleFromUser issue DELETE', async () => {
        mockFetch(async (input) => {
            const url = String(input)
            expect(url === `${API_BASE_URL}/role-attributions/9` || url === `${API_BASE_URL}/users/1/roles/2`).toBe(true)
            return new Response(JSON.stringify({ status: 'ok', id: 9 }), { status: 200 })
        })
        await removeRoleAttribution(9)
        await removeRoleFromUser(1, 2)
    })

    it('getRolesForUser path', async () => {
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/users/5/roles`)
            return new Response(JSON.stringify([]), { status: 200 })
        })
        await getRolesForUser(5)
    })
})
