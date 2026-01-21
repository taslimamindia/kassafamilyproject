import './Header.css'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { logout, verifyToken } from '@src/services/auth'
import { getCurrentUser } from '@src/services/users'
import { getRolesForUser } from '@src/services/roleAttributions'
import LanguageSwitcher from '@components/common/LanguageSwitcher'
import Notifications from '@components/notifications/Notification'
import i18n from '@src/i18n'
import { getRoleLabel } from '@src/constants/roleLabels'


// Localized dictionary for this component (decentralized)
const headerResources = {
    fr: {
        header: {
            userAccount: 'Compte membre',
            viewProfile: 'Voir le profil',
            editProfile: 'Modifier le profil',
        },
        nav: {
            login: 'Se connecter',
            logout: 'Se déconnecter',
            profile: 'Profil',
            admin: 'Admin',
            users: 'Membre',
            cash: 'Caisse',
            tree: 'Arbre généalogique',
            chartes: 'Chartes',
            home: 'Accueil',
        },
    },
    en: {
        header: {
            userAccount: 'Member account',
            viewProfile: 'View profile',
            editProfile: 'Edit profile',
        },
        nav: {
            login: 'Sign in',
            logout: 'Sign out',
            profile: 'Profile',
            admin: 'Admin',
            users: 'Member',
            cash: 'Cash',
            tree: 'Family Tree',
            chartes: 'Charter',
            home: 'Home',
        },
    },
    ar: {
        header: {
            userAccount: 'حساب العضو',
            viewProfile: 'عرض الملف',
            editProfile: 'تعديل الملف',
        },
        nav: {
            login: 'تسجيل الدخول',
            logout: 'تسجيل الخروج',
            profile: 'الملف الشخصي',
            admin: 'المشرف',
            users: 'عضو',
            cash: 'الصندوق',
            tree: 'الشجرة العائلية',
            chartes: 'الميثاق',
            home: 'الصفحة الرئيسية',
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
    const [isGroupAdmin, setIsGroupAdmin] = useState<boolean>(false)
    const [me, setMe] = useState<{ firstname?: string; lastname?: string; image_url?: string | null } | null>(null)
    const { t } = useTranslation()
    const location = useLocation()
    const isCashActive = location.pathname.startsWith('/caisse') || location.pathname.startsWith('/transactions') || location.pathname.startsWith('/approvals')
    const navbarRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Close navbar when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            if (
                navbarRef.current &&
                !navbarRef.current.contains(event.target as Node) &&
                navbarRef.current.classList.contains('show')
            ) {
                const toggler = document.querySelector('.navbar-toggler')
                if (toggler && toggler.contains(event.target as Node)) {
                    return
                }
                if (toggler instanceof HTMLElement) toggler.click()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    useEffect(() => {
        // Close navbar on route change (e.g. clicking a link)
        if (navbarRef.current && navbarRef.current.classList.contains('show')) {
            const toggler = document.querySelector('.navbar-toggler') as HTMLElement
            if (toggler) toggler.click()
        }
    }, [location])

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
                        setMe({ firstname: user.firstname, lastname: user.lastname, image_url: user.image_url })
                        const roles = await getRolesForUser(user.id)
                        const names = roles.map(r => (r.role || '').toLowerCase())
                        setIsAdmin(names.includes('admin'))
                        setIsGroupAdmin(names.includes('admingroup') || names.includes('admin'))
                    } catch {
                        setIsAdmin(false)
                        setIsGroupAdmin(false)
                        setMe(null)
                    }
                } else {
                    setIsAdmin(false)
                    setIsGroupAdmin(false)
                    setMe(null)
                }
            } catch {
                if (mounted) { setIsAuth(false); setIsAdmin(false); setIsGroupAdmin(false); setMe(null) }
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

    function renderAvatar() {
        const size = 32
        const style: React.CSSProperties = { width: size, height: size }
        if (me?.image_url) {
            return (
                <img
                    src={me.image_url}
                    alt="Avatar"
                    className="rounded-circle"
                    style={{ ...style, objectFit: 'cover' }}
                />
            )
        }
        const first = (me?.firstname || '').trim()
        const last = (me?.lastname || '').trim()
        const initials = `${first ? first[0] : ''}${last ? last[0] : ''}`.toUpperCase() || 'U'
        return (
            <span
                className="rounded-circle d-inline-flex align-items-center justify-content-center bg-secondary text-white fw-semibold"
                style={style}
                aria-hidden="true"
            >
                {initials}
            </span>
        )
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
                <div ref={navbarRef} className="collapse navbar-collapse text-align-right" id="mainNavbar">
                    <ul className="navbar-nav ms-lg-auto mb-2 mb-lg-0 gap-lg-2 align-items-center">
                        <li className='nav-item'>
                            <NavLink to="/" className={({ isActive }) => `nav-link d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}>
                                <i className="bi bi-house-door" aria-hidden="true"></i>
                                {t('nav.home')}
                            </NavLink>
                        </li>
                        {isAuth && (
                            <li className="nav-item">
                                <NavLink to="/user" className={({ isActive }) => `nav-link d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}>
                                    <i className="bi bi-person" aria-hidden="true"></i>
                                    {t('nav.users')}
                                </NavLink>
                            </li>
                        )}
                        
                        {isAuth && isAdmin && (
                            <li className="nav-item">
                                <NavLink to="/admin" className={({ isActive }) => `nav-link d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}>
                                    <i className="bi bi-shield-lock" aria-hidden="true"></i>
                                    {t('nav.admin')}
                                </NavLink>
                            </li>
                        )}
                        
                        {isAuth && isGroupAdmin && !isAdmin && (
                            <li className="nav-item">
                                <NavLink to="/admingroup" className={({ isActive }) => `nav-link d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}>
                                    <i className="bi bi-people" aria-hidden="true"></i>
                                    {getRoleLabel('admingroup')}
                                </NavLink>
                            </li>
                        )}

                        {isAuth && (
                            <>
                                <li className="nav-item">
                                    <NavLink to="/caisse" className={() => `nav-link d-flex align-items-center gap-2 ${isCashActive ? 'active' : ''}`}>
                                        <i className="bi bi-cash-coin" aria-hidden="true"></i>
                                        {t('nav.cash')}
                                    </NavLink>
                                </li>
                                <li className="nav-item">
                                    <NavLink to="/tree" className={({ isActive }) => `nav-link d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}>
                                        <i className="bi bi-people" aria-hidden="true"></i>
                                        {t('nav.tree')}
                                    </NavLink>
                                </li>
                                <li className="nav-item">
                                    <NavLink to="/chartes" className={({ isActive }) => `nav-link d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}>
                                        <i className="bi bi-file-earmark-text" aria-hidden="true"></i>
                                        {t('nav.chartes')}
                                    </NavLink>
                                </li>
                            </>
                        )}

                        {isAuth === null ? null : isAuth ? (
                            <li className="nav-item dropdown">
                                <button
                                    className="btn nav-link dropdown-toggle d-flex align-items-center gap-2"
                                    data-bs-toggle="dropdown"
                                    aria-expanded="false"
                                    aria-label={t('header.userAccount')}
                                    title={`${(me?.firstname || '').trim()} ${(me?.lastname || '').trim()}`.trim() || t('nav.profile')}
                                >
                                    {renderAvatar()}
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
                        {/* Notifications */}
                        {isAuth && (
                            <Notifications />
                        )}
                    </ul>
                </div>
            </nav>
        </header>
    )
}

export default Header
