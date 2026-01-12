import { useMemo, useState, useEffect } from 'react'
import { updateUserById, getCurrentUser, getUserById, type User } from '../../../services/users'
import { getRolesForUser } from '../../../services/roleAttributions'
import FilterBar from '../../common/FilterBar'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'

// Localized dictionary for this component (decentralized)
const usersTableResources = {
    fr: {
        common: {
            id: 'ID',
            email: 'Email',
        },
        users: {
            searchPlaceholder: 'Rechercher un utilisateur…',
            filter: {
                status: 'Filtre statut',
                all: 'Tous',
                active: 'Actifs',
                inactive: 'Inactifs',
                firstLogin: 'Filtre première connexion',
                flAll: 'Tous',
                flYes: '1ère Cnx',
                flNo: 'Déjà Cnx',
            },
            noneFound: 'Aucun utilisateur trouvé',
            confirmDelete: 'Supprimer (désactiver) cet utilisateur ?',
            deactivateError: 'Erreur lors de la désactivation',
            fields: { tel: 'Tél', born: 'Né(e)' },
            card: {
                active: 'Actif',
                inactive: 'Inactif',
                first: 'Première',
                notFirst: 'Non',
                edit: 'Modifier',
                deactivate: 'Désactiver',
                showParents: 'Voir les parents',
                hideParents: 'Masquer les parents',
                parentsTitle: 'Parents',
                noParents: 'Aucun parent',
                loading: 'Chargement…',
            },
        },
    },
    en: {
        common: {
            id: 'ID',
            email: 'Email',
        },
        users: {
            searchPlaceholder: 'Search a user…',
            filter: {
                status: 'Status filter',
                all: 'All',
                active: 'Active',
                inactive: 'Inactive',
                firstLogin: 'First login filter',
                flAll: 'All',
                flYes: 'First',
                flNo: 'Already',
            },
            noneFound: 'No users found',
            confirmDelete: 'Delete (deactivate) this user?',
            deactivateError: 'Error while deactivating',
            fields: { tel: 'Tel', born: 'Born' },
            card: {
                active: 'Active',
                inactive: 'Inactive',
                first: 'First',
                notFirst: 'No',
                edit: 'Edit',
                deactivate: 'Deactivate',
                showParents: 'Show parents',
                hideParents: 'Hide parents',
                parentsTitle: 'Parents',
                noParents: 'No parents',
                loading: 'Loading…',
            },
        },
    },
    ar: {
        common: {
            id: 'المعرف',
            email: 'البريد الإلكتروني',
        },
        users: {
            searchPlaceholder: 'ابحث عن مستخدم…',
            filter: {
                status: 'تصفية الحالة',
                all: 'الكل',
                active: 'نشطون',
                inactive: 'غير نشطين',
                firstLogin: 'تصفية أول دخول',
                flAll: 'الكل',
                flYes: 'أول',
                flNo: 'سابق',
            },
            noneFound: 'لم يتم العثور على مستخدمين',
            confirmDelete: 'حذف (تعطيل) هذا المستخدم؟',
            deactivateError: 'خطأ أثناء التعطيل',
            fields: { tel: 'هاتف', born: 'مولود' },
            card: {
                active: 'نشط',
                inactive: 'غير نشط',
                first: 'أول',
                notFirst: 'لا',
                edit: 'تعديل',
                deactivate: 'تعطيل',
                showParents: 'عرض الوالدين',
                hideParents: 'إخفاء الوالدين',
                parentsTitle: 'الوالدان',
                noParents: 'لا يوجد والدان',
                loading: 'جارٍ التحميل…',
            },
        },
    },
}

for (const [lng, res] of Object.entries(usersTableResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

function getInitials(firstname?: string, lastname?: string): string {
    const parts = `${firstname ?? ''} ${lastname ?? ''}`.trim().split(/\s+/).filter(Boolean)
    const initials = parts.map(p => p.charAt(0).toUpperCase()).join('')
    return initials.slice(0, 3) || '?'
}

function UserCard({ user, isViewerAdmin, onEdit, onDelete }: { user: User, isViewerAdmin: boolean, onEdit: (u: User) => void, onDelete: (id: number) => void }) {
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
                const fetchFather = typeof user.id_father !== 'undefined' && user.id_father !== null
                    ? getUserById(user.id_father).catch(() => null)
                    : Promise.resolve(null)
                const fetchMother = typeof user.id_mother !== 'undefined' && user.id_mother !== null
                    ? getUserById(user.id_mother).catch(() => null)
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
                            <img src={user.image_url} alt={`${user.firstname} ${user.lastname}`} className="w-100 h-100" style={{ objectFit: 'cover' }} />
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
                        {isViewerAdmin && (
                            <div className="d-flex justify-content-between mb-1">
                                <span className="text-muted">{t('common.id')}:</span>
                                <span className="fw-medium">{user.id}</span>
                            </div>
                        )}
                        <div className="d-flex justify-content-between mb-1">
                            <span className="text-muted">{t('common.email')}:</span>
                            <span className="fw-medium text-truncate" style={{ maxWidth: '140px' }} title={user.email}>{user.email || '-'}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                            <span className="text-muted">{t('users.fields.tel')}:</span>
                            <span className="fw-medium">{user.telephone || '-'}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                            <span className="text-muted">{t('users.fields.born')}:</span>
                            <span className="fw-medium">{user.birthday || '-'}</span>
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
                    {isActive && (
                        <button className="btn btn-sm btn-outline-danger w-100" onClick={() => onDelete(user.id)}>
                            <i className="bi bi-trash me-1"></i>{t('users.card.deactivate')}
                        </button>
                    )}
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

export default function UsersTable({
    users,
    onEdit,
    onDeleted,
    query,
    statusFilter,
    firstLoginFilter,
    onQueryChange,
    onStatusFilterChange,
    onFirstLoginFilterChange,
}: {
    users: User[]
    onEdit: (user: User) => void
    onDeleted: (id: number) => void
    query: string
    statusFilter: 'all' | 'active' | 'inactive'
    firstLoginFilter: 'all' | 'yes' | 'no'
    onQueryChange: (q: string) => void
    onStatusFilterChange: (s: 'all' | 'active' | 'inactive') => void
    onFirstLoginFilterChange: (f: 'all' | 'yes' | 'no') => void
}) {
    const { t } = useTranslation()
    const [error, setError] = useState<string | null>(null)
    const [isViewerAdmin, setIsViewerAdmin] = useState(false)

    useEffect(() => {
        let mounted = true
        getCurrentUser().then(user => {
            if (!mounted) return
            return getRolesForUser(user.id)
        }).then(roles => {
            if (!mounted || !roles) return
            const isAdmin = roles.some(r => r.role?.toLowerCase() === 'admin')
            setIsViewerAdmin(isAdmin)
        }).catch(() => {
            // Ignore errors, default to false
        })
        return () => { mounted = false }
    }, [])

    async function onDelete(id: number) {
        if (!confirm(t('users.confirmDelete'))) return
        try {
            await updateUserById(id, { isactive: 0 })
            onDeleted(id)
        } catch (e) {
            setError(t('users.deactivateError'))
        }
    }

    const sortedUsers = useMemo(() => {
        const getIsActive = (u: any) => {
            const rawActive = u?.isactive
            return typeof rawActive !== 'undefined' ? (Number(rawActive) === 1 || rawActive === true) : true
        }
        return [...users].sort((a, b) => {
            const aActive = getIsActive(a)
            const bActive = getIsActive(b)
            if (aActive !== bActive) return aActive ? -1 : 1
            // Secondary sort: lastname then firstname then id
            const aLast = (a.lastname || '').toLowerCase()
            const bLast = (b.lastname || '').toLowerCase()
            if (aLast !== bLast) return aLast.localeCompare(bLast)
            const aFirst = (a.firstname || '').toLowerCase()
            const bFirst = (b.firstname || '').toLowerCase()
            if (aFirst !== bFirst) return aFirst.localeCompare(bFirst)
            return a.id - b.id
        })
    }, [users])

    return (
        <div>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            <div className="container-fluid p-0 mb-3">
                <div className="row g-3 align-items-center">
                    <div className="col-12 col-md-4 d-none d-md-block"></div>
                    <div className="col-12 col-md-4 d-flex justify-content-center">
                        <div className="flex-grow-1" style={{ maxWidth: '520px' }}>
                            <FilterBar value={query} onChange={onQueryChange} placeholder={t('users.searchPlaceholder')} />
                        </div>
                    </div>
                    <div className="col-12 col-md-4 d-flex justify-content-md-end justify-content-center">
                        <div className="btn-toolbar gap-2" role="toolbar" aria-label="filters">
                            <div className="btn-group shadow-sm" role="group" aria-label={t('users.filter.status')}>
                                <input type="radio" className="btn-check" name="status" id="statusAll" autoComplete="off"
                                    checked={statusFilter === 'all'} onChange={() => onStatusFilterChange('all')} />
                                <label className="btn btn-outline-secondary btn-sm" htmlFor="statusAll">{t('users.filter.all')}</label>

                                <input type="radio" className="btn-check" name="status" id="statusActive" autoComplete="off"
                                    checked={statusFilter === 'active'} onChange={() => onStatusFilterChange('active')} />
                                <label className="btn btn-outline-success btn-sm" htmlFor="statusActive">{t('users.filter.active')}</label>

                                <input type="radio" className="btn-check" name="status" id="statusInactive" autoComplete="off"
                                    checked={statusFilter === 'inactive'} onChange={() => onStatusFilterChange('inactive')} />
                                <label className="btn btn-outline-secondary btn-sm" htmlFor="statusInactive">{t('users.filter.inactive')}</label>
                            </div>

                            <div className="btn-group shadow-sm" role="group" aria-label={t('users.filter.firstLogin')}>
                                <input type="radio" className="btn-check" name="firstLogin" id="flAll" autoComplete="off"
                                    checked={firstLoginFilter === 'all'} onChange={() => onFirstLoginFilterChange('all')} />
                                <label className="btn btn-outline-secondary btn-sm" htmlFor="flAll">{t('users.filter.flAll')}</label>

                                <input type="radio" className="btn-check" name="firstLogin" id="flYes" autoComplete="off"
                                    checked={firstLoginFilter === 'yes'} onChange={() => onFirstLoginFilterChange('yes')} />
                                <label className="btn btn-outline-warning btn-sm text-dark" htmlFor="flYes">{t('users.filter.flYes')}</label>

                                <input type="radio" className="btn-check" name="firstLogin" id="flNo" autoComplete="off"
                                    checked={firstLoginFilter === 'no'} onChange={() => onFirstLoginFilterChange('no')} />
                                <label className="btn btn-outline-info btn-sm text-dark" htmlFor="flNo">{t('users.filter.flNo')}</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-3">
                {sortedUsers.map(u => (
                    <UserCard
                        key={u.id}
                        user={u}                        isViewerAdmin={isViewerAdmin}                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))}
                {sortedUsers.length === 0 && (
                    <div className="col-12 text-center py-5 text-muted">
                        {t('users.noneFound')}
                    </div>
                )}
            </div>
        </div>
    )
}
