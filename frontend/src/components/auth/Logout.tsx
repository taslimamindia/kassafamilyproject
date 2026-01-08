import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../../services/auth'

export default function Logout() {
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        logout()
        // Après déconnexion, rediriger vers l'accueil
        navigate('/', { replace: true })
    }, [navigate, location])

    return <div className="container py-4">Déconnexion...</div>
}
