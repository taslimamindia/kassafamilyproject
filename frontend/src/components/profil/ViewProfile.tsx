import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getToken } from '../../services/auth'
import { getCurrentUser, type User } from '../../services/users'
import './ViewProfile.css'

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
    const [showImage, setShowImage] = useState<boolean>(false)
    const [imageBroken, setImageBroken] = useState<boolean>(false)
    const [cacheBust, setCacheBust] = useState<number>(0)
    const initials = useMemo(() => {
        const f = user?.firstname?.trim()?.[0] ?? ''
        const l = user?.lastname?.trim()?.[0] ?? ''
        return (f + l || user?.username?.trim()?.[0] || '?').toUpperCase()
    }, [user])

    useEffect(() => {
        async function loadUser() {
            try {
                const me = await getCurrentUser()
                setUser(me ?? null)
                setShowImage(!!me?.image_url)
            } catch (e) {
                setError('Impossible de charger le profil')
            }
        }
        loadUser()
    }, [])

    // Réinitialiser l'état "cassé" si l'URL change
    useEffect(() => {
        if (user?.image_url) {
            setImageBroken(false)
            setCacheBust(0)
        }
    }, [user?.image_url])


    return (
        <div className="profile-view">
            {error && <div className="alert alert-danger">{error}</div>}
            {!user ? (
                <div className="profile-loading">Chargement du profil...</div>
            ) : (
                <div className="profile-card">
                    <div className="profile-header">
                        <div className="profile-avatar" aria-hidden={!showImage}>
                            {user.image_url && showImage && !imageBroken ? (
                                <img
                                    src={cacheBust ? `${user.image_url}${user.image_url.includes('?') ? '&' : '?'}v=${cacheBust}` : user.image_url}
                                    alt="Photo de profil"
                                    key={user.image_url || 'profile-image'}
                                    onLoad={() => {
                                        if (imageBroken) setImageBroken(false)
                                        if (cacheBust) setCacheBust(0)
                                    }}
                                    onError={() => {
                                        if (!cacheBust) {
                                            const ts = Date.now()
                                            setCacheBust(ts)
                                        } else {
                                            setImageBroken(true)
                                        }
                                    }}
                                />
                            ) : (
                                <div className="profile-avatar-fallback" aria-label="Avatar de profil">{initials}</div>
                            )}
                        </div>
                        <div className="profile-ident">
                            <h1 className="profile-name">{user.firstname} {user.lastname}</h1>
                            <div className="profile-username">@{user.username ?? payload.username}</div>
                            <div className="profile-badges">
                                <span className={`badge ${user.isactive === 1 ? 'badge-success' : 'badge-muted'}`}>{user.isactive === 1 ? 'Actif' : 'Inactif'}</span>
                                {typeof user.isfirstlogin !== 'undefined' && (
                                    <span className={`badge ${user.isfirstlogin === 1 ? 'badge-info' : 'badge-muted'}`}>
                                        {user.isfirstlogin === 1 ? 'Première connexion' : 'Membre confirmé'}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="profile-tools">
                            <Link to="/profil?edit=1" className="profile-edit-btn" aria-label="Modifier le profil">
                                Modifier le profil
                            </Link>
                        </div>
                    </div>

                    {imageBroken && (
                        <div className="profile-error" role="alert">
                            Photo indisponible (CORS ou accès privé probable).
                        </div>
                    )}

                    <div className="details-grid" role="list">
                        <div className="detail-item" role="listitem">
                            <div className="detail-label">Email</div>
                            <div className="detail-value">{user.email ?? '—'}</div>
                        </div>
                        <div className="detail-item" role="listitem">
                            <div className="detail-label">Téléphone</div>
                            <div className="detail-value">{user.telephone ?? '—'}</div>
                        </div>
                        <div className="detail-item" role="listitem">
                            <div className="detail-label">Date de naissance</div>
                            <div className="detail-value">{user.birthday ?? '—'}</div>
                        </div>
                        <div className="detail-item" role="listitem">
                            <div className="detail-label">Identifiants parentaux</div>
                            <div className="detail-value">
                                Père: {user.id_father ?? '—'} | Mère: {user.id_mother ?? '—'}
                            </div>
                        </div>
                    </div>

                    <div className="profile-actions">
                        <Link to="/create-admin" className="btn btn-primary">Créer un administrateur</Link>
                    </div>
                </div>
            )}
        </div>
    )
}
