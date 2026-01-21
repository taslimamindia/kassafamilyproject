import { useMemo, useState, useEffect } from 'react'
import { updateUserById, getCurrentUser, deleteUser, type User } from '../../../../services/users'
import { getRolesForUser } from '../../../../services/roleAttributions'
import { getRoles, type Role } from '../../../../services/roles'
import FilterBar from '../../../common/FilterBar'
import AdminActions from './AdminActions'
import { useTranslation } from 'react-i18next'
import i18n from '../../../../i18n'
import { getTierLabel, tierOptions } from '../../../../constants/contributionTiers'
import { getRoleLabel, mapRoleNamesToOptions } from '../../../../constants/roleLabels'
import Select, { type StylesConfig } from 'react-select'
import UserCard from './UserCard'

// Localized dictionary for this component (decentralized)
const usersTableResources = {
    fr: {
        common: {
            id: 'ID',
            email: 'Email',
        },
        users: {
            searchPlaceholder: 'Rechercher un membre…',
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
            noneFound: 'Aucun membre trouvé',
            confirmDelete: 'Supprimer (désactiver) cet membre ?',
            confirmHardDelete: 'Êtes-vous sûr de vouloir supprimer définitivement cet membre ? Cette action est irréversible.',
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
            searchPlaceholder: 'Search a member…',
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
            noneFound: 'No members found',
            confirmDelete: 'Delete (deactivate) this member?',
            confirmHardDelete: 'Are you sure you want to permanently delete this member? This action cannot be undone.',
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
            noneFound: 'لم يتم العثور على أعضاء',
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
                    <div className='col-12 col-md-6 d-flex align-items-center'>
                        <div className="flex-grow-1" style={{ minWidth: '240px' }}>
                            <FilterBar value={query} onChange={onQueryChange} placeholder={t('users.searchPlaceholder')} />
                        </div>
                    </div>
                    <div className='col-12 col-md-6 d-flex align-items-center justify-content-end'>
                        <AdminActions onCreate={onCreate} onRefresh={onRefresh} loading={loading} />
                    </div>
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
