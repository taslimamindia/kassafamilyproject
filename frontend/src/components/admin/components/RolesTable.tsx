import { type Role, deleteRole } from '../../../services/roles'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'

// Localized dictionary for this component
const rolesTableResources = {
    fr: {
        roles: {
            deleteConfirm: 'Êtes-vous sûr de vouloir supprimer ce rôle ?',
            deleteError: 'Erreur lors de la suppression du rôle',
            table: { id: 'ID', roleName: 'Nom du rôle', actions: 'Actions', delete: 'Supprimer', edit: 'Modifier', noneFound: 'Aucun rôle trouvé' },
        },
    },
    en: {
        roles: {
            deleteConfirm: 'Are you sure you want to delete this role?',
            deleteError: 'Error deleting role',
            table: { id: 'ID', roleName: 'Role name', actions: 'Actions', delete: 'Delete', edit: 'Edit', noneFound: 'No roles found' },
        },
    },
    ar: {
        roles: {
            deleteConfirm: 'هل أنت متأكد من حذف هذا الدور؟',
            deleteError: 'خطأ أثناء حذف الدور',
            table: { id: 'المعرّف', roleName: 'اسم الدور', actions: 'إجراءات', delete: 'حذف', edit: 'تعديل', noneFound: 'لا توجد أدوار' },
        },
    },
}

for (const [lng, res] of Object.entries(rolesTableResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function RolesTable({ roles, onEdit, onDeleted }: {
    roles: Role[]
    onEdit: (role: Role) => void
    onDeleted: (id: number) => void
}) {
    const { t } = useTranslation()
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleDelete(id: number) {
        if (!window.confirm(t('roles.deleteConfirm'))) return

        setDeletingId(id)
        setError(null)
        try {
            await deleteRole(id)
            onDeleted(id)
        } catch (e) {
            setError(t('roles.deleteError'))
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
                            <th>{t('roles.table.id')}</th>
                            <th>{t('roles.table.roleName')}</th>
                            <th className="text-end">{t('roles.table.actions')}</th>
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
                                        {t('roles.table.edit')}
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => handleDelete(role.id)}
                                        disabled={deletingId === role.id}
                                    >
                                        <i className="bi bi-trash me-1"></i>
                                        {deletingId === role.id ? '...' : t('roles.table.delete')}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {roles.length === 0 && (
                            <tr>
                                <td colSpan={3} className="text-center py-4 text-muted">
                                    {t('roles.table.noneFound')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
