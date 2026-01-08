import { useEffect, useMemo, useState } from 'react'
import { getUsers, type User } from '../../../services/users'
import AdminActions from './AdminActions'
import UserForm from './UserForm'
import UsersTable from './UsersTable'
import Modal from '../../common/Modal'

export default function UsersTab() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

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
            setError('Erreur lors du chargement des utilisateurs')
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
                title={editingId === 0 ? 'Créer un utilisateur' : 'Modifier un utilisateur'}
                onClose={cancelEdit}
                size="lg"
            >
                {isEditing && (
                    <UserForm
                        mode={editingId === 0 ? 'create' : 'edit'}
                        initial={currentUser ?? undefined}
                        onSaved={onSaved}
                        onCancel={cancelEdit}
                    />
                )}
            </Modal>

            <UsersTable users={users} onEdit={startEdit} onDeleted={onDeleted} />
        </div>
    )
}
