import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { login } from '../../services/auth'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

// Localized dictionary for this component
const loginResources = {
    fr: {
        auth: {
            title: 'Authentification',
            identifier: 'Identifiant',
            password: 'Mot de passe',
            login: 'Se connecter',
            loggingIn: 'Connexion...',
            success: 'Connexion réussie',
            failed: 'Échec de la connexion: identifiants invalides',
            invalidCredentials: 'Identifiants invalides',
        },
        common: { username: 'Utilisateur', email: 'Email', phone: 'Téléphone' },
    },
    en: {
        auth: {
            title: 'Authentication',
            identifier: 'Identifier',
            password: 'Password',
            login: 'Sign in',
            loggingIn: 'Signing in...',
            success: 'Login successful',
            failed: 'Login failed: invalid credentials',
            invalidCredentials: 'Invalid credentials',
        },
        common: { username: 'Username', email: 'Email', phone: 'Phone' },
    },
    ar: {
        auth: {
            title: 'تسجيل الدخول',
            identifier: 'المعرّف',
            password: 'كلمة المرور',
            login: 'تسجيل الدخول',
            loggingIn: 'جارٍ تسجيل الدخول...',
            success: 'تم تسجيل الدخول بنجاح',
            failed: 'فشل تسجيل الدخول: بيانات غير صحيحة',
            invalidCredentials: 'بيانات غير صحيحة',
        },
        common: { username: 'اسم المستخدم', email: 'البريد الإلكتروني', phone: 'رقم الهاتف' },
    },
}

for (const [lng, res] of Object.entries(loginResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function Login() {
    const navigate = useNavigate()
    const location = useLocation()
    const { t } = useTranslation()
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
            toast.success(t('auth.success'))
            const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'
            navigate(fromPath, { replace: true })
        } catch (err) {
            setError(t('auth.invalidCredentials'))
            toast.error(t('auth.failed'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container py-4">
            <h2 className="mb-3">{t('auth.title')}</h2>
            <form onSubmit={onSubmit} className="needs-validation" noValidate>
                <div className="mb-3">
                    <label className="form-label">
                        {t('auth.identifier')} ({t('common.username')}/{t('common.email')}/{t('common.phone')})
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                    />
                </div>
                <div className="mb-3">
                    <label className="form-label">{t('auth.password')}</label>
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
                    {loading ? t('auth.loggingIn') : t('auth.login')}
                </button>
            </form>
        </div>
    )
}
