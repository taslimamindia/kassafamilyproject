import { getJson, apiFetch } from './api'

export type Role = {
    id: number
    role: string
}

export async function getRoles(): Promise<Role[]> {
    return getJson<Role[]>('/roles')
}

export async function getRoleById(id: number): Promise<Role> {
    return getJson<Role>(`/roles/${id}`)
}

export async function createRole(role: { id?: number; role: string }): Promise<Role> {
    const res = await apiFetch('/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(role),
    })
    if (!res.ok) throw new Error('POST /roles failed')
    return (await res.json()) as Role
}

export async function updateRole(id: number, partial: { role: string }): Promise<Role> {
    const res = await apiFetch(`/roles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
    })
    if (!res.ok) throw new Error('PATCH /roles/{id} failed')
    return (await res.json()) as Role
}

export async function deleteRole(id: number): Promise<{ status: string; id: number }> {
    const res = await apiFetch(`/roles/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('DELETE /roles/{id} failed')
    return (await res.json()) as { status: string; id: number }
}
