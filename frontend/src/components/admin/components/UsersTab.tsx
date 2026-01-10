import { useEffect, useMemo, useState } from 'react'
import { getUsers, type User } from '../../../services/users'
import AdminActions from './AdminActions'
import UserForm from './UserForm'
import UsersTable from './UsersTable'
import Modal from '../../common/Modal'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'

// Localized dictionary for this component
const usersTabResources = {
    fr: {
        users: { loadError: 'Erreur lors du chargement des utilisateurs' },
        common: { create: 'Créer', edit: 'Modifier' },
        nav: { users: 'Utilisateurs' },
    },
    en: {
        users: { loadError: 'Error loading users' },
        common: { create: 'Create', edit: 'Edit' },
        nav: { users: 'Users' },
    },
    ar: {
        users: { loadError: 'خطأ أثناء تحميل المستخدمين' },
        common: { create: 'إنشاء', edit: 'تعديل' },
        nav: { users: 'المستخدمون' },
    },
}

for (const [lng, res] of Object.entries(usersTabResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function UsersTab({
    userFormOptions,
}: {
    userFormOptions?: {
        allowedRoleNames?: string[]
    }
} = {}) {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { t } = useTranslation()

    const [editingId, setEditingId] = useState<number | null>(null)
    const [currentUser, setCurrentUser] = useState<User | null>(null)

    const isEditing = useMemo(() => editingId !== null, [editingId])

    async function refresh() {
        setLoading(true)
        setError(null)
        try {
            const data = await getUsers()
            setUsers(data)
        } catch (e) {
            setError(t('users.loadError'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { refresh() }, [])

    function startCreate() {
        setEditingId(0)
        setCurrentUser(null)
    }

    function startEdit(u: User) {
        setEditingId(u.id)
        setCurrentUser(u)
    }

    function cancelEdit() {
        setEditingId(null)
        setCurrentUser(null)
    }

    function onSaved(user: User) {
        if (editingId === 0) {
            setUsers(prev => [user, ...prev])
        } else {
            setUsers(prev => prev.map(u => u.id === user.id ? user : u))
        }
        cancelEdit()
    }

    function onDeleted(id: number) {
        // Keep the user in the list, mark as inactive
        setUsers(prev => prev.map(u => u.id === id ? { ...u, isactive: 0 } as User : u))
    }

    return (
        <div>
            <AdminActions onCreate={startCreate} onRefresh={refresh} loading={loading} />

            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            <Modal
                isOpen={isEditing}
                title={editingId === 0 ? t('common.create') + ' ' + t('nav.users') : t('common.edit') + ' ' + t('nav.users')}
                onClose={cancelEdit}
                size="lg"
            >
                {isEditing && (
                    <UserForm
                        mode={editingId === 0 ? 'create' : 'edit'}
                        initial={currentUser ?? undefined}
                        onSaved={onSaved}
                        onCancel={cancelEdit}
                        allowedRoleNames={userFormOptions?.allowedRoleNames}
                    />
                )}
            </Modal>

            <UsersTable users={users} onEdit={startEdit} onDeleted={onDeleted} />
        </div>
    )
}
