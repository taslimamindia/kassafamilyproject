import { apiFetch, getJson } from './api'
import type { User } from './users'

export async function assignUsersToResponsableBulk(userIds: number[], responsableId: number): Promise<{ count: number }> {
    const res = await apiFetch('/family-assignations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users_ids: userIds, responsable_id: responsableId }),
    })
    if (!res.ok) {
        try {
            const data = await res.json()
            const detail = (data && (data.detail || data.message)) ? JSON.stringify(data.detail || data.message) : res.statusText
            throw new Error(`POST /family-assignations/bulk failed: ${detail}`)
        } catch {
            throw new Error(`POST /family-assignations/bulk failed: ${res.status} ${res.statusText}`)
        }
    }
    return (await res.json()) as { count: number }
}

export async function removeUsersFromResponsableBulk(userIds: number[], responsableId: number): Promise<{ count: number }> {
    const res = await apiFetch('/family-assignations/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users_ids: userIds, responsable_id: responsableId }),
    })
    if (!res.ok) {
        try {
            const data = await res.json()
            const detail = (data && (data.detail || data.message)) ? JSON.stringify(data.detail || data.message) : res.statusText
            throw new Error(`POST /family-assignations/bulk-delete failed: ${detail}`)
        } catch {
            throw new Error(`POST /family-assignations/bulk-delete failed: ${res.status} ${res.statusText}`)
        }
    }
    return (await res.json()) as { count: number }
}

export async function getAllAssignments(): Promise<{ users_assigned_id: number; users_responsable_id: number }[]> {
    return getJson<{ users_assigned_id: number; users_responsable_id: number }[]>('/family-assignations')
}

export async function copyResponsableAssignments(fromId: number, toId: number): Promise<{ count: number }> {
    const res = await apiFetch('/family-assignations/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_responsable_id: fromId, to_responsable_id: toId }),
    })
    if (!res.ok) throw new Error(`POST /family-assignations/copy failed: ${res.status}`)
    return (await res.json()) as { count: number }
}

export async function transferResponsableAssignments(fromId: number, toId: number): Promise<{ count: number }> {
    const res = await apiFetch('/family-assignations/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_responsable_id: fromId, to_responsable_id: toId }),
    })
    if (!res.ok) throw new Error(`POST /family-assignations/transfer failed: ${res.status}`)
    return (await res.json()) as { count: number }
}

export async function getAssignedMembersByResponsable(responsableId: number): Promise<User[]> {
    return getJson<User[]>(`/family-assignations/responsable/${responsableId}/members`)
}
