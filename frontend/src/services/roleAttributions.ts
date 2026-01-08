import { getJson, apiFetch } from './api'
import type { Role } from './roles'

export type RoleAttribution = {
    id: number
    users_id: number
    roles_id: number
    username?: string
    firstname?: string
    lastname?: string
    image_url?: string
    role?: string
}

export async function listRoleAttributions(): Promise<RoleAttribution[]> {
    return getJson<RoleAttribution[]>('/role-attributions')
}

export async function getRolesForUser(userId: number): Promise<Role[]> {
    return getJson<Role[]>(`/users/${userId}/roles`)
}

export async function assignRoleToUser(userId: number, roleId: number): Promise<RoleAttribution> {
    const res = await apiFetch('/role-attributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users_id: userId, roles_id: roleId }),
    })
    if (!res.ok) {
        try {
            const data = await res.json()
            const detail = (data && data.detail) ? JSON.stringify(data.detail) : res.statusText
            throw new Error(`POST /role-attributions failed: ${detail}`)
        } catch {
            throw new Error(`POST /role-attributions failed: ${res.status} ${res.statusText}`)
        }
    }
    return (await res.json()) as RoleAttribution
}

export async function removeRoleAttribution(id: number): Promise<{ status: string; id: number }> {
    const res = await apiFetch(`/role-attributions/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('DELETE /role-attributions/{id} failed')
    return (await res.json()) as { status: string; id: number }
}

export async function removeRoleFromUser(userId: number, roleId: number): Promise<{ status: string; user_id: number; role_id: number }> {
    const res = await apiFetch(`/users/${userId}/roles/${roleId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('DELETE /users/{id}/roles/{roleId} failed')
    return (await res.json()) as { status: string; user_id: number; role_id: number }
}
