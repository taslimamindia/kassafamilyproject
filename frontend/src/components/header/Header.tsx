import './Header.css'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { logout, verifyToken } from '../../services/auth'
import { getCurrentUser } from '../../services/users'
import { getRolesForUser } from '../../services/roleAttributions'
import LanguageSwitcher from '../common/LanguageSwitcher'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

// Localized dictionary for this component (decentralized)
const headerResources = {
    fr: {
        header: {
            userAccount: 'Compte utilisateur',
            viewProfile: 'Voir le profil',
            editProfile: 'Modifier le profil',
        },
        nav: {
            login: 'Se connecter',
            logout: 'Se déconnecter',
            profile: 'Profil',
            admin: 'Admin',
        },
    },
    en: {
        header: {
            userAccount: 'User account',
            viewProfile: 'View profile',
            editProfile: 'Edit profile',
        },
        nav: {
            login: 'Sign in',
            logout: 'Sign out',
            profile: 'Profile',
            admin: 'Admin',
        },
    },
    ar: {
        header: {
            userAccount: 'حساب المستخدم',
            viewProfile: 'عرض الملف',
            editProfile: 'تعديل الملف',
        },
        nav: {
            login: 'تسجيل الدخول',
            logout: 'تسجيل الخروج',
            profile: 'الملف الشخصي',
            admin: 'المشرف',
        },
    },
}

for (const [lng, res] of Object.entries(headerResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

function Header() {
    const navigate = useNavigate()
    const [isAuth, setIsAuth] = useState<boolean | null>(null)
    const [isAdmin, setIsAdmin] = useState<boolean>(false)
    const { t } = useTranslation()

    useEffect(() => {
        let mounted = true
        const refresh = async () => {
            try {
                const ok = await verifyToken()
                if (!mounted) return
                setIsAuth(ok)
                if (ok) {
                    try {
                        const user = await getCurrentUser()
                        const roles = await getRolesForUser(user.id)
                        setIsAdmin(roles.some(r => r.role?.toLowerCase() === 'admin'))
                    } catch {
                        setIsAdmin(false)
                    }
                } else {
                    setIsAdmin(false)
                }
            } catch {
                if (mounted) { setIsAuth(false); setIsAdmin(false) }
            }
        }
        // Initial check
        refresh()
        // React to token changes in this tab and across tabs
        const handler = () => refresh()
        window.addEventListener('storage', handler)
        window.addEventListener('auth-changed', handler as EventListener)
        return () => {
            mounted = false
            window.removeEventListener('storage', handler)
            window.removeEventListener('auth-changed', handler as EventListener)
        }
    }, [])

    function onLogout() {
        logout()
        navigate('/', { replace: true })
    }

    return (
        <header className="border-bottom bg-light sticky-top">
            <nav className="navbar navbar-expand-lg navbar-light container" aria-label="Navigation principale">
                <Link to="/" className="logo navbar-brand fw-semibold">
                    KASSA
                </Link>
                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#mainNavbar"
                    aria-controls="mainNavbar"
                    aria-expanded="false"
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="mainNavbar">
                    <ul className="navbar-nav ms-lg-auto mb-2 mb-lg-0 gap-lg-2 align-items-lg-center">
                        {/* <li className="nav-item">
                            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                                Accueil
                            </NavLink>
                        </li> */}
                        {/* Order: Admin (left), then Profile/Login (far right) */}
                        {isAuth && isAdmin && (
                            <li className="nav-item">
                                <NavLink to="/admin" className={({ isActive }) => `nav-link d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}>
                                    <i className="bi bi-shield-lock" aria-hidden="true"></i>
                                    Admin
                                </NavLink>
                            </li>
                        )}

                        {isAuth === null ? null : isAuth ? (
                            <li className="nav-item dropdown">
                                <button
                                    className="btn nav-link dropdown-toggle d-flex align-items-center gap-2"
                                    data-bs-toggle="dropdown"
                                    aria-expanded="false"
                                    aria-label={t('header.userAccount')}
                                >
                                    <i className="bi bi-person-circle fs-5" aria-hidden="true"></i>
                                    <span>{t('nav.profile')}</span>
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end">
                                    <li>
                                        <button className="dropdown-item d-flex align-items-center gap-2" onClick={() => navigate('/profil')}>
                                            <i className="bi bi-person" aria-hidden="true"></i>
                                            {t('header.viewProfile')}
                                        </button>
                                    </li>
                                    <li>
                                        <button className="dropdown-item d-flex align-items-center gap-2" onClick={() => navigate('/profil?edit=1')}>
                                            <i className="bi bi-pencil-square" aria-hidden="true"></i>
                                            {t('header.editProfile')}
                                        </button>
                                    </li>
                                    <li><hr className="dropdown-divider" /></li>
                                    <li>
                                        <button className="dropdown-item text-danger d-flex align-items-center gap-2" onClick={onLogout}>
                                            <i className="bi bi-box-arrow-right" aria-hidden="true"></i>
                                            {t('nav.logout')}
                                        </button>
                                    </li>
                                </ul>
                            </li>
                        ) : (
                            <li className="nav-item">
                                <NavLink to="/auth" className={({ isActive }) => `nav-link d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}>
                                    <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i>
                                    {t('nav.login')}
                                </NavLink>
                            </li>
                        )}
                        {/* Language switcher */}
                        <li className="nav-item d-flex align-items-center">
                            <LanguageSwitcher />
                        </li>
                    </ul>
                </div>
            </nav>
        </header>
    )
}

export default Header
