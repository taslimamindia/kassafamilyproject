import { useEffect, useState, type JSX } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { verifyToken } from './services/auth'

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
    const [allowed, setAllowed] = useState<boolean | null>(null)
    const location = useLocation()

    useEffect(() => {
        let mounted = true
        verifyToken().then((ok) => {
            if (mounted) setAllowed(ok)
        })
        return () => {
            mounted = false
        }
    }, [])

    // Wait for verification result before deciding
    if (allowed === null) {
        return null
    }

    if (!allowed) {
        return <Navigate to="/auth" replace state={{ from: location }} />
    }

    return children
}
