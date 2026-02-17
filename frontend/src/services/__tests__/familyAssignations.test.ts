import { describe, it, expect, vi, beforeEach } from 'vitest'
import { assignUsersToResponsableBulk, removeUsersFromResponsableBulk, getAllAssignments, copyResponsableAssignments, transferResponsableAssignments, getAssignedMembersByResponsable } from '../familyAssignations'
import { API_BASE_URL } from '../api'

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
    ; (global as any).fetch = vi.fn(handler as any)
}

describe('familyAssignations service', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('assignUsersToResponsableBulk posts payload', async () => {
        mockFetch(async (input, init) => {
            expect(String(input)).toBe(`${API_BASE_URL}/family-assignations/bulk`)
            const req = new Request(input as any, init)
            expect(req.method).toBe('POST')
            const body = await req.clone().text()
            expect(body).toBe(JSON.stringify({ users_ids: [1, 2], responsable_id: 7 }))
            return new Response(JSON.stringify({ count: 2 }), { status: 200 })
        })
        const res = await assignUsersToResponsableBulk([1, 2], 7)
        expect(res.count).toBe(2)
    })

    it('assignUsersToResponsableBulk throws with error status when backend fails', async () => {
        mockFetch(async () => new Response(JSON.stringify({ detail: 'E' }), { status: 400 }))
        await expect(assignUsersToResponsableBulk([1], 2)).rejects.toThrow(/failed: 400/)
    })

    it('removeUsersFromResponsableBulk throws with text detail', async () => {
        mockFetch(async () => new Response('bad', { status: 500, statusText: 'err' }))
        await expect(removeUsersFromResponsableBulk([1], 2)).rejects.toThrow(/500/i)
    })

    it('getAllAssignments hits /family-assignations', async () => {
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/family-assignations`)
            return new Response(JSON.stringify([]), { status: 200 })
        })
        const data = await getAllAssignments()
        expect(Array.isArray(data)).toBe(true)
    })

    it('copy and transfer endpoints', async () => {
        mockFetch(async (input) => {
            const url = String(input)
            expect([`${API_BASE_URL}/family-assignations/copy`, `${API_BASE_URL}/family-assignations/transfer`]).toContain(url)
            return new Response(JSON.stringify({ count: 1 }), { status: 200 })
        })
        expect((await copyResponsableAssignments(1, 2)).count).toBe(1)
        expect((await transferResponsableAssignments(1, 2)).count).toBe(1)
    })

    it('getAssignedMembersByResponsable hits correct path', async () => {
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/family-assignations/responsable/5/members`)
            return new Response(JSON.stringify([]), { status: 200 })
        })
        await getAssignedMembersByResponsable(5)
    })
})
