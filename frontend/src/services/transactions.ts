import { getJson, apiFetch } from './api'

export type PaymentMethod = {
    id: number
    name: string
    type_of_proof?: 'TRANSACTIONNUMBER' | 'LINK' | 'BOTH'
    isactive: number
    created_at: string
    updated_at: string
}

export type TransactionApproval = {
    id: number
    role_at_approval: string
    approved_at: string
    note?: string
    transactions_id: number
    users_id: number
    approved_by_username?: string
}

export type Transaction = {
    id: number
    amount: number
    status: 'PENDING' | 'PARTIALLY_APPROVED' | 'VALIDATED' | 'REJECTED' | 'SAVED'
    proof_reference: string
    validated_at: string
    created_at: string
    recorded_by_id: number
    users_id: number
    updated_by: number
    payment_methods_id: number
    transaction_type: 'CONTRIBUTION' | 'DONATIONS' | 'EXPENSE'
    issubmitted?: number
    updated_at: string
    // Joined convenience fields
    user_username?: string
    user_firstname?: string
    user_lastname?: string
    user_image_url?: string
    recorded_by_username?: string
    recorded_by_firstname?: string
    recorded_by_lastname?: string
    payment_method_name?: string
    approvals?: TransactionApproval[]
}

export async function listPaymentMethods(opts: { active?: boolean } = {}): Promise<PaymentMethod[]> {
    const params = new URLSearchParams()
    if (typeof opts.active !== 'undefined') params.set('active', String(!!opts.active))
    const q = params.toString()
    return getJson<PaymentMethod[]>(`/payment-methods${q ? `?${q}` : ''}`)
}

export async function createPaymentMethod(pm: { name: string; isactive?: number; type_of_proof?: 'TRANSACTIONNUMBER' | 'LINK' | 'BOTH' }): Promise<PaymentMethod> {
    const res = await apiFetch('/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pm),
    })
    if (!res.ok) throw new Error('POST /payment-methods failed')
    return (await res.json()) as PaymentMethod
}

export async function updatePaymentMethod(id: number, partial: { name?: string; isactive?: number; type_of_proof?: 'TRANSACTIONNUMBER' | 'LINK' | 'BOTH' }): Promise<PaymentMethod> {
    const res = await apiFetch(`/payment-methods/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
    })
    if (!res.ok) throw new Error('PATCH /payment-methods/{id} failed')
    return (await res.json()) as PaymentMethod
}

export async function submitTransaction(id: number): Promise<Transaction> {
    const res = await apiFetch(`/transactions/${id}/submit`, {
        method: 'POST',
    })
    if (!res.ok) throw new Error('POST /transactions/{id}/submit failed')
    return (await res.json()) as Transaction
}

export async function uploadTransactionProof(file: File, txId?: number): Promise<{ url: string; key?: string }> {
    const form = new FormData()
    form.append('file', file)
    if (typeof txId !== 'undefined') form.append('tx_id', String(txId))
    const res = await apiFetch('/transactions/proof-upload', {
        method: 'POST',
        body: form,
    })
    if (!res.ok) throw new Error('POST /transactions/proof-upload failed')
    return (await res.json()) as { url: string; key?: string }
}

export async function deleteTransactionProof(url: string): Promise<{ status: string }> {
    const res = await apiFetch(`/transactions/proof-delete?url=${encodeURIComponent(url)}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('DELETE /transactions/proof-delete failed')
    return (await res.json()) as { status: string }
}

export async function listTransactions(filters: {
    status?: Transaction['status']
    users_id?: number
    recorded_by_id?: number
    payment_methods_id?: number
    transaction_type?: Transaction['transaction_type']
    date_from?: string
    date_to?: string
} = {}): Promise<Transaction[]> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
        if (typeof v !== 'undefined' && v !== null) params.set(k, String(v))
    })
    const q = params.toString()
    return getJson<Transaction[]>(`/transactions${q ? `?${q}` : ''}`)
}

export async function getTransaction(id: number): Promise<Transaction> {
    return getJson<Transaction>(`/transactions/${id}`)
}

export async function createTransaction(tx: {
    amount: number
    proof_reference: string
    users_id: number
    payment_methods_id: number
    transaction_type: Transaction['transaction_type']
    issubmitted?: number
}): Promise<Transaction> {
    const res = await apiFetch('/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
    })
    if (!res.ok) throw new Error('POST /transactions failed')
    return (await res.json()) as Transaction
}

export async function updateTransactionStatus(id: number, status: Transaction['status']): Promise<Transaction> {
    const res = await apiFetch(`/transactions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error('PATCH /transactions/{id}/status failed')
    return (await res.json()) as Transaction
}

export async function setTransactionProof(id: number, url: string): Promise<Transaction> {
    const res = await apiFetch(`/transactions/${id}/proof`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
    })
    if (!res.ok) throw new Error('PATCH /transactions/{id}/proof failed')
    return (await res.json()) as Transaction
}

export async function listApprovals(txId: number): Promise<any[]> {
    return getJson<any[]>(`/transactions/${txId}/approvals`)
}

export async function approveTransaction(txId: number, note?: string): Promise<{ transaction: Transaction; approver_role: string | null }> {
    const res = await apiFetch(`/transactions/${txId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
    })
    if (!res.ok) throw new Error('POST /transactions/{id}/approvals failed')
    return (await res.json()) as { transaction: Transaction; approver_role: string | null }
}

export async function deleteTransaction(id: number): Promise<{ status: string } | void> {
    const res = await apiFetch(`/transactions/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('DELETE /transactions/{id} failed')
    try {
        return (await res.json()) as { status: string }
    } catch {
        return
    }
}
