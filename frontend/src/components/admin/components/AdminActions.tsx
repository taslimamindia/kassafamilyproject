import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'

// Localized dictionary for this component
const adminActionsResources = {
    fr: { admin: { addUser: 'Ajouter un utilisateur' }, common: { refresh: 'Actualiser' } },
    en: { admin: { addUser: 'Add a user' }, common: { refresh: 'Refresh' } },
    ar: { admin: { addUser: 'إضافة مستخدم' }, common: { refresh: 'تحديث' } },
}

for (const [lng, res] of Object.entries(adminActionsResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function AdminActions({ onCreate, onRefresh, loading }: {
    onCreate: () => void
    onRefresh: () => void
    loading?: boolean
}) {
    const { t } = useTranslation()
    return (
        <div className="d-flex admin-actions mb-3">
            <button className="btn btn-primary" onClick={onCreate}>
                <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
                {t('admin.addUser')}
            </button>
            <button className="btn btn-outline-secondary" onClick={onRefresh} disabled={loading}>
                <i className="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>
                {t('common.refresh')}
            </button>
        </div>
    )
}
