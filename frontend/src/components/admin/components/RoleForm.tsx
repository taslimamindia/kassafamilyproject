import { useState } from 'react'
import { createRole, updateRole, type Role } from '../../../services/roles'

export default function RoleForm({
    mode,
    initial,
    onSaved,
    onCancel,
}: {
    mode: 'create' | 'edit'
    initial?: Role
    onSaved: (role: Role) => void
    onCancel: () => void
}) {
    const [roleName, setRoleName] = useState(initial?.role ?? '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSaving(true)

        try {
            if (mode === 'create') {
                const newRole = await createRole({ role: roleName })
                onSaved(newRole)
            } else if (mode === 'edit' && initial) {
                const updatedRole = await updateRole(initial.id, { role: roleName })
                onSaved(updatedRole)
            }
        } catch (err) {
            setError('Erreur lors de la sauvegarde du rôle.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="mb-3">
                <label htmlFor="roleName" className="form-label">Nom du rôle</label>
                <input
                    type="text"
                    className="form-control"
                    id="roleName"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    required
                />
            </div>

            <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
                    Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
            </div>
        </form>
    )
}
