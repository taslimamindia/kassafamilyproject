import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUsers, updateCurrentUser, createUser, deleteUser, createUserWithImage, updateUserByIdWithImage, updateUsersTierBulk } from '../users'
import { API_BASE_URL } from '../api'

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
    ; (global as any).fetch = vi.fn(handler as any)
}

describe('users service', () => {
    beforeEach(() => { vi.restoreAllMocks() })

    it('getUsers builds expected query', async () => {
        mockFetch(async (input) => {
            // default status=active and first_login=all
            const url = String(input)
            expect(url.startsWith(`${API_BASE_URL}/users?`)).toBe(true)
            expect(url).toContain('status=active')
            expect(url).toContain('first_login=all')
            // roles as CSV and q param
            expect(url).toContain('role=admin%2Cuser')
            expect(url).toContain('q=abc')
            // extra filter
            expect(url).toContain('isactive=1')
            return new Response(JSON.stringify([]), { status: 200 })
        })
        await getUsers({ roles: ['admin', 'user'], q: 'abc', isactive: 1 })
    })

    it('updateCurrentUser adds with_image:0', async () => {
        mockFetch(async (input, init) => {
            expect(String(input)).toBe(`${API_BASE_URL}/user`)
            const req = new Request(input as any, init)
            expect(req.method).toBe('PATCH')
            const body = JSON.parse(await req.clone().text())
            expect(body).toMatchObject({ firstname: 'A', with_image: 0 })
            return new Response(JSON.stringify({ id: 1, username: 'u' }), { status: 200 })
        })
        await updateCurrentUser({ firstname: 'A' })
    })

    it('createUser sends with_image:0', async () => {
        mockFetch(async (input, init) => {
            expect(String(input)).toBe(`${API_BASE_URL}/users`)
            const req = new Request(input as any, init)
            const body = JSON.parse(await req.clone().text())
            expect(body.with_image).toBe(0)
            return new Response(JSON.stringify({ id: 2, username: 'u2' }), { status: 200 })
        })
        await createUser({ firstname: 'A', lastname: 'B' })
    })

    it('deleteUser adds hard=true when requested', async () => {
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/users/5?hard=true`)
            return new Response(JSON.stringify({ status: 'ok', id: 5 }), { status: 200 })
        })
        await deleteUser(5, true)
    })

    it('createUserWithImage sends FormData with with_image=1 and file', async () => {
        const file = new File([new Blob(['x'])], 'x.txt', { type: 'text/plain' })
        mockFetch(async (_input, init) => {
            const body: any = (init as any)?.body
            expect(body).toBeInstanceOf(FormData)
            expect(body.get('with_image')).toBe('1')
            expect(body.get('file')).toBeInstanceOf(File)
            return new Response(JSON.stringify({ id: 3, username: 'u3' }), { status: 200 })
        })
        await createUserWithImage({ firstname: 'A', lastname: 'B' }, file)
    })

    it('updateUserByIdWithImage includes with_image=1 and file', async () => {
        const file = new File([new Blob(['x'])], 'x.txt', { type: 'text/plain' })
        mockFetch(async (_input, init) => {
            const body: any = (init as any)?.body
            expect(body).toBeInstanceOf(FormData)
            expect(body.get('with_image')).toBe('1')
            expect(body.get('file')).toBeInstanceOf(File)
            return new Response(JSON.stringify({ id: 4, username: 'u4' }), { status: 200 })
        })
        await updateUserByIdWithImage(4, { firstname: 'A' }, file)
    })

    it('updateUsersTierBulk throws enriched error on failure', async () => {
        mockFetch(async () => new Response('oops', { status: 500 }))
        await expect(updateUsersTierBulk([1, 2], 'GOLD')).rejects.toThrow(/500 oops/)
    })
})
