import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getMessages, markMessageRead, markAllMessagesRead, sendMessage, getUserMessageInfo } from '../messages'
import { API_BASE_URL } from '../api'

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
    ; (global as any).fetch = vi.fn(handler as any)
}

describe('messages service', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('getMessages builds last_id query when provided', async () => {
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/messages?last_id=10`)
            return new Response(JSON.stringify([]), { status: 200 })
        })
        await getMessages(10)
    })

    it('getMessages uses base path when lastId is 0', async () => {
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/messages`)
            return new Response(JSON.stringify([]), { status: 200 })
        })
        await getMessages(0)
    })

    it('markMessageRead issues PUT', async () => {
        mockFetch(async (input, init) => {
            const req = new Request(input as any, init)
            expect(req.method).toBe('PUT')
            return new Response(JSON.stringify({ ok: true }), { status: 200 })
        })
        await markMessageRead(3)
    })

    it('markAllMessagesRead issues PUT', async () => {
        mockFetch(async (input, init) => {
            expect(String(input)).toBe(`${API_BASE_URL}/messages/read-all`)
            const req = new Request(input as any, init)
            expect(req.method).toBe('PUT')
            return new Response(JSON.stringify({ ok: true }), { status: 200 })
        })
        await markAllMessagesRead()
    })

    it('sendMessage posts JSON', async () => {
        mockFetch(async (input, init) => {
            expect(String(input)).toBe(`${API_BASE_URL}/messages`)
            const req = new Request(input as any, init)
            expect(req.method).toBe('POST')
            const txt = await req.clone().text()
            expect(JSON.parse(txt)).toMatchObject({ message: 'hi', recipient_type: 'support' })
            return new Response(JSON.stringify({ id: 1 }), { status: 200 })
        })
        await sendMessage({ message: 'hi', recipient_type: 'support' })
    })

    it('getUserMessageInfo hits path', async () => {
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/messages/9/user-info`)
            return new Response(JSON.stringify({ message_id: 9, receiver_id: 1, sender: { id: 2 } }), { status: 200 })
        })
        const data = await getUserMessageInfo(9)
        expect(data.message_id).toBe(9)
    })
})
