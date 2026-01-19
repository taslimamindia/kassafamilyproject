import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getUserById, type User } from '../../../../services/users'
import { getTierLabel } from '../../../../constants/contributionTiers'
import { getRoleLabel } from '../../../../constants/roleLabels'
import './UserCard.css'

function appendCacheBust(url?: string, token?: number): string | undefined {
    if (!url) return url
    if (!token) return url
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}cb=${token}`
}

function getInitials(firstname?: string, lastname?: string): string {
    const parts = `${firstname ?? ''} ${lastname ?? ''}`.trim().split(/\s+/).filter(Boolean)
    const initials = parts.map(p => p.charAt(0).toUpperCase()).join('')
    return initials.slice(0, 3) || '?'
}

export default function UserCard({ user, isViewerAdmin, imageBustToken, onEdit, onDelete, onHardDelete }: { user: User, isViewerAdmin: boolean, imageBustToken: number, onEdit: (u: User) => void, onDelete: (id: number) => void, onHardDelete: (id: number) => void }) {
    const { t } = useTranslation()
    const rawActive = (user as any).isactive
    const rawFirst = (user as any).isfirstlogin
    const isActive = typeof rawActive !== 'undefined' ? (Number(rawActive) === 1 || rawActive === true) : true
    const isFirstLogin = typeof rawFirst !== 'undefined' ? (Number(rawFirst) === 1 || rawFirst === true) : false
    const [showParents, setShowParents] = useState(false)
    const [parentsLoading, setParentsLoading] = useState(false)
    const [parents, setParents] = useState<{ father: User | null, mother: User | null } | null>(null)

    async function toggleParents() {
        const next = !showParents
        setShowParents(next)
        if (next && !parents) {
            setParentsLoading(true)
            try {
                const fetchFather = typeof (user as any).id_father !== 'undefined' && (user as any).id_father !== null
                    ? getUserById((user as any).id_father).catch(() => null)
                    : Promise.resolve(null)
                const fetchMother = typeof (user as any).id_mother !== 'undefined' && (user as any).id_mother !== null
                    ? getUserById((user as any).id_mother).catch(() => null)
                    : Promise.resolve(null)
                const [father, mother] = await Promise.all([fetchFather, fetchMother])
                setParents({ father, mother })
            } finally {
                setParentsLoading(false)
            }
        }
    }

    return (
        <div className="col-12 col-sm-6 col-lg-4">
            <div className={`card h-100 shadow-sm border-0 rounded-4 ${isActive ? '' : 'bg-light text-muted'}`}>
                <div className="card-header border-0 bg-transparent text-center pt-3 pb-0">
                    <div className="mx-auto rounded-circle d-flex align-items-center justify-content-center overflow-hidden"
                        style={{ width: '110px', height: '110px', background: 'radial-gradient( circle at 30% 30%, #ffe0f0, #e6f7ff )' }}>
                        {user.image_url ? (
                            <img src={appendCacheBust(user.image_url, imageBustToken)} alt={`${user.firstname} ${user.lastname}`} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                        ) : (
                            <span className="fw-bold" style={{ fontSize: '2rem', letterSpacing: '0.08rem' }}>
                                {getInitials(user.firstname, user.lastname)}
                            </span>
                        )}
                    </div>
                </div>
                <div className="card-body text-center">
                    <h5 className="card-title text-truncate mb-1 fw-semibold" title={`${user.firstname} ${user.lastname}`}>
                        {user.firstname} {user.lastname}
                    </h5>
                    <p className="card-subtitle mb-3 text-muted small">@{user.username}</p>

                    <div className="text-start small mb-3 px-2">
                        <div className="d-flex flex-wrap gap-2 align-items-center">
                            {isViewerAdmin && (
                                <span className="badge bg-light text-muted border rounded-pill" title={`ID: ${user.id}`}>#{user.id}</span>
                            )}
                            {user.email && (
                                <a href={`mailto:${user.email}`} className="badge bg-light text-dark border rounded-pill text-decoration-none text-truncate" style={{ maxWidth: '180px' }} title={user.email}>
                                    <i className="bi bi-envelope me-1" />{user.email}
                                </a>
                            )}
                            {user.telephone && (
                                <a href={`tel:${user.telephone}`} className="badge bg-light text-dark border rounded-pill text-decoration-none text-truncate" style={{ maxWidth: '160px' }} title={user.telephone}>
                                    <i className="bi bi-telephone me-1" />{user.telephone}
                                </a>
                            )}
                            {user.birthday && (
                                <span className="badge bg-light text-dark border rounded-pill text-truncate" style={{ maxWidth: '160px' }} title={user.birthday}>
                                    <i className="bi bi-calendar3 me-1" />{user.birthday}
                                </span>
                            )}
                            {(user.roles || []).length > 0 && (
                                <span className="d-inline-flex align-items-center gap-1" title={(user.roles || []).map(r => r.role).join(', ')}>
                                    {(user.roles || []).map(r => (
                                        <span key={r.id} className="badge bg-secondary-subtle text-secondary rounded-pill">{getRoleLabel(r.role)}</span>
                                    ))}
                                </span>
                            )}
                            {getTierLabel(user.contribution_tier) && (
                                <span className="badge bg-info-subtle text-info rounded-pill text-truncate" style={{ maxWidth: '160px' }} title={getTierLabel(user.contribution_tier)}>
                                    <i className="bi bi-bar-chart-fill me-1" />{getTierLabel(user.contribution_tier)}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="d-flex justify-content-center gap-2 flex-wrap">
                        <span className={`badge rounded-pill ${isActive ? 'bg-success' : 'bg-secondary'}`}>
                            {isActive ? <><i className="bi bi-check-circle me-1" />{t('users.card.active')}</> : <><i className="bi bi-slash-circle me-1" />{t('users.card.inactive')}</>}
                        </span>
                        <span className={`badge rounded-pill ${isFirstLogin ? 'bg-warning text-dark' : 'bg-info text-white'}`}>
                            {isFirstLogin ? <><i className="bi bi-stars me-1" />{t('users.card.first')}</> : <><i className="bi bi-person-check me-1" />{t('users.card.notFirst')}</>}
                        </span>
                    </div>
                </div>
                <div className="card-footer bg-transparent border-0 pb-3 pt-0 d-flex flex-column gap-2 px-3">
                    <button className="btn btn-sm btn-primary w-100" onClick={() => onEdit(user)}>
                        <i className="bi bi-pencil me-1"></i>{t('users.card.edit')}
                    </button>
                    {isActive ? (
                        <button className="btn btn-sm btn-outline-warning w-100 text-dark" onClick={() => onDelete(user.id)}>
                            <i className="bi bi-power me-1"></i>{t('users.card.deactivate')}
                        </button>
                    ) : (isViewerAdmin ? (
                        <button className="btn btn-sm btn-danger w-100" onClick={() => onHardDelete(user.id)}>
                            <i className="bi bi-trash me-1"></i>{t('users.card.delete')}
                        </button>
                    ) : null)}

                    <button className="btn btn-sm btn-outline-secondary w-100" onClick={toggleParents}>
                        <i className={`bi ${showParents ? 'bi-eye-slash' : 'bi-people'} me-1`}></i>
                        {showParents ? t('users.card.hideParents') : t('users.card.showParents')}
                    </button>
                    {showParents && (
                        <div className="bg-light rounded-3 p-2 mt-1 text-start small">
                            <div className="fw-semibold mb-2"><i className="bi bi-people me-1"></i>{t('users.card.parentsTitle')}</div>
                            {parentsLoading && (
                                <div className="text-muted">{t('users.card.loading')}</div>
                            )}
                            {!parentsLoading && parents && (!parents.father && !parents.mother) && (
                                <div className="text-muted">{t('users.card.noParents')}</div>
                            )}
                            {!parentsLoading && parents && (
                                <div className="d-flex flex-column gap-1">
                                    {parents.father && (
                                        <div>
                                            <span className="me-1">👨</span>
                                            <span className="fw-medium">{parents.father.firstname} {parents.father.lastname}</span>
                                            <span className="text-muted ms-1">@{parents.father.username}</span>
                                        </div>
                                    )}
                                    {parents.mother && (
                                        <div>
                                            <span className="me-1">👩</span>
                                            <span className="fw-medium">{parents.mother.firstname} {parents.mother.lastname}</span>
                                            <span className="text-muted ms-1">@{parents.mother.username}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
