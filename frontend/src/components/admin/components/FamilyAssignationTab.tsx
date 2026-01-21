import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'
import type { User } from '../../../services/users'
import { getUsers } from '../../../services/users'
import { assignUsersToResponsableBulk, removeUsersFromResponsableBulk, getAllAssignments, copyResponsableAssignments, transferResponsableAssignments, getAssignedMembersByResponsable } from '../../../services/familyAssignations'
import Modal from '../../common/Modal'

const familyAssignResources = {
    fr: {
        familyAssign: {
            title1: 'Copie ou transfert des assignations entre responsables',
            title2: 'Assignation à un responsable',
            selectResponsable: 'Sélectionner le responsable',
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
                selected: 'sélectionné(s)'
            },
            table: {
                user: 'Utilisateur',
                email: 'Email',
                select: 'Sélectionner',
                selectAll: 'Tout sélectionner'
            },
            messages: {
                success: 'Opération effectuée avec succès',
                assignSuccess: 'Assignation effectuée',
                removeSuccess: 'Assignation retirée',
                error: "Erreur lors de l'opération",
                selectUserAndResponsable: 'Veuillez sélectionner un responsable et au moins un utilisateur'
            },
            actions: {
                viewMembers: 'Voir les membres',
                noMembers: 'Aucun membre assigné',
                assignedMembersTitle: 'Membres assignés'
            }
        }
    },
    en: {
        familyAssign: {
            title1: 'Copy or transfer assignments between responsables',
            title2: 'Assign to a responsible',
            selectResponsable: 'Select responsible',
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
                selected: 'selected'
            },
            table: {
                user: 'User',
                email: 'Email',
                select: 'Select',
                selectAll: 'Select All'
            },
            messages: {
                success: 'Operation successful',
                assignSuccess: 'Assignment completed',
                removeSuccess: 'Assignment removed',
                error: 'Operation failed',
                selectUserAndResponsable: 'Please select a responsible and at least one user'
            },
            actions: {
                viewMembers: 'View members',
                noMembers: 'No assigned members',
                assignedMembersTitle: 'Assigned Members'
            }
        }
    },
    ar: {
        familyAssign: {
            title1: 'نسخ أو نقل التعيينات بين المسؤولين',
            title2: 'تعيين إلى مسؤول',
            selectResponsable: 'اختر المسؤول',
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
                selected: 'محدد'
            },
            table: {
                user: 'المستخدم',
                email: 'البريد الإلكتروني',
                select: 'تحديد',
                selectAll: 'تحديد الكل'
            },
            messages: {
                success: 'تمت العملية بنجاح',
                assignSuccess: 'تم إتمام التعيين',
                removeSuccess: 'تمت إزالة التعيين',
                error: 'فشلت العملية',
                selectUserAndResponsable: 'يرجى اختيار المسؤول ومستخدم واحد على الأقل'
            },
            actions: {
                viewMembers: 'عرض الأعضاء',
                noMembers: 'لا يوجد أعضاء معينون',
                assignedMembersTitle: 'الأعضاء المعينون'
            }
        }
    }
}

for (const [lng, res] of Object.entries(familyAssignResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function FamilyAssignationTab() {
    const { t } = useTranslation()

    // Data
    const [fetchedUsers, setFetchedUsers] = useState<User[]>([])
    const [responsables, setResponsables] = useState<User[]>([])
    const [loading, setLoading] = useState(false)

    // Form selection
    const [responsableId, setResponsableId] = useState<string>('')
    const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set())

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    // Responsable filter (replace role filter): 'all' | 'with' | 'without'
    const [responsableFilter, setResponsableFilter] = useState<'all' | 'with' | 'without'>('all')
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Assignations maps
    // By assigned user: userId -> [responsableId, ...]
    const [assignmentsByAssigned, setAssignmentsByAssigned] = useState<Record<number, number[]>>({})
    // By responsable: responsableId -> [userId, ...]
    const [assignmentsByResponsable, setAssignmentsByResponsable] = useState<Record<number, number[]>>({})
    // Parents cache: parentId -> User
    const [parentsById, setParentsById] = useState<Record<number, User>>({})

    // Feedback
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'danger' } | null>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                // close any dropdowns that rely on this ref
                // we'll rely on local state toggles in UI
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Load responsables list (active users)
    useEffect(() => {
        getUsers({ status: 'active', roles: 'admingroup' }).then(setResponsables).catch(console.error)
    }, [])

    // Debounce search term to limit API calls
    useEffect(() => {
        const h = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
        return () => clearTimeout(h)
    }, [searchTerm])

    // Load Users when debounced search changes
    useEffect(() => {
        setLoading(true)
        getUsers({ status: 'all', q: debouncedSearch || undefined })
            .then(data => { setFetchedUsers(data); setSelectedUserIds(new Set()) })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [debouncedSearch])

    // Compute Visible Users based on responsable filter
    const visibleUsers = useMemo(() => {
        if (responsableFilter === 'all') return fetchedUsers
        if (responsableFilter === 'with') return fetchedUsers.filter(u => (assignmentsByAssigned[u.id]?.length || 0) > 0)
        return fetchedUsers.filter(u => !(assignmentsByAssigned[u.id]?.length))
    }, [fetchedUsers, assignmentsByAssigned, responsableFilter])

    // Fetch assignments once (then we update locally after operations)
    useEffect(() => {
        let mounted = true
        getAllAssignments()
            .then(rows => {
                if (!mounted) return
                const byAssigned: Record<number, number[]> = {}
                const byResp: Record<number, number[]> = {}
                rows.forEach(r => {
                    const uid = r.users_assigned_id
                    const rid = r.users_responsable_id
                    if (!byAssigned[uid]) byAssigned[uid] = []
                    if (!byAssigned[uid].includes(rid)) byAssigned[uid].push(rid)
                    if (!byResp[rid]) byResp[rid] = []
                    if (!byResp[rid].includes(uid)) byResp[rid].push(uid)
                })
                setAssignmentsByAssigned(byAssigned)
                setAssignmentsByResponsable(byResp)
            })
            .catch(console.error)
        return () => { mounted = false }
    }, [])

    // Fetch parents incrementally when fetchedUsers or responsables change
    useEffect(() => {
        let mounted = true
        const pids = new Set<number>()
        fetchedUsers.forEach(u => { if (u.id_father) pids.add(u.id_father); if (u.id_mother) pids.add(u.id_mother) })
        responsables.forEach(u => { if (u.id_father) pids.add(u.id_father); if (u.id_mother) pids.add(u.id_mother) })
        const allIds = Array.from(pids)
        const missing = allIds.filter(id => !(id in parentsById))
        if (missing.length) {
            getUsers({ status: 'all', id: missing.join(',') })
                .then(pars => {
                    if (!mounted) return
                    setParentsById(prev => {
                        const byId: Record<number, User> = { ...prev }
                        pars.forEach(p => { byId[p.id] = p })
                        return byId
                    })
                })
                .catch(console.error)
        }
        return () => { mounted = false }
    }, [fetchedUsers, responsables])

    const handleSelectUser = (id: number) => {
        const next = new Set(selectedUserIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedUserIds(next)
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedUserIds(new Set(visibleUsers.map(u => u.id)))
        else setSelectedUserIds(new Set())
    }

    const [isResponsableDropdownOpen, setIsResponsableDropdownOpen] = useState(false)
    const [sourceResponsable, setSourceResponsable] = useState<string>('')
    const [targetResponsable, setTargetResponsable] = useState<string>('')
    const [busy, setBusy] = useState(false)

    // Modal: Assigned members for selected responsable
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false)
    const [membersLoading, setMembersLoading] = useState(false)
    const [modalMembers, setModalMembers] = useState<User[]>([])
    const selectedResponsable = useMemo(() => responsables.find(r => String(r.id) === responsableId) || null, [responsableId, responsables])
    const assignedCount = useMemo(() => {
        if (!responsableId) return 0
        const rid = parseInt(responsableId)
        return assignmentsByResponsable[rid]?.length || 0
    }, [responsableId, assignmentsByResponsable])

    const openMembersModal = async () => {
        if (!responsableId) return
        try {
            setMembersLoading(true)
            setIsMembersModalOpen(true)
            const rid = parseInt(responsableId)
            const users = await getAssignedMembersByResponsable(rid)
            setModalMembers(users)
        } catch (e) {
            console.error(e)
            setModalMembers([])
        } finally {
            setMembersLoading(false)
        }
    }

    const handleCopyResponsable = async () => {
        if (!sourceResponsable || !targetResponsable || sourceResponsable === targetResponsable) {
            setMessage({ text: t('familyAssign.messages.error'), type: 'danger' })
            return
        }
        try {
            setBusy(true)
            await copyResponsableAssignments(parseInt(sourceResponsable), parseInt(targetResponsable))
            setMessage({ text: t('familyAssign.messages.success'), type: 'success' })
            // locally update assignments maps to avoid re-fetch
            const src = parseInt(sourceResponsable)
            const dst = parseInt(targetResponsable)
            setAssignmentsByAssigned(prev => {
                const next = { ...prev }
                const srcUsers = assignmentsByResponsable[src] || []
                srcUsers.forEach(uid => {
                    const arr = next[uid] ? [...next[uid]] : []
                    if (!arr.includes(dst)) arr.push(dst)
                    next[uid] = arr
                })
                return next
            })
            setAssignmentsByResponsable(prev => {
                const next = { ...prev }
                const srcUsers = assignmentsByResponsable[src] || []
                const dstUsers = new Set(next[dst] || [])
                srcUsers.forEach(uid => dstUsers.add(uid))
                next[dst] = Array.from(dstUsers)
                return next
            })
        } catch (e) {
            console.error(e)
            setMessage({ text: t('familyAssign.messages.error'), type: 'danger' })
        } finally {
            setBusy(false)
            setTimeout(() => setMessage(null), 3000)
        }
    }

    const handleTransferResponsable = async () => {
        if (!sourceResponsable || !targetResponsable || sourceResponsable === targetResponsable) {
            setMessage({ text: t('familyAssign.messages.error'), type: 'danger' })
            return
        }
        try {
            setBusy(true)
            await transferResponsableAssignments(parseInt(sourceResponsable), parseInt(targetResponsable))
            setMessage({ text: t('familyAssign.messages.success'), type: 'success' })
            // locally transfer assignments from source to target
            const src = parseInt(sourceResponsable)
            const dst = parseInt(targetResponsable)
            const movedUsers = assignmentsByResponsable[src] || []
            setAssignmentsByAssigned(prev => {
                const next = { ...prev }
                movedUsers.forEach(uid => {
                    const arr = new Set(next[uid] || [])
                    arr.delete(src)
                    arr.add(dst)
                    next[uid] = Array.from(arr)
                })
                return next
            })
            setAssignmentsByResponsable(prev => {
                const next = { ...prev }
                const dstSet = new Set(next[dst] || [])
                movedUsers.forEach(uid => dstSet.add(uid))
                next[dst] = Array.from(dstSet)
                next[src] = []
                return next
            })
        } catch (e) {
            console.error(e)
            setMessage({ text: t('familyAssign.messages.error'), type: 'danger' })
        } finally {
            setBusy(false)
            setTimeout(() => setMessage(null), 3000)
        }
    }

    const handleAssign = async () => {
        if (!responsableId || selectedUserIds.size === 0) {
            setMessage({ text: t('familyAssign.messages.selectUserAndResponsable'), type: 'danger' })
            return
        }
        try {
            await assignUsersToResponsableBulk(Array.from(selectedUserIds), parseInt(responsableId))
            setMessage({ text: t('familyAssign.messages.assignSuccess'), type: 'success' })
            setSelectedUserIds(new Set())
            // locally add assignments
            const rid = parseInt(responsableId)
            const userIds = Array.from(selectedUserIds)
            setAssignmentsByAssigned(prev => {
                const next = { ...prev }
                userIds.forEach(uid => {
                    const arr = new Set(next[uid] || [])
                    arr.add(rid)
                    next[uid] = Array.from(arr)
                })
                return next
            })
            setAssignmentsByResponsable(prev => {
                const next = { ...prev }
                const arr = new Set(next[rid] || [])
                userIds.forEach(uid => arr.add(uid))
                next[rid] = Array.from(arr)
                return next
            })
        } catch (e) {
            console.error(e)
            setMessage({ text: t('familyAssign.messages.error'), type: 'danger' })
        }
        setTimeout(() => setMessage(null), 3000)
    }

    const handleRemove = async () => {
        if (!responsableId || selectedUserIds.size === 0) {
            setMessage({ text: t('familyAssign.messages.selectUserAndResponsable'), type: 'danger' })
            return
        }
        try {
            await removeUsersFromResponsableBulk(Array.from(selectedUserIds), parseInt(responsableId))
            setMessage({ text: t('familyAssign.messages.removeSuccess'), type: 'success' })
            setSelectedUserIds(new Set())
            // locally remove assignments
            const rid = parseInt(responsableId)
            const userIds = Array.from(selectedUserIds)
            setAssignmentsByAssigned(prev => {
                const next = { ...prev }
                userIds.forEach(uid => {
                    const arr = new Set(next[uid] || [])
                    arr.delete(rid)
                    next[uid] = Array.from(arr)
                })
                return next
            })
            setAssignmentsByResponsable(prev => {
                const next = { ...prev }
                const arr = new Set(next[rid] || [])
                userIds.forEach(uid => arr.delete(uid))
                next[rid] = Array.from(arr)
                return next
            })
        } catch (e) {
            console.error(e)
            setMessage({ text: t('familyAssign.messages.error'), type: 'danger' })
        }
        setTimeout(() => setMessage(null), 3000)
    }

    const allSelected = visibleUsers.length > 0 && selectedUserIds.size === visibleUsers.length

    return (
        <div className="card shadow-sm border-0">
            <div className="card-body">
                <h4 className="card-title mb-4">{t('familyAssign.title1')}</h4>

                <div className="row g-3 mb-4">
                    <div className="col-md-5">
                        <label className="form-label fw-bold">Source responsable</label>
                        <select className="form-select" value={sourceResponsable} onChange={e => setSourceResponsable(e.target.value)}>
                            <option value="">--</option>
                            {responsables.map(r => (
                                <option key={r.id} value={r.id}>{r.firstname} {r.lastname} (@{r.username})</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-md-5">
                        <label className="form-label fw-bold">Cible responsable</label>
                        <select className="form-select" value={targetResponsable} onChange={e => setTargetResponsable(e.target.value)}>
                            <option value="">--</option>
                            {responsables.map(r => (
                                <option key={r.id} value={r.id}>{r.firstname} {r.lastname} (@{r.username})</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-md-2 d-flex gap-2 align-items-end">
                        <button className="btn btn-outline-primary w-100" onClick={handleCopyResponsable} disabled={busy || !sourceResponsable || !targetResponsable || sourceResponsable === targetResponsable}>Copier</button>
                        <button className="btn btn-primary w-100" onClick={handleTransferResponsable} disabled={busy || !sourceResponsable || !targetResponsable || sourceResponsable === targetResponsable}>Transférer</button>
                    </div>
                </div>

                <h4 className="card-title mb-4">{t('familyAssign.title2')}</h4>

                <div className="row g-3 align-items-end mb-4 bg-light p-3 rounded">
                    <div className="col-md-6">
                        <label className="form-label fw-bold">{t('familyAssign.selectResponsable')}</label>
                        <div className="d-flex position-relative" ref={dropdownRef}>
                            {isResponsableDropdownOpen && (
                                <div
                                    onClick={() => setIsResponsableDropdownOpen(false)}
                                    style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'transparent' }}
                                />
                            )}
                            <div className="dropdown w-100">
                                <div className="d-flex w-100 align-items-center">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary d-flex align-items-center w-100 text-start"
                                        onClick={() => setIsResponsableDropdownOpen(v => !v)}
                                        aria-expanded={isResponsableDropdownOpen}
                                    >
                                        {responsableId ? (
                                            (() => {
                                                const sel = responsables.find(r => String(r.id) === responsableId)
                                                if (!sel) return responsableId
                                                return (
                                                    <>
                                                        {sel.image_url ? (
                                                            <img src={sel.image_url} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eee' }} />
                                                        )}
                                                        <div className="ms-2 text-start" style={{ lineHeight: 1 }}>
                                                            <div className="fw-bold">{sel.firstname} {sel.lastname}</div>
                                                            <div className="text-muted small">@{sel.username}</div>
                                                        </div>
                                                        <span className="ms-auto text-muted small" style={{ marginLeft: 12 }}>▼</span>
                                                    </>
                                                )
                                            })()
                                        ) : (
                                            <div className="text-muted w-100 d-flex justify-content-between align-items-center">
                                                <span>-- <small className="text-muted ms-2">{t('familyAssign.selectResponsable')}</small></span>
                                                <span className="ms-auto">▼</span>
                                            </div>
                                        )}
                                    </button>

                                    {responsableId && (
                                        <button
                                            type="button"
                                            className="btn btn-outline-danger ms-2"
                                            title="Clear selection"
                                            onClick={() => { setResponsableId(''); setIsResponsableDropdownOpen(false) }}
                                            style={{ height: 38 }}
                                        >
                                            ✕
                                        </button>
                                    )}

                                </div>
                                <style>{`
                                    .dropdown:hover .dropdown-menu.custom-dropdown { display: block !important; }
                                    .dropdown-menu.custom-dropdown { position: absolute; top: calc(100% + 6px); left: 0; z-index: 2000; width: 100%; }
                                `}</style>
                                <ul className={`dropdown-menu w-100 custom-dropdown ${isResponsableDropdownOpen ? 'show' : ''}`} style={{ maxHeight: 300, overflowY: 'auto' }}>
                                    <li>
                                        <button type="button" className="dropdown-item" onClick={() => { setResponsableId(''); setIsResponsableDropdownOpen(false) }}>--</button>
                                    </li>
                                    {responsables.map(r => (
                                        <li key={r.id}>
                                            <button type="button" className="dropdown-item d-flex align-items-center" onClick={() => { setResponsableId(String(r.id)); setIsResponsableDropdownOpen(false) }}>
                                                {r.image_url ? (<img src={r.image_url} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />) : (<div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eee' }} />)}
                                                <div className="ms-2">
                                                    <div className="fw-bold">{r.firstname} {r.lastname}</div>
                                                    <div className="text-muted small">@{r.username}</div>
                                                    <div className="text-muted small">{(r.id_father && parentsById[r.id_father]) ? `${parentsById[r.id_father].firstname} ${parentsById[r.id_father].lastname}` : ''}{(r.id_mother && parentsById[r.id_mother]) ? `, ${(parentsById[r.id_mother].firstname)} ${parentsById[r.id_mother].lastname}` : ''}</div>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div className='col-md-2'>
                        {responsableId && (
                            <button
                                type="button"
                                className="btn btn-outline-info ms-2"
                                title={t('familyAssign.actions.viewMembers') || 'View members'}
                                onClick={openMembersModal}
                            >
                                <span style={{
                                    display: 'inline-block',
                                    maxWidth: '100%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    verticalAlign: 'middle',
                                    fontSize: 'clamp(12px, 1.6vw, 14px)'
                                }}>
                                    {t('familyAssign.actions.viewMembers')}
                                </span>
                            </button>
                        )}
                    </div>
                    <div className="col-md-4 d-flex gap-2">
                        <button className="btn btn-primary flex-grow-1" onClick={handleAssign} disabled={!responsableId || selectedUserIds.size === 0}>
                            {t('familyAssign.assign')} ({selectedUserIds.size})
                        </button>
                        <button className="btn btn-danger flex-grow-1" onClick={handleRemove} disabled={!responsableId || selectedUserIds.size === 0}>
                            {t('familyAssign.remove')} ({selectedUserIds.size})
                        </button>
                    </div>
                </div>

                {message && (
                    <div className={`alert alert-${message.type}`} role="alert">{message.text}</div>
                )}

                <div className="row g-2 mb-3">
                    <div className="col-md-4">
                        <input type="text" className="form-control" placeholder={t('familyAssign.filters.search') || ''} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>

                    <div className="col-md-3">
                        <div className="d-flex align-items-center gap-2">
                            <label className="me-2 text-muted">Filtrer:</label>
                            <div className="btn-group" role="group">
                                <button type="button" className={`btn btn-sm ${responsableFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setResponsableFilter('all')}>Tous</button>
                                <button type="button" className={`btn btn-sm ${responsableFilter === 'with' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setResponsableFilter('with')}>Avec responsable</button>
                                <button type="button" className={`btn btn-sm ${responsableFilter === 'without' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setResponsableFilter('without')}>Sans responsable</button>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-2 d-flex align-items-center">
                        <div className="form-check">
                            <input className="form-check-input" type="checkbox" id="selectAllFamilyAssign" checked={allSelected} onChange={e => handleSelectAll(e.target.checked)} disabled={visibleUsers.length === 0} />
                            <label className="form-check-label" htmlFor="selectAllFamilyAssign">{t('familyAssign.table.selectAll')}</label>
                        </div>
                    </div>
                </div>

                <div className="table-responsive" style={{ overflowY: 'auto' }}>
                    <table className="table align-middle">
                        <thead className="table-light sticky-top">
                            <tr>
                                <th style={{ width: 40 }}></th>
                                <th
                                    style={{ cursor: 'pointer' }}
                                    data-col={1}
                                    onClick={() => {
                                        const table = document.querySelector('table') as HTMLTableElement | null
                                        if (!table) return
                                        const col = 1
                                        const tbody = table.tBodies[0]
                                        const curCol = table.dataset.sortCol
                                        const curDir = table.dataset.sortDir || 'asc'
                                        const dir = curCol === String(col) ? (curDir === 'asc' ? 'desc' : 'asc') : 'asc'
                                        table.dataset.sortCol = String(col)
                                        table.dataset.sortDir = dir
                                        const rows = Array.from(tbody.querySelectorAll('tr'))
                                        rows.sort((a, b) => {
                                            const aText = (a.cells[col]?.innerText || '').trim().toLowerCase()
                                            const bText = (b.cells[col]?.innerText || '').trim().toLowerCase()
                                            return (aText > bText ? 1 : aText < bText ? -1 : 0) * (dir === 'asc' ? 1 : -1)
                                        })
                                        rows.forEach(r => tbody.appendChild(r))
                                        // update indicators
                                        document.querySelectorAll('th[data-col]').forEach(th => {
                                            const ind = th.querySelector('.sort-indicator') as HTMLElement | null
                                            if (!ind) return
                                            if (th.getAttribute('data-col') === String(col)) ind.textContent = dir === 'asc' ? ' ▲' : ' ▼'
                                            else ind.textContent = ''
                                        })
                                    }}
                                >
                                    {t('familyAssign.table.user')}<span className="sort-indicator" />
                                </th>
                                <th>{t('familyAssign.table.email')}</th>
                                <th>Parents</th>
                                <th
                                    style={{ cursor: 'pointer' }}
                                    data-col={4}
                                    onClick={() => {
                                        const table = document.querySelector('table') as HTMLTableElement | null
                                        if (!table) return
                                        const col = 4
                                        const tbody = table.tBodies[0]
                                        const curCol = table.dataset.sortCol
                                        const curDir = table.dataset.sortDir || 'asc'
                                        const dir = curCol === String(col) ? (curDir === 'asc' ? 'desc' : 'asc') : 'asc'
                                        table.dataset.sortCol = String(col)
                                        table.dataset.sortDir = dir
                                        const rows = Array.from(tbody.querySelectorAll('tr'))
                                        rows.sort((a, b) => {
                                            const getCellText = (cell: HTMLTableCellElement | undefined) => {
                                                if (!cell) return ''
                                                // prefer bold name text if present
                                                const bold = cell.querySelector('.fw-bold')
                                                if (bold) return (bold.textContent || '').trim().toLowerCase()
                                                return (cell.innerText || '').trim().toLowerCase()
                                            }
                                            const aText = getCellText(a.cells[col])
                                            const bText = getCellText(b.cells[col])
                                            return (aText > bText ? 1 : aText < bText ? -1 : 0) * (dir === 'asc' ? 1 : -1)
                                        })
                                        rows.forEach(r => tbody.appendChild(r))
                                        // update indicators
                                        document.querySelectorAll('th[data-col]').forEach(th => {
                                            const ind = th.querySelector('.sort-indicator') as HTMLElement | null
                                            if (!ind) return
                                            if (th.getAttribute('data-col') === String(col)) ind.textContent = dir === 'asc' ? ' ▲' : ' ▼'
                                            else ind.textContent = ''
                                        })
                                    }}
                                >
                                    Responsable<span className="sort-indicator" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5}>{t('admin.transactions.pm.loading') || 'Loading...'}</td></tr>
                            ) : visibleUsers.length === 0 ? (
                                <tr><td colSpan={5} className="text-muted">No users</td></tr>
                            ) : (
                                visibleUsers.map(u => (
                                    <tr key={u.id}>
                                        <td>
                                            <input type="checkbox" className="form-check-input" checked={selectedUserIds.has(u.id)} onChange={() => handleSelectUser(u.id)} />
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                {u.image_url ? (<img src={u.image_url} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />) : (
                                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eee' }} />
                                                )}
                                                <div>
                                                    <div className="fw-bold">{u.firstname} {u.lastname}</div>
                                                    <div className="text-muted small">@{u.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{u.email || '-'}</td>
                                        <td>
                                            {u.id_father && parentsById[u.id_father] ? (`${parentsById[u.id_father].firstname} ${parentsById[u.id_father].lastname}`) : '-'}{u.id_mother ? `, ${parentsById[u.id_mother] ? `${parentsById[u.id_mother].firstname} ${parentsById[u.id_mother].lastname}` : u.id_mother}` : ''}
                                        </td>
                                        <td>
                                            {(() => {
                                                const rids = assignmentsByAssigned[u.id] || []
                                                if (rids.length === 0) return <span>-</span>
                                                const rusers = rids
                                                    .map(rid => responsables.find(rr => rr.id === rid))
                                                    .filter(Boolean) as User[]
                                                if (rusers.length === 0) return <span>{rids.map(id => `#${id}`).join(', ')}</span>
                                                return (
                                                    <div className="d-flex flex-wrap gap-2">
                                                        {rusers.map(ruser => (
                                                            <div key={ruser.id} className="d-flex align-items-center gap-2 border rounded px-2 py-1">
                                                                {ruser.image_url ? (
                                                                    <img src={ruser.image_url} alt="avatar" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                                                                ) : (
                                                                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#eee' }} />
                                                                )}
                                                                <div className="small">{ruser.firstname} {ruser.lastname}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )
                                            })()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Assigned Members Modal */}
                <Modal isOpen={isMembersModalOpen} onClose={() => setIsMembersModalOpen(false)} size="lg">
                    <div className="mb-3">
                        <h5 className="mb-1">
                            {t('familyAssign.actions.assignedMembersTitle')}
                            {selectedResponsable ? (
                                <span className="text-muted fw-normal ms-2">
                                    — {selectedResponsable.firstname} {selectedResponsable.lastname} (@{selectedResponsable.username})
                                </span>
                            ) : null}
                        </h5>
                        <div className="text-muted small">{assignedCount} {t('familyAssign.table.user').toLowerCase()}</div>
                    </div>
                    {membersLoading ? (
                        <div>Loading...</div>
                    ) : modalMembers.length === 0 ? (
                        <div className="text-muted">{t('familyAssign.actions.noMembers')}</div>
                    ) : (
                        <div className="list-group">
                            {modalMembers.map(u => (
                                <div key={u.id} className="list-group-item d-flex align-items-center">
                                    {u.image_url ? (
                                        <img src={u.image_url} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eee' }} />
                                    )}
                                    <div className="ms-2">
                                        <div className="fw-bold">{u.firstname} {u.lastname}</div>
                                        <div className="text-muted small">@{u.username} · {u.email || '-'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Modal>
            </div>
        </div>
    )
}
