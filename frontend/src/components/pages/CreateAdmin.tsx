import { useNavigate } from 'react-router-dom'
import AddUserForm from '../admin/components/users/AddUserForm'
import type { User } from '../../services/users'
import { assignRoleToUser } from '../../services/roleAttributions'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

// Localized dictionary for this component
const createAdminResources = {
    fr: { createAdmin: { title: 'Créer un administrateur', info: 'Remplissez le formulaire ci-dessous. Le rôle admin sera ajouté automatiquement.', toastSuccess: 'Admin créé avec succès', toastWarn: "L'utilisateur a été créé, mais l'attribution du rôle admin a échoué" } },
    en: { createAdmin: { title: 'Create an administrator', info: 'Fill the form below. The admin role will be added automatically.', toastSuccess: 'Admin created successfully', toastWarn: 'User created, but admin role assignment failed' } },
    ar: { createAdmin: { title: 'إنشاء مسؤول', info: 'املأ النموذج أدناه. سيتم إضافة دور المسؤول تلقائيًا.', toastSuccess: 'تم إنشاء المسؤول بنجاح', toastWarn: 'تم إنشاء المستخدم، لكن فشل إسناد دور المسؤول' } },
}

for (const [lng, res] of Object.entries(createAdminResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function CreateAdmin() {
    const navigate = useNavigate()
    const { t } = useTranslation()

    async function handleSaved(user: User) {
        try {
            // Force assignment of admin role (id = 1)
            await assignRoleToUser(user.id, 1)
            toast.success(t('createAdmin.toastSuccess'))
        } catch {
            toast.warn(t('createAdmin.toastWarn'))
        }
        navigate('/profil')
    }

    return (
        <div className="container py-4">
            <h2 className="mb-3">{t('createAdmin.title')}</h2>
            <p className="text-muted">{t('createAdmin.info')}</p>
            <AddUserForm onSaved={handleSaved} onCancel={() => navigate('/profil')} />
        </div>
    )
}
