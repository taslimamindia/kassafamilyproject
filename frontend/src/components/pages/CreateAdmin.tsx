import { useNavigate } from 'react-router-dom'
import UserForm from '../admin/components/UserForm'
import type { User } from '../../services/users'
import { assignRoleToUser } from '../../services/roleAttributions'
import { toast } from 'react-toastify'

export default function CreateAdmin() {
    const navigate = useNavigate()

    async function handleSaved(user: User) {
        try {
            // Force assignment of admin role (id = 1)
            await assignRoleToUser(user.id, 1)
            toast.success('Admin créé avec succès')
        } catch {
            toast.warn("L'utilisateur a été créé, mais l'attribution du rôle admin a échoué")
        }
        navigate('/profil')
    }

    return (
        <div className="container py-4">
            <h2 className="mb-3">Créer un administrateur</h2>
            <p className="text-muted">Remplissez le formulaire ci-dessous. Le rôle admin sera ajouté automatiquement.</p>
            <UserForm mode="create" onSaved={handleSaved} onCancel={() => navigate('/profil')} />
        </div>
    )
}
