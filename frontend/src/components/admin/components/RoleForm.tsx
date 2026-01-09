import { useState } from 'react'
import { createRole, updateRole, type Role } from '../../../services/roles'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'

// Localized dictionary for this component (decentralized)
const roleFormResources = {
    fr: { roles: { form: { roleName: 'Nom du rôle', saveError: 'Erreur lors de la sauvegarde du rôle.', saving: 'Enregistrement...' } } },
    en: { roles: { form: { roleName: 'Role name', saveError: 'Error saving role.', saving: 'Saving...' } } },
    ar: { roles: { form: { roleName: 'اسم الدور', saveError: 'خطأ أثناء حفظ الدور.', saving: 'جارٍ الحفظ...' } } },
}

for (const [lng, res] of Object.entries(roleFormResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

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
    const { t } = useTranslation()
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
            setError(t('roles.form.saveError'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="mb-3">
                <label htmlFor="roleName" className="form-label">{t('roles.form.roleName')}</label>
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
                    {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? t('roles.form.saving') : t('common.save')}
                </button>
            </div>
        </form>
    )
}
