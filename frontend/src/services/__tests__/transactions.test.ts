import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listPaymentMethods, createPaymentMethod, uploadTransactionProof, deleteTransactionProof, listTransactions, approveTransaction } from '../transactions'
import { API_BASE_URL } from '../api'

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
    ; (global as any).fetch = vi.fn(handler as any)
}

describe('transactions service', () => {
    beforeEach(() => { vi.restoreAllMocks() })

    it('listPaymentMethods with active=true', async () => {
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/payment-methods?active=true`)
            return new Response(JSON.stringify([]), { status: 200 })
        })
        await listPaymentMethods({ active: true })
    })

    it('createPaymentMethod posts JSON', async () => {
        mockFetch(async (input, init) => {
            expect(String(input)).toBe(`${API_BASE_URL}/payment-methods`)
            const req = new Request(input as any, init)
            expect(req.method).toBe('POST')
            const body = JSON.parse(await req.clone().text())
            expect(body).toMatchObject({ name: 'Mobile', account_number: '123' })
            return new Response(JSON.stringify({ id: 1, name: 'Mobile', isactive: 1, account_number: '123', created_at: '', updated_at: '' }), { status: 200 })
        })
        await createPaymentMethod({ name: 'Mobile', account_number: '123' })
    })

    it('uploadTransactionProof sends FormData including tx_id', async () => {
        const file = new File([new Blob(['x'])], 'x.png', { type: 'image/png' })
        mockFetch(async (_input, init) => {
            const body: any = (init as any)?.body
            expect(body).toBeInstanceOf(FormData)
            expect(body.get('file')).toBeInstanceOf(File)
            expect(body.get('tx_id')).toBe('99')
            return new Response(JSON.stringify({ url: 'http://x' }), { status: 200 })
        })
        await uploadTransactionProof(file, 99)
    })

    it('deleteTransactionProof encodes URL', async () => {
        const target = 'https://a/b?c=d'
        mockFetch(async (input) => {
            expect(String(input)).toBe(`${API_BASE_URL}/transactions/proof-delete?url=${encodeURIComponent(target)}`)
            return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
        })
        await deleteTransactionProof(target)
    })

    it('listTransactions builds filters', async () => {
        mockFetch(async (input) => {
            const url = String(input)
            expect(url).toContain('/transactions?')
            expect(url).toContain('status=PENDING')
            expect(url).toContain('users_id=1')
            expect(url).toContain('transaction_type=CONTRIBUTION')
            return new Response(JSON.stringify([]), { status: 200 })
        })
        await listTransactions({ status: 'PENDING', users_id: 1, transaction_type: 'CONTRIBUTION' })
    })

    it('approveTransaction posts note body', async () => {
        mockFetch(async (input, init) => {
            expect(String(input)).toBe(`${API_BASE_URL}/transactions/5/approvals`)
            const req = new Request(input as any, init)
            expect(req.method).toBe('POST')
            const body = JSON.parse(await req.clone().text())
            expect(body).toEqual({ note: 'ok' })
            return new Response(JSON.stringify({ transaction: { id: 5 }, approver_role: 'admin' }), { status: 200 })
        })
        const res = await approveTransaction(5, 'ok')
        expect(res.approver_role).toBe('admin')
    })
})
