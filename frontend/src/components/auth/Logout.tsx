import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../../services/auth'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

// Localized dictionary for this component
const logoutResources = {
    fr: { nav: { logout: 'Se déconnecter' } },
    en: { nav: { logout: 'Sign out' } },
    ar: { nav: { logout: 'تسجيل الخروج' } },
}

for (const [lng, res] of Object.entries(logoutResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function Logout() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        logout()
        // Après déconnexion, rediriger vers l'accueil
        navigate('/', { replace: true })
    }, [navigate, location])

    return <div className="container py-4">{t('nav.logout')}...</div>
}
