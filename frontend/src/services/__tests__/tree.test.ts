import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchRawUsers } from '../tree'
import { API_BASE_URL } from '../api'

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
    ; (global as any).fetch = vi.fn(handler as any)
}

describe('tree service', () => {
    beforeEach(() => { vi.restoreAllMocks() })

    it('fetchRawUsers calls /tree', async () => {
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/tree`)
            return new Response(JSON.stringify([]), { status: 200 })
        })
        await fetchRawUsers()
    })
})
