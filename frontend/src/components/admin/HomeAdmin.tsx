import './HomeAdmin.css'
import { useState } from 'react'
import UsersTab from './components/UsersTab.tsx'
import RolesTab from './components/RolesTab.tsx'
import MemoryTab from './components/MemoryTab.tsx'
import RoleAttributionTab from './components/RoleAttributionTab.tsx'
import LevelAttributionTab from './components/LevelAttributionTab.tsx'
import PaymentMethodsTab from './components/PaymentMethodsTab.tsx'
import MetricsTab from './components/MetricsTab.tsx'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

// Localized dictionary for this component
const homeAdminResources = {
    fr: { admin: { space: 'Espace Administrateur', tabs: { users: 'Utilisateurs', roles: 'Rôles', attributions: 'Attributions Role', attributionsLevel: 'Attributions Level', memory: 'Mémoire', transactions: 'Transactions', metrics: 'Métriques' }, transactions: { pm: { title: 'Ajouter une méthode de paiement', name: 'Méthode de paiement', selectName: 'Sélectionner une méthode', typeName: 'Saisissez une méthode', invalidName: 'Veuillez utiliser un nom autorisé', active: 'Active', create: 'Créer', created: 'Méthode créée', createFailed: 'Échec de la création', requiredName: 'Veuillez sélectionner une méthode', typeOfProof: 'Type de justificatif', proofTransactionNumber: 'Numéro de transaction', proofLink: 'Lien (image)', colTypeOfProof: 'Type de justificatif', listTitle: 'Méthodes existantes', refresh: 'Rafraîchir', colName: 'Nom', colActive: 'Active', colUpdated: 'Mis à jour', colActions: 'Actions', loading: 'Chargement...', empty: 'Aucune méthode de paiement', inactive: 'Inactive', deactivate: 'Désactiver', activate: 'Activer', updated: 'Mise à jour', updateFailed: 'Échec de la mise à jour', listFailed: 'Échec du chargement des méthodes' } }, metrics: { title: 'Métriques Prometheus', refresh: 'Rafraîchir', filterLabel: 'Filtrer par nom', loading: 'Chargement...', failed: 'Échec du chargement des métriques' } } },
    en: { admin: { space: 'Admin Area', tabs: { users: 'Users', roles: 'Roles', attributions: 'Role Attributions', attributionsLevel: 'Level Attributions', memory: 'Memory', transactions: 'Transactions', metrics: 'Metrics' }, transactions: { pm: { title: 'Add Payment Method', name: 'Payment Method', selectName: 'Select a method', typeName: 'Type a method name', invalidName: 'Please use an allowed name', active: 'Active', create: 'Create', created: 'Payment method created', createFailed: 'Failed to create payment method', requiredName: 'Please select a payment method name', typeOfProof: 'Type of Proof', proofTransactionNumber: 'Transaction Number', proofLink: 'Link (image)', colTypeOfProof: 'Type of Proof', listTitle: 'Existing Payment Methods', refresh: 'Refresh', colName: 'Name', colActive: 'Active', colUpdated: 'Updated', colActions: 'Actions', loading: 'Loading...', empty: 'No payment methods', inactive: 'Inactive', deactivate: 'Deactivate', activate: 'Activate', updated: 'Updated', updateFailed: 'Failed to update', listFailed: 'Failed to load payment methods' } }, metrics: { title: 'Prometheus Metrics', refresh: 'Refresh', filterLabel: 'Filter by name', loading: 'Loading...', failed: 'Failed to load metrics' } } },
    ar: { admin: { space: 'منطقة الإدارة', tabs: { users: 'المستخدمون', roles: 'الأدوار', attributions: 'تعيينات الأدوار', attributionsLevel: 'تعيينات المستويات', memory: 'الذاكرة', transactions: 'المعاملات', metrics: 'القياسات' }, transactions: { pm: { title: 'إضافة طريقة دفع', name: 'طريقة الدفع', selectName: 'اختر الطريقة', typeName: 'اكتب اسم الطريقة', invalidName: 'يرجى استخدام اسم مسموح به', active: 'نشط', create: 'إنشاء', created: 'تم إنشاء الطريقة', createFailed: 'فشل إنشاء طريقة الدفع', requiredName: 'يرجى اختيار اسم الطريقة', typeOfProof: 'نوع الإثبات', proofTransactionNumber: 'رقم المعاملة', proofLink: 'رابط (صورة)', colTypeOfProof: 'نوع الإثبات', listTitle: 'طرق الدفع الحالية', refresh: 'تحديث', colName: 'الاسم', colActive: 'نشط', colUpdated: 'تم التحديث', colActions: 'الإجراءات', loading: 'جار التحميل...', empty: 'لا توجد طرق دفع', inactive: 'غير نشط', deactivate: 'تعطيل', activate: 'تفعيل', updated: 'تم التحديث', updateFailed: 'فشل التحديث', listFailed: 'فشل تحميل طرق الدفع' } }, metrics: { title: 'قياسات بروميتيوس', refresh: 'تحديث', filterLabel: 'تصفية حسب الاسم', loading: 'جار التحميل...', failed: 'فشل تحميل القياسات' } } },
}

for (const [lng, res] of Object.entries(homeAdminResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function HomeAdmin() {
    const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'attributions' | 'attributionsLevel' | 'memory' | 'transactions' | 'metrics'>('users')
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
                <li className="nav-item" role="presentation">
                    <button
                        className={`nav-link ${activeTab === 'transactions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('transactions')}
                        role="tab"
                        aria-selected={activeTab === 'transactions'}
                    >
                        {t('admin.tabs.transactions')}
                    </button>
                </li>
                <li className="nav-item" role="presentation">
                    <button
                        className={`nav-link ${activeTab === 'metrics' ? 'active' : ''}`}
                        onClick={() => setActiveTab('metrics')}
                        role="tab"
                        aria-selected={activeTab === 'metrics'}
                    >
                        {t('admin.tabs.metrics')}
                    </button>
                </li>
            </ul>

            <div>
                {activeTab === 'users' && <UsersTab />}
                {activeTab === 'roles' && <RolesTab />}
                {activeTab === 'attributions' && <RoleAttributionTab />}
                {activeTab === 'attributionsLevel' && <LevelAttributionTab />}
                {activeTab === 'memory' && <MemoryTab />}
                {activeTab === 'transactions' && <PaymentMethodsTab />}
                {activeTab === 'metrics' && <MetricsTab />}
            </div>
        </div>
    )
}
