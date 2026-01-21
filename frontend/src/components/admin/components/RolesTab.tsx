import { useEffect, useMemo, useState } from 'react'
import { getRoles, type Role } from '../../../services/roles'
import { listRoleAttributions, type RoleAttribution } from '../../../services/roleAttributions'
import RoleForm from './roles/RoleForm'
import RolesTable from './roles/RolesTable'
import RoleAssignments from './roles/RoleAssignments'
import Modal from '../../common/Modal'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'

// Localized dictionary for this component
const rolesTabResources = {
    fr: { roles: { loadError: 'Erreur lors du chargement des données', createRole: 'Créer un rôle', editRole: 'Modifier un rôle', filter: { status: 'Filtre statut', all: 'Tous', active: 'Actifs', inactive: 'Inactifs' } }, common: { refresh: 'Actualiser' } },
    en: { roles: { loadError: 'Error loading data', createRole: 'Create a role', editRole: 'Edit a role', filter: { status: 'Status filter', all: 'All', active: 'Active', inactive: 'Inactive' } }, common: { refresh: 'Refresh' } },
    ar: { roles: { loadError: 'خطأ أثناء تحميل البيانات', createRole: 'إنشاء دور', editRole: 'تعديل دور', filter: { status: 'تصفية الحالة', all: 'الكل', active: 'نشط', inactive: 'غير نشط' } }, common: { refresh: 'تحديث' } },
}

for (const [lng, res] of Object.entries(rolesTabResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function RolesTab() {
    const { t } = useTranslation()
    const [roles, setRoles] = useState<Role[]>([])
    const [attributions, setAttributions] = useState<RoleAttribution[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')

    const [editingId, setEditingId] = useState<number | null>(null)
    const [currentRole, setCurrentRole] = useState<Role | null>(null)

    const isEditing = useMemo(() => editingId !== null, [editingId])

    async function refresh() {
        setLoading(true)
        setError(null)
        try {
            const [rolesData, attributionsData] = await Promise.all([
                getRoles(),
                listRoleAttributions(statusFilter)
            ])
            setRoles(rolesData)
            setAttributions(attributionsData)
        } catch (e) {
            console.error(e)
            setError(t('roles.loadError'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { refresh() }, [statusFilter])

    function startCreate() {
        setEditingId(0)
        setCurrentRole(null)
    }

    function startEdit(r: Role) {
        setEditingId(r.id)
        setCurrentRole(r)
    }

    function cancelEdit() {
        setEditingId(null)
        setCurrentRole(null)
    }

    function onSaved(role: Role) {
        if (editingId === 0) {
            setRoles(prev => [...prev, role])
        } else {
            setRoles(prev => prev.map(r => r.id === role.id ? role : r))
        }
        cancelEdit()
    }

    function onDeleted(id: number) {
        setRoles(prev => prev.filter(r => r.id !== id))
    }

    return (
        <div>
             <div className="d-flex admin-actions mb-3">
                <button className="btn btn-primary" onClick={startCreate}>
                    <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
                    {t('roles.createRole')}
                </button>
                <button className="btn btn-outline-secondary ms-2" onClick={refresh} disabled={loading}>
                    <i className="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>
                    {t('common.refresh')}
                </button>
            </div>

            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            {/* Roles assignments status filter */}
            <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-3">
                <div className="btn-group shadow-sm" role="group" aria-label={t('roles.filter.status')}>
                    <input type="radio" className="btn-check" name="rolesStatus" id="rolesStatusAll" autoComplete="off"
                        checked={statusFilter === 'all'} onChange={() => setStatusFilter('all')} />
                    <label className="btn btn-outline-secondary btn-sm" htmlFor="rolesStatusAll">{t('roles.filter.all')}</label>

                    <input type="radio" className="btn-check" name="rolesStatus" id="rolesStatusActive" autoComplete="off"
                        checked={statusFilter === 'active'} onChange={() => setStatusFilter('active')} />
                    <label className="btn btn-outline-success btn-sm" htmlFor="rolesStatusActive">{t('roles.filter.active')}</label>

                    <input type="radio" className="btn-check" name="rolesStatus" id="rolesStatusInactive" autoComplete="off"
                        checked={statusFilter === 'inactive'} onChange={() => setStatusFilter('inactive')} />
                    <label className="btn btn-outline-secondary btn-sm" htmlFor="rolesStatusInactive">{t('roles.filter.inactive')}</label>
                </div>
            </div>

            <Modal
                isOpen={isEditing}
                onClose={cancelEdit} 
            >
                {isEditing && (
                    <RoleForm
                        mode={editingId === 0 ? 'create' : 'edit'}
                        initial={currentRole ?? undefined}
                        onSaved={onSaved}
                        onCancel={cancelEdit}
                    />
                )}
            </Modal>

            <RolesTable roles={roles} onEdit={startEdit} onDeleted={onDeleted} />

            <RoleAssignments attributions={attributions} />
        </div>
    )
}
