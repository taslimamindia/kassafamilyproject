import { getJson, apiFetch } from './api'

export type User = {
    id: number
    username: string
    firstname: string
    lastname: string
    email?: string
    telephone?: string
    birthday?: string
}

export async function getUsers(): Promise<User[]> {
    return getJson<User[]>('/users')
}

export async function getCurrentUser(): Promise<User> {
    return getJson<User>('/user')
}

export async function updateCurrentUser(partial: Partial<User>): Promise<User> {
    const res = await apiFetch('/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
    })
    if (!res.ok) throw new Error('PATCH /user failed')
    return (await res.json()) as User
}
