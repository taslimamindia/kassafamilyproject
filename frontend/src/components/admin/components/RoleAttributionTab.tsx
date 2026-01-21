import { useState, useEffect, useMemo, useRef } from 'react'
import { getRoles, type Role } from '../../../services/roles'
import { getRoleLabel } from '../../../constants/roleLabels'
import { getUsers, type User } from '../../../services/users'
import { assignRoleToUsersBulk, removeRoleFromUsersBulk } from '../../../services/roleAttributions'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'

const roleAttrResources = {
    fr: {
        attributions: {
            title: 'Attribution de rôles',
            selectRoleToAssign: 'Sélectionner le rôle à attribuer / retirer',
            assign: 'Attribuer',
            remove: 'Retirer',
            filters: {
                search: 'Rechercher un utilisateur...',
                status: 'Statut',
                active: 'Actif',
                inactive: 'Inactif',
                all: 'Tous',
                filterRole: 'Filtrer par rôles',
                mode: 'Mode',
                include: 'Inclure',
                exclude: 'Exclure',
                selected: 'sélectionné(s)',
                noRolesSelected: 'Aucun rôle sélectionné'
            },
            table: {
                user: 'Utilisateur',
                email: 'Email',
                currentRoles: 'Rôles actuels',
                select: 'Sélectionner',
                selectAll: 'Tout sélectionner'
            },
            messages: {
                success: 'Opération effectuée avec succès',
                assignSuccess: 'Rôle attribué avec succès',
                removeSuccess: 'Rôle retiré avec succès',
                error: "Erreur lors de l'opération",
                selectUserAndRole: 'Veuillez sélectionner un rôle cible et au moins un utilisateur'
            }
        }
    },
    en: {
        attributions: {
            title: 'Role Assignment',
            selectRoleToAssign: 'Select Role to Assign / Remove',
            assign: 'Assign',
            remove: 'Remove',
            filters: {
                search: 'Search user...',
                status: 'Status',
                active: 'Active',
                inactive: 'Inactive',
                all: 'All',
                filterRole: 'Filter by roles',
                mode: 'Mode',
                include: 'Include',
                exclude: 'Exclude',
                selected: 'selected',
                noRolesSelected: 'No roles selected'
            },
            table: {
                user: 'User',
                email: 'Email',
                currentRoles: 'Current Roles',
                select: 'Select',
                selectAll: 'Select All'
            },
            messages: {
                success: 'Operation successful',
                assignSuccess: 'Role assigned successfully',
                removeSuccess: 'Role removed successfully',
                error: "Operation failed",
                selectUserAndRole: 'Please select a target role and at least one user'
            }
        }
    },
    ar: {
        attributions: {
            title: 'تعيين الأدوار',
            selectRoleToAssign: 'اختر الدور للتعيين / الإزالة',
            assign: 'تعيين',
            remove: 'إزالة',
            filters: {
                search: 'بحث عن مستخدم...',
                status: 'الحالة',
                active: 'نشط',
                inactive: 'غير نشط',
                all: 'الكل',
                filterRole: 'تصفية حسب الأدوار',
                mode: 'الوضع',
                include: 'تضمين',
                exclude: 'استبعاد',
                selected: 'محدد',
                noRolesSelected: 'لم يتم تحديد أدوار'
            },
            table: {
                user: 'المستخدم',
                email: 'البريد الإلكتروني',
                currentRoles: 'الأدوار الحالية',
                select: 'تحديد',
                selectAll: 'تحديد الكل'
            },
            messages: {
                success: 'تمت العملية بنجاح',
                assignSuccess: 'تم تعيين الدور بنجاح',
                removeSuccess: 'تم إزالة الدور بنجاح',
                error: "فشلت العملية",
                selectUserAndRole: 'يرجى اختيار الدور المستهدف ومستخدم واحد على الأقل'
            }
        }
    }
}

for (const [lng, res] of Object.entries(roleAttrResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function RoleAttributionTab() {
    const { t } = useTranslation()
    
    // Data
    const [roles, setRoles] = useState<Role[]>([])
    const [fetchedUsers, setFetchedUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(false)

    // Form selection
    const [targetRoleId, setTargetRoleId] = useState<string>('')
    const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set())

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
    
    // Complex Role Filter
    const [filterRoleIds, setFilterRoleIds] = useState<Set<number>>(new Set())
    const [isExcludeMode, setIsExcludeMode] = useState(false)
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Feedback
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'danger' } | null>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsRoleDropdownOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Load Roles on mount
    useEffect(() => {
        getRoles().then(setRoles).catch(console.error)
    }, [])

    // Load Users when basic filters change
    useEffect(() => {
        setLoading(true)
        // Optimization: Pass roles to backend if logic is compatible (Include Mode only)
        // If Exclude Mode, we must fetch widely and filter client-side.
        // If Include Mode, we can filter by role in backend, UNLESS we selected roles by IDs and backend needs mapped names
        // or if we have client-side specific logic.
        // Given current backend supports `IN` filter on roles (by name), we can optimize:
        
        let rolesFilter: string[] | undefined = undefined
        if (!isExcludeMode && filterRoleIds.size > 0) {
            // Map IDs to names
            const roleNames = roles
                .filter(r => filterRoleIds.has(r.id))
                .map(r => r.role)
            if (roleNames.length > 0) {
                rolesFilter = roleNames
            }
        }

        getUsers({
            status: statusFilter,
            q: searchTerm,
            roles: rolesFilter
        }).then(data => {
            setFetchedUsers(data)
            setSelectedUserIds(new Set())
        }).catch(err => {
            console.error(err)
        }).finally(() => {
            setLoading(false)
        })
    }, [searchTerm, statusFilter, filterRoleIds, isExcludeMode, roles])

    // Compute Visible Users based on Role Filters
    const visibleUsers = useMemo(() => {
        if (filterRoleIds.size === 0) return fetchedUsers

        return fetchedUsers.filter(user => {
            const userRoleIds = new Set(user.roles?.map(r => r.id) || [])
            // Check intersection
            const hasSelectedRole = [...filterRoleIds].some(id => userRoleIds.has(id))
            
            if (isExcludeMode) {
                // Exclude: Show user only if they DO NOT have any of the selected roles
                // (i.e. if user has Role A, and filter is Exclude Role A, hide user)
                return !hasSelectedRole
            } else {
                // Include: Show user only if they HAVE at least one of the selected roles
                return hasSelectedRole
            }
        })
    }, [fetchedUsers, filterRoleIds, isExcludeMode])

    const handleSelectUser = (id: number) => {
        const newSet = new Set(selectedUserIds)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelectedUserIds(newSet)
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = visibleUsers.map(u => u.id)
            setSelectedUserIds(new Set(allIds))
        } else {
            setSelectedUserIds(new Set())
        }
    }

    const toggleRoleFilter = (roleId: number) => {
        const next = new Set(filterRoleIds)
        if (next.has(roleId)) next.delete(roleId)
        else next.add(roleId)
        setFilterRoleIds(next)
    }

    const handleAssign = async () => {
        if (!targetRoleId || selectedUserIds.size === 0) {
            setMessage({ text: t('attributions.messages.selectUserAndRole'), type: 'danger' })
            return
        }

        try {
            await assignRoleToUsersBulk(Array.from(selectedUserIds), parseInt(targetRoleId))
            
            setMessage({ text: t('attributions.messages.assignSuccess'), type: 'success' })
            setSelectedUserIds(new Set())
            
            // Refresh list
            const updatedUsers = await getUsers({
                status: statusFilter,
                q: searchTerm
            })
            setFetchedUsers(updatedUsers)

        } catch (error) {
            console.error(error)
            setMessage({ text: t('attributions.messages.error'), type: 'danger' })
        }
        
        setTimeout(() => setMessage(null), 3000)
    }

    const handleRemove = async () => {
        if (!targetRoleId || selectedUserIds.size === 0) {
            setMessage({ text: t('attributions.messages.selectUserAndRole'), type: 'danger' })
            return
        }

        try {
            await removeRoleFromUsersBulk(Array.from(selectedUserIds), parseInt(targetRoleId))
            
            setMessage({ text: t('attributions.messages.removeSuccess'), type: 'success' })
            setSelectedUserIds(new Set())
            
            // Refresh list
            const updatedUsers = await getUsers({
                status: statusFilter,
                q: searchTerm
            })
            setFetchedUsers(updatedUsers)

        } catch (error) {
            console.error(error)
            setMessage({ text: t('attributions.messages.error'), type: 'danger' })
        }
        
        setTimeout(() => setMessage(null), 3000)
    }

    const allSelected = visibleUsers.length > 0 && selectedUserIds.size === visibleUsers.length

    return (
        <div className="card shadow-sm border-0">
            <div className="card-body">
                <h4 className="card-title mb-4">{t('attributions.title')}</h4>

                {/* Assignment Controls */}
                <div className="row g-3 align-items-end mb-4 bg-light p-3 rounded">
                    <div className="col-md-6">
                        <label className="form-label fw-bold">{t('attributions.selectRoleToAssign')}</label>
                        <select 
                            className="form-select" 
                            value={targetRoleId}
                            onChange={(e) => setTargetRoleId(e.target.value)}
                        >
                            <option value="">-- {t('attributions.table.select')} --</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{getRoleLabel(r.role)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-md-6 d-flex gap-2">
                        <button 
                            className="btn btn-primary flex-grow-1" 
                            onClick={handleAssign}
                            disabled={!targetRoleId || selectedUserIds.size === 0}
                        >
                            {t('attributions.assign')} ({selectedUserIds.size})
                        </button>
                        <button 
                            className="btn btn-danger flex-grow-1" 
                            onClick={handleRemove}
                            disabled={!targetRoleId || selectedUserIds.size === 0}
                        >
                            {t('attributions.remove')} ({selectedUserIds.size})
                        </button>
                    </div>
                </div>

                {message && (
                    <div className={`alert alert-${message.type}`} role="alert">
                        {message.text}
                    </div>
                )}

                {/* Filters */}
                <div className="row g-2 mb-3">
                    <div className="col-md-4">
                        <input 
                            type="text" 
                            className="form-control" 
                            placeholder={t('attributions.filters.search')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="col-md-3">
                        <select 
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                        >
                            <option value="active">{t('attributions.filters.active')}</option>
                            <option value="inactive">{t('attributions.filters.inactive')}</option>
                            <option value="all">{t('attributions.filters.all')}</option>
                        </select>
                    </div>

                    {/* Multi-select Role Filter Dropdown */}
                    <div className="col-md-3">
                        <div className="d-flex group-control" ref={dropdownRef}>
                            <button
                                className={`btn ${isExcludeMode ? 'btn-danger' : 'btn-success'} me-1`}
                                onClick={() => setIsExcludeMode(!isExcludeMode)}
                                title={isExcludeMode ? t('attributions.filters.exclude') : t('attributions.filters.include')}
                            >
                                <i className={`fas fa-${isExcludeMode ? 'minus-circle' : 'plus-circle'}`}></i> {isExcludeMode ? 'Excl' : 'Incl'}
                            </button>

                            <div className={`dropdown flex-grow-1 ${isRoleDropdownOpen ? 'show' : ''}`}>
                                <button 
                                    className="btn btn-outline-secondary dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center" 
                                    type="button"
                                    onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                                    aria-expanded={isRoleDropdownOpen}
                                >
                                    <span className="text-truncate">
                                        {filterRoleIds.size > 0 
                                            ? `${filterRoleIds.size} ${t('attributions.filters.selected')}` 
                                            : t('attributions.filters.filterRole')}
                                    </span>
                                </button>
                                <div className={`dropdown-menu w-100 p-3 shadow ${isRoleDropdownOpen ? 'show' : ''}`} style={{overflowY: 'auto'}}>
                                    <h6 className="dropdown-header px-0">{t('attributions.filters.filterRole')}</h6>
                                    {roles.map(r => (
                                        <div key={r.id} className="form-check">
                                            <input 
                                                className="form-check-input" 
                                                type="checkbox" 
                                                id={`role-filter-${r.id}`}
                                                checked={filterRoleIds.has(r.id)}
                                                onChange={() => toggleRoleFilter(r.id)}
                                            />
                                            <label className="form-check-label" htmlFor={`role-filter-${r.id}`}>
                                                {getRoleLabel(r.role)}
                                            </label>
                                        </div>
                                    ))}
                                    {filterRoleIds.size > 0 && (
                                        <div className="mt-3 pt-2 border-top text-center">
                                            <button 
                                                className="btn btn-sm btn-link text-decoration-none"
                                                onClick={() => setFilterRoleIds(new Set())}
                                            >
                                                {t('attributions.filters.all')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-2 d-flex align-items-center">
                        <div className="form-check">
                           <input 
                                className="form-check-input" 
                                type="checkbox" 
                                id="selectAll"
                                checked={allSelected}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                disabled={visibleUsers.length === 0}
                            />
                            <label className="form-check-label" htmlFor="selectAll">
                                {t('attributions.table.selectAll')}
                            </label> 
                        </div>
                    </div>
                </div>

                {/* Users List */}
                <div className="table-responsive" style={{ overflowY: 'auto' }}>
                    <table className="table table-hover align-middle">
                        <thead className="table-light sticky-top">
                            <tr>
                                <th style={{ width: '50px' }}>#</th>
                                <th>{t('attributions.table.user')}</th>
                                <th>{t('attributions.table.currentRoles')}</th>
                                <th>{t('attributions.filters.status')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-4">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : visibleUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-3 text-muted">No users found</td>
                                </tr>
                            ) : (
                                visibleUsers.map(user => (
                                    <tr 
                                        key={user.id} 
                                        className={selectedUserIds.has(user.id) ? 'table-primary' : ''}
                                        onClick={() => handleSelectUser(user.id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>
                                            <input 
                                                className="form-check-input" 
                                                type="checkbox" 
                                                checked={selectedUserIds.has(user.id)}
                                                onChange={() => {}} // Handle click on row instead
                                            />
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center">
                                                {user.image_url ? (
                                                    <img src={user.image_url} alt="" className="rounded-circle me-2" width="32" height="32" />
                                                ) : (
                                                    <div className="bg-secondary text-white rounded-circle me-2 d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                                                        {user.firstname?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="fw-bold">{user.firstname} {user.lastname}</div>
                                                    <div className="small text-muted">{user.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {user.roles && user.roles.length > 0 ? (
                                                user.roles.map(r => (
                                                    <span key={r.id} className="badge bg-secondary me-1">{getRoleLabel(r.role)}</span>
                                                ))
                                            ) : (
                                                <span className="text-muted small">-</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge bg-${user.isactive ? 'success' : 'danger'}`}>
                                                {user.isactive ? t('attributions.filters.active') : t('attributions.filters.inactive')}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
