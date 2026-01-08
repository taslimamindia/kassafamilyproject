import './HomeAdmin.css'
import { useState } from 'react'
import UsersTab from './components/UsersTab.tsx'
import RolesTab from './components/RolesTab.tsx'

export default function HomeAdmin() {
    const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users')

    return (
        <div className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2>Espace Administrateur</h2>
            </div>

            <ul className="nav nav-tabs mb-3" role="tablist">
                <li className="nav-item" role="presentation">
                    <button
                        className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveTab('users')}
                        role="tab"
                        aria-selected={activeTab === 'users'}
                    >
                        Utilisateurs
                    </button>
                </li>
                <li className="nav-item" role="presentation">
                    <button
                        className={`nav-link ${activeTab === 'roles' ? 'active' : ''}`}
                        onClick={() => setActiveTab('roles')}
                        role="tab"
                        aria-selected={activeTab === 'roles'}
                    >
                        Rôles
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
