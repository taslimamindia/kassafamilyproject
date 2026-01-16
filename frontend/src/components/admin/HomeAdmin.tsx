import './HomeAdmin.css'
import { useState } from 'react'
import UsersTab from './components/UsersTab.tsx'
import RolesTab from './components/RolesTab.tsx'
import MemoryTab from './components/MemoryTab.tsx'
import RoleAttributionTab from './components/RoleAttributionTab.tsx'
import LevelAttributionTab from './components/LevelAttributionTab.tsx'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

// Localized dictionary for this component
const homeAdminResources = {
    fr: { admin: { space: 'Espace Administrateur', tabs: { users: 'Utilisateurs', roles: 'Rôles', attributions: 'Attributions Role', attributionsLevel: 'Attributions Level', memory: 'Mémoire' } } },
    en: { admin: { space: 'Admin Area', tabs: { users: 'Users', roles: 'Roles', attributions: 'Role Attributions', attributionsLevel: 'Level Attributions', memory: 'Memory' } } },
    ar: { admin: { space: 'منطقة الإدارة', tabs: { users: 'المستخدمون', roles: 'الأدوار', attributions: 'تعيينات الأدوار', attributionsLevel: 'تعيينات المستويات', memory: 'الذاكرة' } } },
}

for (const [lng, res] of Object.entries(homeAdminResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function HomeAdmin() {
    const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'attributions' | 'attributionsLevel' | 'memory'>('users')
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
                <li className="nav-item" role="presentation">
                    <button
                        className={`nav-link ${activeTab === 'attributions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('attributions')}
                        role="tab"
                        aria-selected={activeTab === 'attributions'}
                    >
                        {t('admin.tabs.attributions')}
                    </button>
                </li>
                <li className="nav-item" role="presentation">
                    <button
                        className={`nav-link ${activeTab === 'attributionsLevel' ? 'active' : ''}`}
                        onClick={() => setActiveTab('attributionsLevel')}
                        role="tab"
                        aria-selected={activeTab === 'attributionsLevel'}
                    >
                        {t('admin.tabs.attributionsLevel')}
                    </button>
                </li>
                <li className="nav-item" role="presentation">
                    <button
                        className={`nav-link ${activeTab === 'memory' ? 'active' : ''}`}
                        onClick={() => setActiveTab('memory')}
                        role="tab"
                        aria-selected={activeTab === 'memory'}
                    >
                        {t('admin.tabs.memory')}
                    </button>
                </li>
            </ul>

            <div>
                {activeTab === 'users' && <UsersTab />}
                {activeTab === 'roles' && <RolesTab />}
                {activeTab === 'attributions' && <RoleAttributionTab />}
                {activeTab === 'attributionsLevel' && <LevelAttributionTab />}
                {activeTab === 'memory' && <MemoryTab />}
            </div>
        </div>
    )
}
