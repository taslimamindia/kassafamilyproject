import { useMemo, useState, useEffect } from 'react'
import { updateUserById, getCurrentUser, getUserById, deleteUser, type User } from '../../../services/users'
import { getRolesForUser } from '../../../services/roleAttributions'
import { getRoles, type Role } from '../../../services/roles'
import FilterBar from '../../common/FilterBar'
import AdminActions from './AdminActions'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'
import { getTierLabel, tierOptions } from '../../../constants/contributionTiers'
import { getRoleLabel, mapRoleNamesToOptions } from '../../../constants/roleLabels'
import Select, { type StylesConfig } from 'react-select'

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
                role: 'Rôle',
                tier: 'Niveau',
                any: 'Tous',
                reset: 'Réinitialiser',
            },
            noneFound: 'Aucun utilisateur trouvé',
            confirmDelete: 'Supprimer (désactiver) cet utilisateur ?',
            confirmHardDelete: 'Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ? Cette action est irréversible.',
            deactivateError: 'Erreur lors de la désactivation',
            deleteError: 'Erreur lors de la suppression',
            fields: { tel: 'Tél', born: 'Né(e)', role: 'Rôle', tier: 'Niveau' },
            card: {
                active: 'Actif',
                inactive: 'Inactif',
                first: 'Première',
                notFirst: 'Non',
                edit: 'Modifier',
                deactivate: 'Désactiver',
                delete: 'Supprimer',
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
                role: 'Role',
                tier: 'Contribution',
                any: 'Any',
                reset: 'Reset',
            },
            noneFound: 'No users found',
            confirmDelete: 'Delete (deactivate) this user?',
            confirmHardDelete: 'Are you sure you want to permanently delete this user? This action cannot be undone.',
            deactivateError: 'Error while deactivating',
            deleteError: 'Error while deleting',
            fields: { tel: 'Tel', born: 'Born', role: 'Role', tier: 'Contribution' },
            card: {
                active: 'Active',
                inactive: 'Inactive',
                first: 'First',
                notFirst: 'No',
                edit: 'Edit',
                deactivate: 'Deactivate',
                delete: 'Delete',
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
                role: 'الدور',
                tier: 'المساهمة',
                any: 'الكل',
                reset: 'إعادة تعيين',
            },
            noneFound: 'لم يتم العثور على مستخدمين',
            confirmDelete: 'حذف (تعطيل) هذا المستخدم؟',
            confirmHardDelete: 'هل أنت متأكد أنك تريد حذف هذا المستخدم نهائيًا؟ هذا الإجراء لا يمكن التراجع عنه.',
            deactivateError: 'خطأ أثناء التعطيل',
            deleteError: 'خطأ أثناء الحذف',
            fields: { tel: 'هاتف', born: 'مولود', role: 'الدور', tier: 'المساهمة' },
            card: {
                active: 'نشط',
                inactive: 'غير نشط',
                first: 'أول',
                notFirst: 'لا',
                edit: 'تعديل',
                deactivate: 'تعطيل',
                delete: 'حذف',
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

// Compact styles for react-select to fit toolbar nicely
const compactSelectStyles: StylesConfig<{ value: string; label: string }, false> = {
    control: (base) => ({
        ...base,
        minHeight: 28,
        height: 28,
        borderColor: '#dee2e6',
        boxShadow: 'none',
    }),
    valueContainer: (base) => ({ ...base, height: 28, padding: '0 6px' }),
    indicatorsContainer: (base) => ({ ...base, height: 28 }),
    dropdownIndicator: (base) => ({ ...base, padding: 4 }),
    clearIndicator: (base) => ({ ...base, padding: 4 }),
    input: (base) => ({ ...base, margin: 0, padding: 0 }),
    placeholder: (base) => ({ ...base, margin: 0, fontSize: '0.85rem' }),
    singleValue: (base) => ({ ...base, margin: 0, fontSize: '0.85rem' }),
    menu: (base) => ({ ...base, zIndex: 10 }),
}

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

function UserCard({ user, isViewerAdmin, imageBustToken, onEdit, onDelete, onHardDelete }: { user: User, isViewerAdmin: boolean, imageBustToken: number, onEdit: (u: User) => void, onDelete: (id: number) => void, onHardDelete: (id: number) => void }) {
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
    roleFilter,
    onRoleFilterChange,
    tierFilter,
    onTierFilterChange,
    imageBustToken,
    onCreate,
    onRefresh,
    loading,
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
    roleFilter: string
    onRoleFilterChange: (r: string) => void
    tierFilter: string
    onTierFilterChange: (t: string) => void
    imageBustToken: number
    onCreate: () => void
    onRefresh: () => void
    loading: boolean
}) {
    const { t } = useTranslation()
    const [error, setError] = useState<string | null>(null)
    const [isViewerAdmin, setIsViewerAdmin] = useState(false)
    const [roleOptions, setRoleOptions] = useState<Role[]>([])

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
        getRoles().then(rs => { if (mounted) setRoleOptions(rs) }).catch(() => { })
        return () => { mounted = false }
    }, [])

    async function onDelete(id: number) {
        if (!confirm(t('users.confirmDelete'))) return
        try {
            await updateUserById(id, { isactive: 0 })
            // Notify parent to refresh
            onDeleted(id)
        } catch (e) {
            setError(t('users.deactivateError'))
        }
    }

    async function onHardDelete(id: number) {
        if (!confirm(t('users.confirmHardDelete'))) return
        try {
            await deleteUser(id, true)
            // Notify parent to refresh
            onDeleted(id)
        } catch (e) {
            setError(t('users.deleteError'))
        }
    }

    const sortedUsers = useMemo(() => {
        const getIsActive = (u: any) => {
            const rawActive = u?.isactive
            return typeof rawActive !== 'undefined' ? (Number(rawActive) === 1 || rawActive === true) : true
        }
        return [...users].sort((a, b) => {
            // Primary sort: active users first
            const aActive = getIsActive(a)
            const bActive = getIsActive(b)
            if (aActive !== bActive) return aActive ? -1 : 1

            // Secondary sort: firstname then lastname
            const aFirst = (a.firstname || '').toLowerCase()
            const bFirst = (b.firstname || '').toLowerCase()
            if (aFirst !== bFirst) return aFirst.localeCompare(bFirst)

            // Tertiary sort: lastname then id
            const aLast = (a.lastname || '').toLowerCase()
            const bLast = (b.lastname || '').toLowerCase()
            if (aLast !== bLast) return aLast.localeCompare(bLast)

            // Final sort: by id
            return a.id - b.id
        })
    }, [users])

    return (
        <div>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <div className="container-fluid p-0 mb-3">
                <div className='row'>
                    <div className='col-6 d-flex align-items-center'>
                        <div className="flex-grow-1" style={{ minWidth: '240px' }}>
                            <FilterBar value={query} onChange={onQueryChange} placeholder={t('users.searchPlaceholder')} />
                        </div>
                    </div>
                    <div className='col-6 d-flex align-items-center justify-content-end'>
                        <AdminActions onCreate={onCreate} onRefresh={onRefresh} loading={loading} />
                    </div>
                </div>
                <div className='row'>

                </div>


                <div className="d-flex flex-wrap align-items-center gap-2">

                    <div className="btn-toolbar gap-2" role="toolbar" aria-label="filters">
                        <div className="btn-group shadow-sm" role="group" aria-label={t('users.filter.status')}>
                            <input type="radio" className="btn-check" name="status" id="statusAll" autoComplete="off"
                                checked={statusFilter === 'all'} onChange={() => onStatusFilterChange('all')} />
                            <label className="btn btn-outline-secondary btn-sm" htmlFor="statusAll"><i className="bi bi-list me-1"></i>{t('users.filter.all')}</label>

                            <input type="radio" className="btn-check" name="status" id="statusActive" autoComplete="off"
                                checked={statusFilter === 'active'} onChange={() => onStatusFilterChange('active')} />
                            <label className="btn btn-outline-success btn-sm" htmlFor="statusActive"><i className="bi bi-check-circle me-1"></i>{t('users.filter.active')}</label>

                            <input type="radio" className="btn-check" name="status" id="statusInactive" autoComplete="off"
                                checked={statusFilter === 'inactive'} onChange={() => onStatusFilterChange('inactive')} />
                            <label className="btn btn-outline-secondary btn-sm" htmlFor="statusInactive"><i className="bi bi-slash-circle me-1"></i>{t('users.filter.inactive')}</label>
                        </div>

                        {isViewerAdmin && (
                                <div className="btn-group shadow-sm" role="group" aria-label={t('users.filter.firstLogin')}>
                                    <input type="radio" className="btn-check" name="firstLogin" id="flAll" autoComplete="off"
                                        checked={firstLoginFilter === 'all'} onChange={() => onFirstLoginFilterChange('all')} />
                                    <label className="btn btn-outline-secondary btn-sm" htmlFor="flAll"><i className="bi bi-list me-1"></i>{t('users.filter.flAll')}</label>

                                    <input type="radio" className="btn-check" name="firstLogin" id="flYes" autoComplete="off"
                                        checked={firstLoginFilter === 'yes'} onChange={() => onFirstLoginFilterChange('yes')} />
                                    <label className="btn btn-outline-warning btn-sm text-dark" htmlFor="flYes"><i className="bi bi-stars me-1"></i>{t('users.filter.flYes')}</label>

                                    <input type="radio" className="btn-check" name="firstLogin" id="flNo" autoComplete="off"
                                        checked={firstLoginFilter === 'no'} onChange={() => onFirstLoginFilterChange('no')} />
                                    <label className="btn btn-outline-info btn-sm text-dark" htmlFor="flNo"><i className="bi bi-person-check me-1"></i>{t('users.filter.flNo')}</label>
                                </div>
                            )
                        }



                        <div className="shadow-sm d-flex align-items-center gap-1">
                            <i className="bi bi-person-badge text-muted"></i>
                            <div style={{ width: '160px' }}>
                                <Select
                                    isClearable
                                    placeholder={t('users.filter.role')}
                                    styles={compactSelectStyles}
                                    value={roleFilter !== 'all' ? { value: roleFilter, label: getRoleLabel(roleFilter) } : null}
                                    onChange={(opt) => onRoleFilterChange(opt?.value ?? 'all')}
                                    options={mapRoleNamesToOptions(roleOptions)}
                                />
                            </div>
                        </div>
                        <div className="shadow-sm d-flex align-items-center gap-1">
                            <i className="bi bi-bar-chart text-muted"></i>
                            <div style={{ width: '180px' }}>
                                <Select
                                    isClearable
                                    placeholder={t('users.filter.tier')}
                                    styles={compactSelectStyles}
                                    value={tierFilter !== 'all' ? { value: tierFilter, label: getTierLabel(tierFilter as any) } : null}
                                    onChange={(opt) => onTierFilterChange(opt?.value ?? 'all')}
                                    options={tierOptions()}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="ms-auto">
                        <button className="btn btn-sm btn-outline-secondary" type="button"
                            onClick={() => { onQueryChange(''); onStatusFilterChange('active'); onFirstLoginFilterChange('all'); onRoleFilterChange('all'); onTierFilterChange('all') }}>
                            <i className="bi bi-broom me-1"></i>{t('users.filter.reset')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="row g-3">
                {sortedUsers.map(u => (
                    <UserCard
                        key={u.id}
                        user={u}
                        isViewerAdmin={isViewerAdmin}
                        imageBustToken={imageBustToken}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onHardDelete={onHardDelete}
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
