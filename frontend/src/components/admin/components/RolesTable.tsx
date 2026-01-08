import { type Role, deleteRole } from '../../../services/roles'
import { useState } from 'react'

export default function RolesTable({ roles, onEdit, onDeleted }: {
    roles: Role[]
    onEdit: (role: Role) => void
    onDeleted: (id: number) => void
}) {
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleDelete(id: number) {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce rôle ?')) return

        setDeletingId(id)
        setError(null)
        try {
            await deleteRole(id)
            onDeleted(id)
        } catch (e) {
            setError('Erreur lors de la suppression du rôle')
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="table-responsive">
                <table className="table table-hover align-middle shadow-sm">
                    <thead className="table-light">
                        <tr>
                            <th>ID</th>
                            <th>Nom du rôle</th>
                            <th className="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {roles.map(role => (
                            <tr key={role.id}>
                                <td>{role.id}</td>
                                <td>{role.role}</td>
                                <td className="text-end">
                                    <button
                                        className="btn btn-sm btn-outline-primary me-2"
                                        onClick={() => onEdit(role)}
                                    >
                                        <i className="bi bi-pencil me-1"></i>
                                        Modifier
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => handleDelete(role.id)}
                                        disabled={deletingId === role.id}
                                    >
                                        <i className="bi bi-trash me-1"></i>
                                        {deletingId === role.id ? '...' : 'Supprimer'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {roles.length === 0 && (
                            <tr>
                                <td colSpan={3} className="text-center py-4 text-muted">
                                    Aucun rôle trouvé
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
