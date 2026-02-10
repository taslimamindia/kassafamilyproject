import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listTables, getDeletionOrder, listRows, deleteRows } from '../adminDb'
import { API_BASE_URL } from '../api'

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
    ; (global as any).fetch = vi.fn(handler as any)
}

describe('adminDb service', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('listTables fetches /admin/db/tables', async () => {
        mockFetch(async (input) => {
            expect(input).toBe(`${API_BASE_URL}/admin/db/tables`)
            return new Response(JSON.stringify([{ name: 'users' }]), { status: 200 })
        })
        const tables = await listTables()
        expect(tables[0].name).toBe('users')
    })

    it('getDeletionOrder fetches /admin/db/deletion-order', async () => {
        mockFetch(async (input) => {
            expect(input).toBe(`${API_BASE_URL}/admin/db/deletion-order`)
            return new Response(JSON.stringify([{ table: 'child', dependsOn: ['parent'] }]), { status: 200 })
        })
        const order = await getDeletionOrder()
        expect(order[0].table).toBe('child')
    })

    it('listRows builds pagination query', async () => {
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/admin/db/tables/my_table/rows?page=2&size=50`)
            return new Response(JSON.stringify({ rows: [], total: 0, pk: 'id' }), { status: 200 })
        })
        const res = await listRows('my_table', 2, 50)
        expect(res.pk).toBe('id')
    })

    it('deleteRows sends DELETE with ids and throws richly on error', async () => {
        mockFetch(async (input, init) => {
            const req = new Request(input as any, init)
            expect(req.method).toBe('DELETE')
            const body = await req.clone().text()
            expect(body).toBe(JSON.stringify({ ids: [1, 2] }))
            return new Response(JSON.stringify({ detail: 'Nope' }), { status: 400 })
        })
        await expect(deleteRows('users', [1, 2])).rejects.toMatchObject({ status: 400 })
    })
})
