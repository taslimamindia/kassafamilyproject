import { getJson, apiFetch } from './api'

export type User = {
    id: number
    username: string
    firstname: string
    lastname: string
    email?: string
    telephone?: string
    birthday?: string
    image_url?: string
    id_father?: number | null
    id_mother?: number | null
    // Activation and first-login flags (numeric per backend: 1/0)
    isactive?: number
    isfirstlogin?: number
}

export async function getUsers(opts: {
    status?: 'all' | 'active' | 'inactive'
    firstLogin?: 'all' | 'yes' | 'no'
    q?: string
} = {}): Promise<User[]> {
    const params = new URLSearchParams()
    params.set('status', (opts.status ?? 'active'))
    params.set('first_login', (opts.firstLogin ?? 'all'))
    if (opts.q) params.set('q', opts.q)
    const query = params.toString()
    return getJson<User[]>(`/users${query ? `?${query}` : ''}`)
}

export async function getCurrentUser(): Promise<User> {
    return getJson<User>('/user')
}

export async function updateCurrentUser(partial: Partial<User>): Promise<User> {
    const res = await apiFetch('/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...partial, with_image: 0 }),
    })
    if (!res.ok) throw new Error('PATCH /user failed')
    return (await res.json()) as User
}

export async function getUserById(id: number): Promise<User> {
    return getJson<User>(`/users/${id}`)
}

export async function createUser(user: {
    firstname: string
    lastname: string
    username?: string
    email?: string
    telephone?: string
    birthday?: string
    image_url?: string
    id_father?: number | null
    id_mother?: number | null
    isactive?: number
    isfirstlogin?: number
}): Promise<User> {
    const res = await apiFetch('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...user, with_image: 0 }),
    })
    if (!res.ok) throw new Error('POST /users failed')
    return (await res.json()) as User
}

export async function updateUserById(id: number, partial: Partial<User> & {
    isactive?: number
    isfirstlogin?: number
}): Promise<User> {
    const res = await apiFetch(`/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
    })
    if (!res.ok) throw new Error('PATCH /users/{id} failed')
    return (await res.json()) as User
}

export async function deleteUser(id: number, hard: boolean = false): Promise<{ status: string; id: number }> {
    const params = new URLSearchParams()
    if (hard) params.set('hard', 'true')
    const query = params.toString()
    const res = await apiFetch(`/users/${id}${query ? `?${query}` : ''}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('DELETE /users/{id} failed')
    return (await res.json()) as { status: string; id: number }
}

export async function createUserWithImage(fields: {
    firstname: string
    lastname: string
    username?: string
    email?: string
    telephone?: string
    birthday?: string
    id_father?: number | null
    id_mother?: number | null
    isactive?: number
    isfirstlogin?: number
}, file: File): Promise<User> {
    const form = new FormData()
    form.append('firstname', fields.firstname)
    form.append('lastname', fields.lastname)
    form.append('with_image', '1')
    if (fields.username) form.append('username', String(fields.username))
    if (fields.email) form.append('email', fields.email)
    if (fields.telephone) form.append('telephone', fields.telephone)
    if (fields.birthday) form.append('birthday', fields.birthday)
    if (typeof fields.id_father !== 'undefined' && fields.id_father !== null) form.append('id_father', String(fields.id_father))
    if (typeof fields.id_mother !== 'undefined' && fields.id_mother !== null) form.append('id_mother', String(fields.id_mother))
    if (typeof fields.isactive !== 'undefined') form.append('isactive', String(fields.isactive))
    if (typeof fields.isfirstlogin !== 'undefined') form.append('isfirstlogin', String(fields.isfirstlogin))
    form.append('file', file)
    const res = await apiFetch('/users', { method: 'POST', body: form })
    if (!res.ok) throw new Error('POST /users (multipart) failed')
    return (await res.json()) as User
}

export async function updateUserByIdWithImage(id: number, fields: Partial<User> & {
    isactive?: number
    isfirstlogin?: number
}, file: File): Promise<User> {
    const form = new FormData()
    if (fields.firstname) form.append('firstname', fields.firstname)
    if (fields.lastname) form.append('lastname', fields.lastname)
    if (fields.username) form.append('username', String(fields.username))
    form.append('with_image', '1')
    if (fields.email) form.append('email', fields.email)
    if (fields.telephone) form.append('telephone', fields.telephone)
    if (fields.birthday) form.append('birthday', fields.birthday)
    if (typeof fields.id_father !== 'undefined' && fields.id_father !== null) form.append('id_father', String(fields.id_father))
    if (typeof fields.id_mother !== 'undefined' && fields.id_mother !== null) form.append('id_mother', String(fields.id_mother))
    if (typeof fields.isactive !== 'undefined') form.append('isactive', String(fields.isactive))
    if (typeof fields.isfirstlogin !== 'undefined') form.append('isfirstlogin', String(fields.isfirstlogin))
    form.append('file', file)
    const res = await apiFetch(`/users/${id}`, { method: 'PATCH', body: form })
    if (!res.ok) throw new Error('PATCH /users/{id} (multipart) failed')
    return (await res.json()) as User
}
