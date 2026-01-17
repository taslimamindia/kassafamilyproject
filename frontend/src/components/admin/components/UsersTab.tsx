import { useEffect, useMemo, useState } from 'react'
import { getUsers, type User, getCurrentUser } from '../../../services/users'
import { getRolesForUser } from '../../../services/roleAttributions'
import AddUserForm from './AddUserForm'
import EditUserForm from './EditUserForm'
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

    // Filters lifted to parent; default to active users only
    const [query, setQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
    const [firstLoginFilter, setFirstLoginFilter] = useState<'all' | 'yes' | 'no'>('all')
    const [roleFilter, setRoleFilter] = useState<string>('all')
    const [tierFilter, setTierFilter] = useState<string>('all')
    const [debouncedQuery, setDebouncedQuery] = useState('')

    // Set default `statusFilter` based on current user's role:
    // - 'active' when user has 'admin'
    // - 'all' when user has 'admingroup'
    useEffect(() => {
        let mounted = true
        ;(async () => {
            try {
                const me = await getCurrentUser()
                if (!mounted) return
                try {
                    const roles = await getRolesForUser(me.id)
                    const names = roles.map(r => (r.role || '').toLowerCase())
                    if (names.includes('admingroup')) {
                        setStatusFilter('all')
                    } else if (names.includes('admin')) {
                        setStatusFilter('active')
                    }
                } catch {
                    // fallback: if getCurrentUser included roles, still handle it
                    const roleNames = me.roles?.map(r => (r.role || '').toLowerCase()) ?? []
                    if (roleNames.includes('admingroup')) {
                        setStatusFilter('all')
                    } else if (roleNames.includes('admin')) {
                        setStatusFilter('active')
                    }
                }
            } catch {
                // ignore errors and keep existing default
            }
        })()
        return () => { mounted = false }
    }, [])

    const [editingId, setEditingId] = useState<number | null>(null)
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [imageBustToken, setImageBustToken] = useState<number>(() => Date.now())

    const isEditing = useMemo(() => editingId !== null, [editingId])

    async function refresh() {
        setLoading(true)
        setError(null)
        try {
            const data = await getUsers({
                status: statusFilter,
                firstLogin: firstLoginFilter,
                q: debouncedQuery || undefined,
                roles: roleFilter !== 'all' ? roleFilter : undefined,
                contribution_tier: tierFilter !== 'all' ? tierFilter : undefined,
            })
            setUsers(data)
            // Force image reloads by updating a cache-busting token
            setImageBustToken(Date.now())
        } catch (e) {
            setError(t('users.loadError'))
        } finally {
            setLoading(false)
        }
    }

    // Debounce search input to reduce network calls
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300)
        return () => clearTimeout(timer)
    }, [query])

    useEffect(() => { refresh() }, [debouncedQuery, statusFilter, firstLoginFilter, roleFilter, tierFilter])

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
        // Force a server refresh to ensure latest data and avatar reload
        void refresh()
    }

    function onDeleted(id: number) {
        // touch param to satisfy linter
        void id
        // After deletion/deactivation, refresh server-filtered list
        void refresh()
    }

    return (
        <div>
            {/* AdminActions moved into UsersTable */}

            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            <Modal
                isOpen={isEditing}
                onClose={cancelEdit}
                size="lg"
            >
                {isEditing && (
                    editingId === 0 ? (
                        <AddUserForm
                            initial={currentUser ?? undefined}
                            onSaved={onSaved}
                            onCancel={cancelEdit}
                            allowedRoleNames={userFormOptions?.allowedRoleNames}
                        />
                    ) : (
                        currentUser ? (
                            <EditUserForm
                                initial={currentUser}
                                onSaved={onSaved}
                                onCancel={cancelEdit}
                                allowedRoleNames={userFormOptions?.allowedRoleNames}
                            />
                        ) : null
                    )
                )}
            </Modal>

            <UsersTable
                users={users}
                onEdit={startEdit}
                onDeleted={onDeleted}
                query={query}
                statusFilter={statusFilter}
                firstLoginFilter={firstLoginFilter}
                onQueryChange={setQuery}
                onStatusFilterChange={setStatusFilter}
                onFirstLoginFilterChange={setFirstLoginFilter}
                roleFilter={roleFilter}
                onRoleFilterChange={setRoleFilter}
                tierFilter={tierFilter}
                onTierFilterChange={setTierFilter}
                imageBustToken={imageBustToken}
                onCreate={startCreate}
                onRefresh={refresh}
                loading={loading}
            />
        </div>
    )
}
