import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { login } from '../../services/auth'

export default function Login() {
    const navigate = useNavigate()
    const location = useLocation()
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            await login(identifier, password)
            toast.success('Connexion réussie')
            const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'
            navigate(fromPath, { replace: true })
        } catch (err) {
            setError('Identifiants invalides')
            toast.error('Échec de la connexion: identifiants invalides')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container py-4">
            <h2 className="mb-3">Authentification</h2>
            <form onSubmit={onSubmit} className="needs-validation" noValidate>
                <div className="mb-3">
                    <label className="form-label">Identifiant (username/email/téléphone)</label>
                    <input
                        type="text"
                        className="form-control"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                    />
                </div>
                <div className="mb-3">
                    <label className="form-label">Mot de passe</label>
                    <input
                        type="password"
                        className="form-control"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                {error && <div className="alert alert-danger">{error}</div>}
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Connexion...' : 'Se connecter'}
                </button>
            </form>
        </div>
    )
}
