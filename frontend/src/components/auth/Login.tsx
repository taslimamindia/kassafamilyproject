import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { login, changePasswordFirstLogin } from '../../services/auth'
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
    const [firstLoginRequired, setFirstLoginRequired] = useState(false)
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            await login(identifier, password)
            toast.success(t('auth.success'))
            const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
            if (fromPath) {
                navigate(fromPath, { replace: true })
                return
            }
            // Default redirects by role
            try {
                const { getCurrentUser } = await import('../../services/users')
                const { getRolesForUser } = await import('../../services/roleAttributions')
                const me = await getCurrentUser()
                const roles = await getRolesForUser(me.id)
                const names = roles.map(r => (r.role || '').toLowerCase())
                if (names.includes('admin')) {
                    navigate('/admin', { replace: true })
                } else if (names.includes('admingroup')) {
                    navigate('/admingroup', { replace: true })
                } else {
                    navigate('/user', { replace: true })
                }
            } catch {
                navigate('/', { replace: true })
            }
        } catch (err: any) {
            // Detect first-login requirement
            const code = err?.body?.detail?.code
            const status = err?.status
            if (status === 403 && code === 'FIRST_LOGIN_REQUIRED') {
                setFirstLoginRequired(true)
                setError(null)
                toast.info(t('auth.loggingIn'))
            } else {
                console.error('Login failed', err)
                setError(t('auth.invalidCredentials'))
                toast.error(t('auth.failed'))
            }
        } finally {
            setLoading(false)
        }
    }

    async function onChangePassword(e: React.FormEvent) {
        e.preventDefault()
        if (!firstLoginRequired) return
        if (newPassword.trim().length < 6) {
            setError('Le nouveau mot de passe doit contenir au moins 6 caractères')
            return
        }
        if (newPassword !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas')
            return
        }
        setLoading(true)
        setError(null)
        try {
            await changePasswordFirstLogin(identifier, password, newPassword)
            toast.success('Mot de passe changé, veuillez vous reconnecter')
            // Attempt login again automatically
            await login(identifier, newPassword)
            const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
            if (fromPath) {
                navigate(fromPath, { replace: true })
            } else {
                try {
                    const { getCurrentUser } = await import('../../services/users')
                    const { getRolesForUser } = await import('../../services/roleAttributions')
                    const me = await getCurrentUser()
                    const roles = await getRolesForUser(me.id)
                    const names = roles.map(r => (r.role || '').toLowerCase())
                    if (names.includes('admin')) {
                        navigate('/admin', { replace: true })
                    } else if (names.includes('admingroup')) {
                        navigate('/admingroup', { replace: true })
                    } else {
                        navigate('/user', { replace: true })
                    }
                } catch {
                    navigate('/', { replace: true })
                }
            }
        } catch (err) {
            console.error('Change password first login failed', err)
            setError(t('auth.invalidCredentials'))
            toast.error('Echec changement mot de passe')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container py-4">
            <h2 className="mb-3">{t('auth.title')}</h2>
            <form onSubmit={firstLoginRequired ? onChangePassword : onSubmit} className="needs-validation" noValidate>
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
                        disabled={firstLoginRequired}
                    />
                </div>
                {firstLoginRequired && (
                    <>
                        <div className="mb-3">
                            <label className="form-label">Nouveau mot de passe</label>
                            <input
                                type="password"
                                className="form-control"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Confirmer le nouveau mot de passe</label>
                            <input
                                type="password"
                                className="form-control"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                    </>
                )}
                {error && <div className="alert alert-danger">{error}</div>}
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading
                        ? t('auth.loggingIn')
                        : firstLoginRequired
                            ? 'Changer le mot de passe'
                            : t('auth.login')}
                </button>
            </form>
        </div>
    )
}
