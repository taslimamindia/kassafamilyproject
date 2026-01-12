import { useEffect, useState, type JSX } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { verifyToken } from './services/auth'
import { getCurrentUser } from './services/users'
import { getRolesForUser } from './services/roleAttributions'

export default function AdminGroupRoute({ children }: { children: JSX.Element }) {
    const [allowed, setAllowed] = useState<boolean | null>(null)
    const [isAuth, setIsAuth] = useState<boolean>(false)
    const location = useLocation()

    useEffect(() => {
        let mounted = true
        async function check() {
            try {
                const ok = await verifyToken()
                if (!ok) { if (mounted) { setIsAuth(false); setAllowed(false) }; return }
                setIsAuth(true)
                const user = await getCurrentUser()
                const roles = await getRolesForUser(user.id)
                const names = roles.map(r => (r.role || '').toLowerCase())
                const isAdminGroup = names.includes('admingroup') || names.includes('admin')
                if (mounted) setAllowed(isAdminGroup)
            } catch {
                if (mounted) setAllowed(false)
            }
        }
        check()
        return () => { mounted = false }
    }, [])

    if (allowed === null) return null
    if (!isAuth) return <Navigate to="/auth" replace state={{ from: location }} />
    if (!allowed) return <Navigate to="/errors" replace state={{ from: location }} />
    return children
}
