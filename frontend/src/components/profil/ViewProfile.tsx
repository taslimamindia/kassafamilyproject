import { useEffect, useMemo, useState } from 'react'
import { getToken } from '../../services/auth'
import { getCurrentUser, type User } from '../../services/users'

function base64UrlDecode(input: string): string {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '==='.slice((base64.length + 3) % 4)
    try {
        return atob(padded)
    } catch {
        return ''
    }
}

function parseJwt(token: string | null): { sub?: number; username?: string } {
    if (!token) return {}
    const parts = token.split('.')
    if (parts.length !== 3) return {}
    try {
        const payloadJson = base64UrlDecode(parts[1])
        return JSON.parse(payloadJson)
    } catch {
        return {}
    }
}

export default function ViewProfile() {
    const token = getToken()
    const payload = useMemo(() => parseJwt(token), [token])
    const [user, setUser] = useState<User | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function loadUser() {
            try {
                const me = await getCurrentUser()
                setUser(me ?? null)
            } catch (e) {
                setError('Impossible de charger le profil')
            }
        }
        loadUser()
    }, [])

    return (
        <div>
            {error && <div className="alert alert-danger">{error}</div>}
            {!user ? (
                <div className="text-muted">Chargement du profil...</div>
            ) : (
                <div className="card">
                    <div className="card-body">
                        <div className="row mb-2">
                            <div className="col-6"><strong>Nom d'utilisateur</strong></div>
                            <div className="col-6">{user.username ?? payload.username}</div>
                        </div>
                        <div className="row mb-2">
                            <div className="col-6"><strong>Prénom</strong></div>
                            <div className="col-6">{user.firstname}</div>
                        </div>
                        <div className="row mb-2">
                            <div className="col-6"><strong>Nom</strong></div>
                            <div className="col-6">{user.lastname}</div>
                        </div>
                        <div className="row mb-2">
                            <div className="col-6"><strong>Email</strong></div>
                            <div className="col-6">{user.email ?? '—'}</div>
                        </div>
                        <div className="row mb-2">
                            <div className="col-6"><strong>Téléphone</strong></div>
                            <div className="col-6">{user.telephone ?? '—'}</div>
                        </div>
                        <div className="row mb-2">
                            <div className="col-6"><strong>Date de naissance</strong></div>
                            <div className="col-6">{user.birthday ?? '—'}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
