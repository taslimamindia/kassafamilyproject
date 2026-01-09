import './HomeAdmin.css'
import { useState } from 'react'
import UsersTab from './components/UsersTab.tsx'
import RolesTab from './components/RolesTab.tsx'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

// Localized dictionary for this component
const homeAdminResources = {
    fr: { admin: { space: 'Espace Administrateur', tabs: { users: 'Utilisateurs', roles: 'Rôles' } } },
    en: { admin: { space: 'Admin Area', tabs: { users: 'Users', roles: 'Roles' } } },
    ar: { admin: { space: 'منطقة الإدارة', tabs: { users: 'المستخدمون', roles: 'الأدوار' } } },
}

for (const [lng, res] of Object.entries(homeAdminResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function HomeAdmin() {
    const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users')
    const { t } = useTranslation()

    return (
        <div className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2>{t('admin.space')}</h2>
            </div>

            <ul className="nav nav-tabs mb-3" role="tablist">
                <li className="nav-item" role="presentation">
                    <button
                        className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveTab('users')}
                        role="tab"
                        aria-selected={activeTab === 'users'}
                    >
                        {t('admin.tabs.users')}
                    </button>
                </li>
                <li className="nav-item" role="presentation">
                    <button
                        className={`nav-link ${activeTab === 'roles' ? 'active' : ''}`}
                        onClick={() => setActiveTab('roles')}
                        role="tab"
                        aria-selected={activeTab === 'roles'}
                    >
                        {t('admin.tabs.roles')}
                    </button>
                </li>
            </ul>

            <div>
                {activeTab === 'users' && <UsersTab />}
                {activeTab === 'roles' && <RolesTab />}
            </div>
        </div>
    )
}
