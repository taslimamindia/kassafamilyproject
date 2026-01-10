import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import UsersTab from '../admin/components/UsersTab'

// Localized dictionary for this component
const homeAdminGroupResources = {
    fr: {
        admingroup: {
            space: 'Espace Admin de Groupe',
            tabs: { users: 'Utilisateurs' }
        }
    },
    en: {
        admingroup: {
            space: 'Group Admin Area',
            tabs: { users: 'Users' }
        }
    },
    ar: {
        admingroup: {
            space: 'منطقة مسؤول المجموعة',
            tabs: { users: 'المستخدمون' }
        }
    },
}

for (const [lng, res] of Object.entries(homeAdminGroupResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function HomeAdminGroup() {
    const { t } = useTranslation()
    return (
        <div className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h2>{t('admingroup.space')}</h2>
            </div>
            <UsersTab userFormOptions={{ allowedRoleNames: ['admingroup', 'user'] }} />
        </div>
    )
}

