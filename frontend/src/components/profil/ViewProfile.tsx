import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getToken } from '../../services/auth'
import { getCurrentUser, type User } from '../../services/users'
import './ViewProfile.css'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

// Localized dictionary for this component (decentralized)
const viewProfileResources = {
    fr: {
        profileView: {
            loading: 'Chargement du profil...',
            photoUnavailable: 'Photo indisponible (CORS ou accès privé probable).',
            email: 'Email',
            phone: 'Téléphone',
            birthday: 'Date de naissance',
            parentIds: 'Identifiants parentaux',
            father: 'Père',
            mother: 'Mère',
            createAdmin: 'Créer un administrateur',
        },
        profileEdit: { profilePhoto: 'Photo de profil' },
        common: { avatar: 'Avatar de profil' },
        header: { editProfile: 'Modifier le profil' },
        users: { card: { active: 'Actif', inactive: 'Inactif' } },
    },
    en: {
        profileView: {
            loading: 'Loading profile...',
            photoUnavailable: 'Photo unavailable (likely CORS or private access).',
            email: 'Email',
            phone: 'Phone',
            birthday: 'Birth date',
            parentIds: 'Parental IDs',
            father: 'Father',
            mother: 'Mother',
            createAdmin: 'Create an administrator',
        },
        profileEdit: { profilePhoto: 'Profile photo' },
        common: { avatar: 'Profile avatar' },
        header: { editProfile: 'Edit profile' },
        users: { card: { active: 'Active', inactive: 'Inactive' } },
    },
    ar: {
        profileView: {
            loading: 'جارٍ تحميل الملف...',
            photoUnavailable: 'الصورة غير متاحة (ربما CORS أو وصول خاص).',
            email: 'البريد الإلكتروني',
            phone: 'رقم الهاتف',
            birthday: 'تاريخ الميلاد',
            parentIds: 'معرّفات الوالدين',
            father: 'الأب',
            mother: 'الأم',
            createAdmin: 'إنشاء مسؤول',
        },
        profileEdit: { profilePhoto: 'صورة الملف' },
        common: { avatar: 'الصورة الرمزية للملف' },
        header: { editProfile: 'تعديل الملف' },
        users: { card: { active: 'نشط', inactive: 'غير نشط' } },
    },
}

for (const [lng, res] of Object.entries(viewProfileResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

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
    const { t } = useTranslation()
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
                setError(t('profileEdit.loadError'))
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
                <div className="profile-loading">{t('profileView.loading')}</div>
            ) : (
                <div className="profile-card">
                    <div className="profile-header">
                        <div className="profile-avatar" aria-hidden={!showImage}>
                            {user.image_url && showImage && !imageBroken ? (
                                <img
                                    src={cacheBust ? `${user.image_url}${user.image_url.includes('?') ? '&' : '?'}v=${cacheBust}` : user.image_url}
                                    alt={t('profileEdit.profilePhoto')}
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
                                <div className="profile-avatar-fallback" aria-label={t('common.avatar')}>{initials}</div>
                            )}
                        </div>
                        <div className="profile-ident">
                            <h1 className="profile-name">{user.firstname} {user.lastname}</h1>
                            <div className="profile-username">@{user.username ?? payload.username}</div>
                            <div className="profile-badges">
                                <span className={`badge ${user.isactive === 1 ? 'badge-success' : 'badge-muted'}`}>{user.isactive === 1 ? t('users.card.active') : t('users.card.inactive')}</span>
                                {typeof user.isfirstlogin !== 'undefined' && (
                                    <span className={`badge ${user.isfirstlogin === 1 ? 'badge-info' : 'badge-muted'}`}>
                                        {user.isfirstlogin === 1 ? t('common.firstLogin') : t('common.confirmedMember')}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="profile-tools">
                            <Link to="/profil?edit=1" className="profile-edit-btn" aria-label={t('header.editProfile')}>
                                {t('header.editProfile')}
                            </Link>
                        </div>
                    </div>

                    {imageBroken && (
                        <div className="profile-error" role="alert">
                            {t('profileView.photoUnavailable')}
                        </div>
                    )}

                    <div className="details-grid" role="list">
                        <div className="detail-item" role="listitem">
                            <div className="detail-label">{t('profileView.email')}</div>
                            <div className="detail-value">{user.email ?? '—'}</div>
                        </div>
                        <div className="detail-item" role="listitem">
                            <div className="detail-label">{t('profileView.phone')}</div>
                            <div className="detail-value">{user.telephone ?? '—'}</div>
                        </div>
                        <div className="detail-item" role="listitem">
                            <div className="detail-label">{t('profileView.birthday')}</div>
                            <div className="detail-value">{user.birthday ?? '—'}</div>
                        </div>
                        <div className="detail-item" role="listitem">
                            <div className="detail-label">{t('profileView.parentIds')}</div>
                            <div className="detail-value">
                                {t('profileView.father')}: {user.id_father ?? '—'} | {t('profileView.mother')}: {user.id_mother ?? '—'}
                            </div>
                        </div>
                    </div>

                    <div className="profile-actions">
                        <Link to="/create-admin" className="btn btn-primary">{t('profileView.createAdmin')}</Link>
                    </div>
                </div>
            )}
        </div>
    )
}
