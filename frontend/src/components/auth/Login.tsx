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
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

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
                } else if (names.includes('treasury')) {
                    navigate('/caisse', { replace: true })
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
                // Redirect to change password page
                const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
                navigate('/change-password', { 
                    state: { 
                        identifier, 
                        password,
                        from: fromPath ? { pathname: fromPath } : undefined
                    } 
                })
            } else {
                console.error('Login failed', err)
                setError(t('auth.invalidCredentials'))
                toast.error(t('auth.failed'))
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container py-5 d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
            <div className="card shadow-lg border-0 rounded-4" style={{ maxWidth: '400px', width: '100%' }}>
                <div className="card-body p-2">
                    <div className="text-center mb-2">
                        <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-person-fill" viewBox="0 0 16 16">
                                <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
                            </svg>
                        </div>
                        <h2 className="fw-bold fs-4">{t('auth.title')}</h2>
                        <p className="text-secondary small mb-0"> {t('auth.login')} </p>
                    </div>

                    <form onSubmit={onSubmit} className="needs-validation" noValidate>
                        <div className="mb-3">
                            <label className="form-label small text-uppercase text-secondary fw-semibold">
                                {t('auth.identifier')}
                            </label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0 text-secondary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-person" viewBox="0 0 16 16">
                                        <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1h8z"/>
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 bg-light"
                                    placeholder={`${t('common.username')} / ${t('common.email')} / ${t('common.phone')}`}
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        
                        <div className="mb-4">
                            <label className="form-label small text-uppercase text-secondary fw-semibold">{t('auth.password')}</label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0 text-secondary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-lock" viewBox="0 0 16 16">
                                        <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
                                    </svg>
                                </span>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="form-control border-start-0 border-end-0 bg-light"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    className="btn btn-light border border-start-0 text-secondary"
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    title={showPassword ? "Masquer" : "Afficher"}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye-slash" viewBox="0 0 16 16">
                                            <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                                            <path d="M11.297 9.331L5.999 4.033 8 5a2 2 0 0 0 2 2l1.297 2.331zm1.785 2.88l-12-12 .708-.708 12 12-.708.708zM1.66 4.793a12.185 12.185 0 0 0-1.047 1.348A13.133 13.133 0 0 0 1.172 8c.058-.087.122-.183.195-.288.335-.48.83-1.12 1.465-1.755.772-.771 1.737-1.433 2.912-1.859l-3.32-3.32zm9.14 9.14a11.175 11.175 0 0 1-3.693.308c-2.12 0-3.879-1.168-5.168-2.457a13.133 13.133 0 0 1-1.172-2.141l.732-.732c.118.29.26.573.424.848 1.289 2.29 4.048 3.89 7.093 3.89 1.326 0 2.502-.345 3.523-.974l.732.731z"/>
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye" viewBox="0 0 16 16">
                                            <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                                            <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="alert alert-danger d-flex align-items-center small py-2 fade show" role="alert">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-exclamation-circle-fill flex-shrink-0 me-2" viewBox="0 16 16">
                                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
                                </svg>
                                <div>{error}</div>
                            </div>
                        )}

                        <div className="d-grid gap-2">
                            <button type="submit" className="btn btn-primary py-2 fw-semibold shadow-sm" disabled={loading}>
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        {t('auth.loggingIn')}
                                    </>
                                ) : (
                                    t('auth.login')
                                )}
                            </button>
                        </div>
                        
                        <div className="mt-4 text-center">
                            <a href="/" className="text-decoration-none small text-secondary">
                                &larr; Retour à l'accueil
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
