import { getJson, postJson, apiFetch } from './api'

export type Message = {
    id: number
    message: string
    message_type: 'APPROVAL' | 'MESSAGE' | 'EXTERNE'
    received_at: string
    isread: number
    sended_by_id?: number
    received_by_id?: number
    link?: string
}

export async function getMessages(lastId: number = 0) {
    const url = lastId > 0 ? `/messages?last_id=${lastId}` : '/messages'
    return getJson<Message[]>(url)
}

export async function markMessageRead(id: number) {
    const res = await apiFetch(`/messages/${id}/read`, { method: 'PUT' })
    if (!res.ok) throw new Error('Failed to mark read')
    return res.json()
}

export async function markAllMessagesRead() {
    const res = await apiFetch('/messages/read-all', { method: 'PUT' })
    if (!res.ok) throw new Error('Failed to mark all as read')
    return res.json()
}

export type MessageCreate = {
    message: string
    recipient_type: 'support' | 'board' | 'treasury' | 'member'
    // allow single id or array of ids for members
    recipient_id?: number | number[]
}

export async function sendMessage(data: MessageCreate) {
    return postJson('/messages', data)
}
