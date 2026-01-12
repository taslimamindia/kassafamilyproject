import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { changePasswordFirstLogin } from '../../services/auth'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

const changePasswordResources = {
    fr: {
        changePass: {
            title: 'Changement de mot de passe',
            description: "C'est votre première connexion via ce compte. Veuillez définir un nouveau mot de passe pour continuer.",
            newPassword: 'Nouveau mot de passe',
            confirmPassword: 'Confirmer le mot de passe',
            lengthError: 'Le mot de passe doit contenir entre 6 et 16 caractères',
            matchError: 'Les mots de passe ne correspondent pas',
            success: 'Mot de passe changé avec succès',
            fail: 'Erreur lors du changement de mot de passe',
            failToast: 'Échec changement mot de passe',
            submit: 'Changer et se connecter',
            processing: 'Traitement en cours...',
            back: 'Retour à la connexion',
            placeholder: '6 à 16 caractères',
            placeholderConfirm: 'Répéter le mot de passe'
        }
    },
    en: {
        changePass: {
            title: 'Change Password',
            description: 'This is your first login with this account. Please set a new password to continue.',
            newPassword: 'New Password',
            confirmPassword: 'Confirm Password',
            lengthError: 'Password must be between 6 and 16 characters',
            matchError: 'Passwords do not match',
            success: 'Password changed successfully',
            fail: 'Error changing password',
            failToast: 'Password change failed',
            submit: 'Change and login',
            processing: 'Processing...',
            back: 'Back to login',
            placeholder: '6 to 16 characters',
            placeholderConfirm: 'Repeat password'
        }
    },
    ar: {
        changePass: {
            title: 'تغيير كلمة المرور',
            description: 'هذا هو تسجيل دخولك الأول بهذا الحساب. يرجى تعيين كلمة مرور جديدة للمتابعة.',
            newPassword: 'كلمة مرور جديدة',
            confirmPassword: 'تأكيد كلمة المرور',
            lengthError: 'يجب أن تكون كلمة المرور بين 6 و 16 حرفًا',
            matchError: 'كلمات المرور غير متطابقة',
            success: 'تم تغيير كلمة المرور بنجاح',
            fail: 'خطأ في تغيير كلمة المرور',
            failToast: 'فشل تغيير كلمة المرور',
            submit: 'تغيير وتسجيل الدخول',
            processing: 'جارٍ المعالجة...',
            back: 'العودة لتسجيل الدخول',
            placeholder: '6 إلى 16 حرفًا',
            placeholderConfirm: 'أعد كتابة كلمة المرور'
        }
    }
}

for (const [lng, res] of Object.entries(changePasswordResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function ChangePasswordFirstLogin() {
    const navigate = useNavigate()
    const location = useLocation()
    const { t } = useTranslation()
    const [identifier, setIdentifier] = useState('')
    const [oldPassword, setOldPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (location.state && location.state.identifier && location.state.password) {
            setIdentifier(location.state.identifier)
            setOldPassword(location.state.password)
        } else {
            // If accessed directly without state, go back to login
            navigate('/auth', { replace: true })
        }
    }, [location, navigate])

    async function onChangePassword(e: React.FormEvent) {
        e.preventDefault()
        if (newPassword.length < 6 || newPassword.length > 16) {
            setError(t('changePass.lengthError'))
            return
        }
        if (newPassword !== confirmPassword) {
            setError(t('changePass.matchError'))
            return
        }
        setLoading(true)
        setError(null)
        try {
            await changePasswordFirstLogin(identifier, oldPassword, newPassword)
            toast.success(t('changePass.success'))

            // Redirect based on role (logic copied from Login)
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
            console.error('Change password failed', err)
            setError(t('changePass.fail'))
            toast.error(t('changePass.failToast'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container py-5 d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
            <div className="card shadow-sm" style={{ maxWidth: '450px', width: '100%' }}>
                <div className="card-body p-4">
                    <h2 className="card-title text-center mb-4">{t('changePass.title')}</h2>
                    <p className="text-muted text-center mb-4">
                        {t('changePass.description')}
                    </p>

                    <form onSubmit={onChangePassword} className="needs-validation" noValidate>
                        <div className="mb-3">
                            <label className="form-label">{t('changePass.newPassword')}</label>
                            <div className="input-group">
                                <input
                                    type={showNewPassword ? "text" : "password"}
                                    className="form-control border-end-0"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    placeholder={t('changePass.placeholder')}
                                />
                                <button
                                    className="btn btn-outline-secondary border-start-0"
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                >
                                    {showNewPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye-slash" viewBox="0 0 16 16">
                                            <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z" />
                                            <path d="M11.297 9.331L5.999 4.033 8 5a2 2 0 0 0 2 2l1.297 2.331zm1.785 2.88l-12-12 .708-.708 12 12-.708.708zM1.66 4.793a12.185 12.185 0 0 0-1.047 1.348A13.133 13.133 0 0 0 1.172 8c.058-.087.122-.183.195-.288.335-.48.83-1.12 1.465-1.755.772-.771 1.737-1.433 2.912-1.859l-3.32-3.32zm9.14 9.14a11.175 11.175 0 0 1-3.693.308c-2.12 0-3.879-1.168-5.168-2.457a13.133 13.133 0 0 1-1.172-2.141l.732-.732c.118.29.26.573.424.848 1.289 2.29 4.048 3.89 7.093 3.89 1.326 0 2.502-.345 3.523-.974l.732.731z" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye" viewBox="0 0 16 16">
                                            <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
                                            <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className="mb-3">
                            <label className="form-label">{t('changePass.confirmPassword')}</label>
                            <div className="input-group">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    className="form-control border-end-0"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder={t('changePass.placeholderConfirm')}
                                />
                                <button
                                    className="btn btn-outline-secondary border-start-0"
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye-slash" viewBox="0 0 16 16">
                                            <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z" />
                                            <path d="M11.297 9.331L5.999 4.033 8 5a2 2 0 0 0 2 2l1.297 2.331zm1.785 2.88l-12-12 .708-.708 12 12-.708.708zM1.66 4.793a12.185 12.185 0 0 0-1.047 1.348A13.133 13.133 0 0 0 1.172 8c.058-.087.122-.183.195-.288.335-.48.83-1.12 1.465-1.755.772-.771 1.737-1.433 2.912-1.859l-3.32-3.32zm9.14 9.14a11.175 11.175 0 0 1-3.693.308c-2.12 0-3.879-1.168-5.168-2.457a13.133 13.133 0 0 1-1.172-2.141l.732-.732c.118.29.26.573.424.848 1.289 2.29 4.048 3.89 7.093 3.89 1.326 0 2.502-.345 3.523-.974l.732.731z" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye" viewBox="0 0 16 16">
                                            <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
                                            <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && <div className="alert alert-danger">{error}</div>}

                        <div className="d-grid gap-2">
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? t('changePass.processing') : t('changePass.submit')}
                            </button>
                            <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/auth')}>
                                {t('changePass.back')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
