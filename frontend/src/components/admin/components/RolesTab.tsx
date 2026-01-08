import { useEffect, useMemo, useState } from 'react'
import { getRoles, type Role } from '../../../services/roles'
import { listRoleAttributions, type RoleAttribution } from '../../../services/roleAttributions'
import RoleForm from './RoleForm'
import RolesTable from './RolesTable'
import RoleAssignments from './RoleAssignments'
import Modal from '../../common/Modal'

export default function RolesTab() {
    const [roles, setRoles] = useState<Role[]>([])
    const [attributions, setAttributions] = useState<RoleAttribution[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [editingId, setEditingId] = useState<number | null>(null)
    const [currentRole, setCurrentRole] = useState<Role | null>(null)

    const isEditing = useMemo(() => editingId !== null, [editingId])

    async function refresh() {
        setLoading(true)
        setError(null)
        try {
            const [rolesData, attributionsData] = await Promise.all([
                getRoles(),
                listRoleAttributions()
            ])
            setRoles(rolesData)
            setAttributions(attributionsData)
        } catch (e) {
            console.error(e)
            setError('Erreur lors du chargement des données')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { refresh() }, [])

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
                    Ajouter un rôle
                </button>
                <button className="btn btn-outline-secondary ms-2" onClick={refresh} disabled={loading}>
                    <i className="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>
                    Actualiser
                </button>
            </div>

            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            <Modal
                isOpen={isEditing}
                title={editingId === 0 ? 'Créer un rôle' : 'Modifier un rôle'}
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
