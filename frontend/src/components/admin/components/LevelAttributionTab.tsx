import { useState, useEffect, useMemo } from 'react'
import { getUsers, updateUsersTierBulk } from '../../../services/users'
import { ALL_TIERS, getTierLabel } from '../../../constants/contributionTiers'
import type { User } from '../../../services/users'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'

const levelAttrResources = {
    fr: {
        levels: {
            title: 'Attribution de niveaux',
            selectLevelToAssign: 'Sélectionner le niveau à attribuer',
            assign: 'Attribuer',
            remove: 'Retirer',
            refresh: 'Actualiser',
            filters: {
                search: 'Rechercher un utilisateur...',
                status: 'Statut',
                active: 'Actif',
                inactive: 'Inactif',
                all: 'Tous',
                ageMin: 'Age Min',
                ageMax: 'Age Max',
                level: 'Niveau',
                allLevels: 'Tous les niveaux',
                noLevel: 'Sans niveau'
            },
            table: {
                user: 'Utilisateur',
                age: 'Age',
                currentLevel: 'Niveau actuel',
                select: 'Sélectionner',
                selectAll: 'Tout sélectionner'
            },
            messages: {
                success: 'Niveau attribué avec succès',
                removeSuccess: 'Niveau retiré avec succès',
                error: "Erreur lors de l'opération",
                selectUserAndLevel: 'Veuillez sélectionner un niveau et au moins un utilisateur',
                selectUser: 'Veuillez sélectionner au moins un utilisateur'
            }
        }
    },
    en: {
        levels: {
            title: 'Level Assignment',
            selectLevelToAssign: 'Select Level to Assign',
            assign: 'Assign',
            remove: 'Remove',
            refresh: 'Refresh',
            filters: {
                search: 'Search user...',
                status: 'Status',
                active: 'Active',
                inactive: 'Inactive',
                all: 'All',
                ageMin: 'Min Age',
                ageMax: 'Max Age',
                level: 'Level',
                allLevels: 'All levels',
                noLevel: 'No level'
            },
            table: {
                user: 'User',
                age: 'Age',
                currentLevel: 'Current Level',
                select: 'Select',
                selectAll: 'Select All'
            },
            messages: {
                success: 'Level assigned successfully',
                removeSuccess: 'Level removed successfully',
                error: "Operation failed",
                selectUserAndLevel: 'Please select a level and at least one user',
                selectUser: 'Please select at least one user'
            }
        }
    },
    ar: {
        levels: {
            title: 'تعيين المستويات',
            selectLevelToAssign: 'اختر المستوى للتعيين',
            assign: 'تعيين',
            remove: 'إزالة',
            refresh: 'تحديث',
            filters: {
                search: 'بحث عن مستخدم...',
                status: 'الحالة',
                active: 'نشط',
                inactive: 'غير نشط',
                all: 'الكل',
                ageMin: 'العمر الأدنى',
                ageMax: 'العمر الأقصى',
                level: 'مستوى',
                allLevels: 'جميع المستويات',
                noLevel: 'بدون مستوى'
            },
            table: {
                user: 'المستخدم',
                age: 'العمر',
                currentLevel: 'المستوى الحالي',
                select: 'تحديد',
                selectAll: 'تحديد الكل'
            },
            messages: {
                success: 'تم تعيين المستوى بنجاح',
                removeSuccess: 'تم إزالة المستوى بنجاح',
                error: "فشلت العملية",
                selectUserAndLevel: 'يرجى اختيار مستوى ومستخدم واحد على الأقل',
                selectUser: 'يرجى اختيار مستخدم واحد على الأقل'
            }
        }
    }
}

for (const [lng, res] of Object.entries(levelAttrResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

const calculateAge = (birthday: string | undefined) => {
    if (!birthday) return null
    const birthDate = new Date(birthday)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--
    }
    return age
}

export default function LevelAttributionTab() {
    const { t } = useTranslation()

    // Data
    const [fetchedUsers, setFetchedUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(false)

    // Form selection
    const [targetLevel, setTargetLevel] = useState<string>('')
    const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set())

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
    const [ageMin, setAgeMin] = useState<string>('')
    const [ageMax, setAgeMax] = useState<string>('')
    const [levelFilter, setLevelFilter] = useState<string>('all') // 'all', 'none', 'LEVEL1', 'LEVEL2'...

    // Feedback
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'danger' } | null>(null)

    // Load Users when basic filters change
    useEffect(() => {
        setLoading(true)
        getUsers({
            status: statusFilter,
            q: searchTerm,
            roles: 'member'
        }).then(data => {
            setFetchedUsers(data)
            setSelectedUserIds(new Set())
        }).catch(err => {
            console.error(err)
        }).finally(() => {
            setLoading(false)
        })
    }, [searchTerm, statusFilter])

    // Compute Visible Users based on Age and Level Filters
    const visibleUsers = useMemo(() => {
        return fetchedUsers.filter(user => {
            // Age Filter
            const age = calculateAge(user.birthday)
            if (ageMin && age !== null && age < parseInt(ageMin)) return false
            if (ageMax && age !== null && age > parseInt(ageMax)) return false
            if ((ageMin || ageMax) && age === null) return false // Exclude users without birthday if age filter is active

            // Level Filter
            if (levelFilter === 'none') {
                if (user.contribution_tier) return false
            } else if (levelFilter !== 'all') {
                if (user.contribution_tier !== levelFilter) return false
            }

            return true
        })
    }, [fetchedUsers, ageMin, ageMax, levelFilter])

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

    const handleAssign = async () => {
        if (!targetLevel || selectedUserIds.size === 0) {
            setMessage({ text: t('levels.messages.selectUserAndLevel'), type: 'danger' })
            return
        }

        // Optimization: Filter out users who already have this level
        const idsToUpdate = Array.from(selectedUserIds).filter(id => {
            const user = fetchedUsers.find(u => u.id === id)
            return user && user.contribution_tier !== targetLevel
        })

        if (idsToUpdate.length === 0) {
            // Nothing to do, but show success to indicate state is correct
            setMessage({ text: t('levels.messages.success'), type: 'success' })
            setSelectedUserIds(new Set())
            setTimeout(() => setMessage(null), 3000)
            return
        }

        try {
            await updateUsersTierBulk(idsToUpdate, targetLevel)

            setMessage({ text: t('levels.messages.success'), type: 'success' })
            setSelectedUserIds(new Set())

            // Refresh list
            const updatedUsers = await getUsers({
                status: statusFilter,
                q: searchTerm,
                roles: 'member'
            })
            setFetchedUsers(updatedUsers)

        } catch (error: any) {
            console.error(error)
            // Try to extract meaningful message
            let errMsg = t('levels.messages.error')
            if (error instanceof Error) {
                errMsg += ': ' + error.message
            }
            setMessage({ text: errMsg, type: 'danger' })
        }

        setTimeout(() => setMessage(null), 5000)
    }

    const handleRemove = async () => {
        if (selectedUserIds.size === 0) {
            setMessage({ text: t('levels.messages.selectUser'), type: 'danger' })
            return
        }

        // Optimization: Filter out users who already have no level (null/undefined)
        const idsToUpdate = Array.from(selectedUserIds).filter(id => {
            const user = fetchedUsers.find(u => u.id === id)
            return user && user.contribution_tier != null
        })

        if (idsToUpdate.length === 0) {
            // Nothing to do
            setMessage({ text: t('levels.messages.removeSuccess'), type: 'success' })
            setSelectedUserIds(new Set())
            setTimeout(() => setMessage(null), 3000)
            return
        }

        try {
            await updateUsersTierBulk(idsToUpdate, null)

            setMessage({ text: t('levels.messages.removeSuccess'), type: 'success' })
            setSelectedUserIds(new Set())

            // Refresh list
            const updatedUsers = await getUsers({
                status: statusFilter,
                q: searchTerm,
                roles: 'member'
            })
            setFetchedUsers(updatedUsers)

        } catch (error: any) {
            console.error(error)
            // Try to extract meaningful message
            let errMsg = t('levels.messages.error')
            if (error instanceof Error) {
                errMsg += ': ' + error.message
            }
            setMessage({ text: errMsg, type: 'danger' })
        }

        setTimeout(() => setMessage(null), 5000)
    }

    const allSelected = visibleUsers.length > 0 && selectedUserIds.size === visibleUsers.length
    const levels = ALL_TIERS

    const tierBadgeClassMap: Record<string, string> = {
        LEVEL1: 'bg-primary',
        LEVEL2: 'bg-success',
        LEVEL3: 'bg-warning text-dark',
        LEVEL4: 'bg-danger',
    }

    const getBadgeClass = (tier?: string | null) => {
        if (!tier) return 'bg-secondary'
        return tierBadgeClassMap[tier] ?? 'bg-info'
    }

    async function refreshList() {
        try {
            setLoading(true)
            const updatedUsers = await getUsers({
                status: statusFilter,
                q: searchTerm,
                roles: 'member'
            })
            setFetchedUsers(updatedUsers)
            setSelectedUserIds(new Set())
        } catch (err) {
            console.error(err)
            setMessage({ text: t('levels.messages.error'), type: 'danger' })
            setTimeout(() => setMessage(null), 5000)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="card shadow-sm border-0">
            <div className="card-body">
                <h4 className="card-title mb-4">{t('levels.title')}</h4>

                {/* Assignment Controls */}
                <div className="row g-3 align-items-end mb-4 bg-light p-3 rounded">
                    <div className="col-md-6">
                        <label className="form-label fw-bold">{t('levels.selectLevelToAssign')}</label>
                        <select
                            className="form-select"
                            value={targetLevel}
                            onChange={e => setTargetLevel(e.target.value)}
                        >
                            <option value="">Choose...</option>
                            {levels.map(l => (
                                <option key={l} value={l}>{getTierLabel(l)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-md-6 d-flex gap-2">
                        <button
                            className="btn btn-outline-secondary"
                            onClick={refreshList}
                            disabled={loading}
                            title={t('levels.refresh')}
                        >
                            <i className="bi bi-arrow-clockwise me-1"></i> {t('levels.refresh')}
                        </button>
                        <button
                            className="btn btn-primary px-4"
                            onClick={handleAssign}
                            disabled={!targetLevel || selectedUserIds.size === 0}
                        >
                            {t('levels.assign')}
                        </button>                        <button
                            className="btn btn-outline-danger px-4"
                            onClick={handleRemove}
                            disabled={selectedUserIds.size === 0}
                        >
                            {t('levels.remove')}
                        </button>                    </div>
                </div>

                {message && (
                    <div className={`alert alert-${message.type}`} role="alert">
                        {message.text}
                    </div>
                )}

                {/* Filters */}
                <div className="row g-2 mb-3">
                    <div className="col-md-3">
                        <input
                            type="text"
                            className="form-control"
                            placeholder={t('levels.filters.search')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="col-md-2">
                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                        >
                            <option value="active">{t('levels.filters.active')}</option>
                            <option value="inactive">{t('levels.filters.inactive')}</option>
                            <option value="all">{t('levels.filters.all')}</option>
                        </select>
                    </div>
                    {/* Age Min */}
                    <div className="col-md-2">
                        <input
                            type="number"
                            className="form-control"
                            placeholder={t('levels.filters.ageMin')}
                            value={ageMin}
                            onChange={(e) => setAgeMin(e.target.value)}
                        />
                    </div>
                    {/* Age Max */}
                    <div className="col-md-2">
                        <input
                            type="number"
                            className="form-control"
                            placeholder={t('levels.filters.ageMax')}
                            value={ageMax}
                            onChange={(e) => setAgeMax(e.target.value)}
                        />
                    </div>
                    {/* Level Filter */}
                    <div className="col-md-3">
                        <select
                            className="form-select"
                            value={levelFilter}
                            onChange={(e) => setLevelFilter(e.target.value)}
                        >
                            <option value="all">{t('levels.filters.allLevels')}</option>
                            <option value="none">{t('levels.filters.noLevel')}</option>
                            {levels.map(l => (
                                <option key={l} value={l}>{getTierLabel(l)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Users List */}
                <div className="table-responsive" style={{ overflowY: 'auto' }}>
                    <table className="table table-hover align-middle">
                        <thead className="table-light sticky-top">
                            <tr>
                                <th scope="col" style={{ width: '50px' }}>
                                    <div className="form-check">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                        />
                                    </div>
                                </th>
                                <th scope="col">{t('levels.table.user')}</th>
                                <th scope="col">{t('levels.table.age')}</th>
                                <th scope="col">{t('levels.table.currentLevel')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></td></tr>
                            ) : visibleUsers.length === 0 ? (
                                <tr><td colSpan={4} className="text-center p-4 text-muted">No users found</td></tr>
                            ) : (
                                visibleUsers.map(user => {
                                    const age = calculateAge(user.birthday)
                                    const isSelected = selectedUserIds.has(user.id)
                                    return (
                                        <tr key={user.id} className={isSelected ? 'table-primary' : ''}>
                                            <td>
                                                <div className="form-check">
                                                    <input
                                                        className="form-check-input"
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleSelectUser(user.id)}
                                                    />
                                                </div>
                                            </td>
                                            <td>
                                                <div className="d-flex align-items-center">
                                                    {user.image_url ? (
                                                        <img
                                                            src={user.image_url}
                                                            alt=""
                                                            className="rounded-circle me-2"
                                                            style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                                                        />
                                                    ) : (
                                                        <div className="rounded-circle me-2 bg-secondary d-flex align-items-center justify-content-center text-white" style={{ width: '32px', height: '32px' }}>
                                                            {user.firstname.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="fw-bold">{user.firstname} {user.lastname}</div>
                                                        <div className="small text-muted">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                {age !== null ? age : '-'}
                                            </td>
                                            <td>
                                                <span className={`badge ${getBadgeClass(user.contribution_tier)}`}>
                                                    {getTierLabel(user.contribution_tier) || t('levels.table.currentLevel')}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="text-muted small mt-2">
                    {visibleUsers.length} user(s) shown
                </div>
            </div>
        </div>
    )
}
