import { useTranslation } from 'react-i18next'
import i18n from '../../../../i18n'
import './AdminActions.css'

// Localized dictionary for this component
const adminActionsResources = {
    fr: { admin: { addUser: 'Ajouter un membre' }, common: { refresh: 'Actualiser' } },
    en: { admin: { addUser: 'Add a member' }, common: { refresh: 'Refresh' } },
    ar: { admin: { addUser: 'إضافة عضو' }, common: { refresh: 'تحديث' } },
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
            <button className="btn btn-outline-secondary btn-icon" onClick={onRefresh} disabled={loading} title={t('common.refresh')} aria-label={t('common.refresh')}>
                <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
                <span className="visually-hidden">{t('common.refresh')}</span>
            </button>
        </div>
    )
}
