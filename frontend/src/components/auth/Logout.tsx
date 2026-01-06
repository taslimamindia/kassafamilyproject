import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../../services/auth'

export default function Logout() {
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        logout()
        const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/auth'
        navigate(fromPath, { replace: true })
    }, [navigate, location])

    return <div className="container py-4">Déconnexion...</div>
}
