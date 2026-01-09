import { useMemo, useState, useEffect } from 'react'
import { updateUserById, getCurrentUser, type User } from '../../../services/users'
import { getRolesForUser } from '../../../services/roleAttributions'
import FilterBar from '../../common/FilterBar'
import { filterRows } from '../../common/tableFilter'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'

// Localized dictionary for this component (decentralized)
const usersTableResources = {
    fr: {
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
            },
        },
    },
    en: {
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
            },
        },
    },
    ar: {
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
            },
        },
    },
}

for (const [lng, res] of Object.entries(usersTableResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

function UserCard({ user, isViewerAdmin, onEdit, onDelete }: { user: User, isViewerAdmin: boolean, onEdit: (u: User) => void, onDelete: (id: number) => void }) {
    const { t } = useTranslation()
    const rawActive = (user as any).isactive
    const rawFirst = (user as any).isfirstlogin
    const isActive = typeof rawActive !== 'undefined' ? (Number(rawActive) === 1 || rawActive === true) : true
    const isFirstLogin = typeof rawFirst !== 'undefined' ? (Number(rawFirst) === 1 || rawFirst === true) : false

    return (
        <div className="col-12 col-md-6 col-lg-3">
            <div className={`card h-100 shadow-sm ${isActive ? '' : 'border-secondary bg-light text-muted'}`}>
                <div className="card-header border-0 bg-transparent text-center pt-3 pb-0">
                    <div className="mx-auto bg-light rounded-circle d-flex align-items-center justify-content-center overflow-hidden"
                        style={{ width: '100px', height: '100px' }}>
                        {user.image_url ? (
                            <img src={user.image_url} alt={`${user.firstname} ${user.lastname}`} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                        ) : (
                            <i className="bi bi-person text-secondary" style={{ fontSize: '3rem' }}></i>
                        )}
                    </div>
                </div>
                <div className="card-body text-center">
                    <h5 className="card-title text-truncate mb-1" title={`${user.firstname} ${user.lastname}`}>
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
                    <button className="btn btn-sm btn-outline-primary w-100" onClick={() => onEdit(user)}>
                        <i className="bi bi-pencil me-1"></i>{t('users.card.edit')}
                    </button>
                    {isActive && (
                        <button className="btn btn-sm btn-outline-danger w-100" onClick={() => onDelete(user.id)}>
                            <i className="bi bi-trash me-1"></i>{t('users.card.deactivate')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function UsersTable({ users, onEdit, onDeleted }: {
    users: User[]
    onEdit: (user: User) => void
    onDeleted: (id: number) => void
}) {
    const { t } = useTranslation()
    const [error, setError] = useState<string | null>(null)
    const [query, setQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
    const [firstLoginFilter, setFirstLoginFilter] = useState<'all' | 'yes' | 'no'>('all')
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

    const visibleUsers = useMemo(() => filterRows(users, query, [
        u => u.id,
        u => u.firstname,
        u => u.lastname,
        u => u.username,
        u => u.email,
        u => u.telephone,
        u => u.birthday,
        u => (typeof (u as any).isactive !== 'undefined' ? (Number((u as any).isactive) === 1 ? t('users.card.active') : t('users.card.inactive')) : ''),
        u => (typeof (u as any).isfirstlogin !== 'undefined' ? (Number((u as any).isfirstlogin) === 1 ? t('users.card.first') : t('users.card.notFirst')) : ''),
    ]), [users, query])

    const sortedUsers = useMemo(() => {
        const getIsActive = (u: any) => {
            const rawActive = u?.isactive
            return typeof rawActive !== 'undefined' ? (Number(rawActive) === 1 || rawActive === true) : true
        }
        return [...visibleUsers].sort((a, b) => {
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
    }, [visibleUsers])

    const filteredUsers = useMemo(() => {
        return sortedUsers.filter(u => {
            const rawActive = (u as any).isactive
            const isActive = typeof rawActive !== 'undefined' ? (Number(rawActive) === 1 || rawActive === true) : true
            const rawFirst = (u as any).isfirstlogin
            const isFirstLogin = typeof rawFirst !== 'undefined' ? (Number(rawFirst) === 1 || rawFirst === true) : false

            if (statusFilter === 'active' && !isActive) return false
            if (statusFilter === 'inactive' && isActive) return false

            if (firstLoginFilter === 'yes' && !isFirstLogin) return false
            if (firstLoginFilter === 'no' && isFirstLogin) return false

            return true
        })
    }, [sortedUsers, statusFilter, firstLoginFilter])

    return (
        <div>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-3">
                <div className="flex-grow-1">
                    <FilterBar value={query} onChange={setQuery} placeholder={t('users.searchPlaceholder')} />
                </div>
                <div className="d-flex flex-wrap gap-3">
                    <div className="btn-group shadow-sm" role="group" aria-label={t('users.filter.status')}>
                        <input type="radio" className="btn-check" name="status" id="statusAll" autoComplete="off"
                            checked={statusFilter === 'all'} onChange={() => setStatusFilter('all')} />
                        <label className="btn btn-outline-secondary btn-sm" htmlFor="statusAll">{t('users.filter.all')}</label>

                        <input type="radio" className="btn-check" name="status" id="statusActive" autoComplete="off"
                            checked={statusFilter === 'active'} onChange={() => setStatusFilter('active')} />
                        <label className="btn btn-outline-success btn-sm" htmlFor="statusActive">{t('users.filter.active')}</label>

                        <input type="radio" className="btn-check" name="status" id="statusInactive" autoComplete="off"
                            checked={statusFilter === 'inactive'} onChange={() => setStatusFilter('inactive')} />
                        <label className="btn btn-outline-secondary btn-sm" htmlFor="statusInactive">{t('users.filter.inactive')}</label>
                    </div>

                    <div className="btn-group shadow-sm" role="group" aria-label={t('users.filter.firstLogin')}>
                        <input type="radio" className="btn-check" name="firstLogin" id="flAll" autoComplete="off"
                            checked={firstLoginFilter === 'all'} onChange={() => setFirstLoginFilter('all')} />
                        <label className="btn btn-outline-secondary btn-sm" htmlFor="flAll">{t('users.filter.flAll')}</label>

                        <input type="radio" className="btn-check" name="firstLogin" id="flYes" autoComplete="off"
                            checked={firstLoginFilter === 'yes'} onChange={() => setFirstLoginFilter('yes')} />
                        <label className="btn btn-outline-warning btn-sm text-dark" htmlFor="flYes">{t('users.filter.flYes')}</label>

                        <input type="radio" className="btn-check" name="firstLogin" id="flNo" autoComplete="off"
                            checked={firstLoginFilter === 'no'} onChange={() => setFirstLoginFilter('no')} />
                        <label className="btn btn-outline-info btn-sm text-dark" htmlFor="flNo">{t('users.filter.flNo')}</label>
                    </div>
                </div>
            </div>

            <div className="row g-3">
                {filteredUsers.map(u => (
                    <UserCard
                        key={u.id}
                        user={u}                        isViewerAdmin={isViewerAdmin}                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))}
                {filteredUsers.length === 0 && (
                    <div className="col-12 text-center py-5 text-muted">
                        {t('users.noneFound')}
                    </div>
                )}
            </div>
        </div>
    )
}
