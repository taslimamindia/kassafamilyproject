import './Header.css'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { logout, verifyToken } from '../../services/auth'

function Header() {
    const navigate = useNavigate()
    const [isAuth, setIsAuth] = useState<boolean | null>(null)

    useEffect(() => {
        let mounted = true
        const refresh = () => {
            verifyToken()
                .then((ok) => { if (mounted) setIsAuth(ok) })
                .catch(() => { if (mounted) setIsAuth(false) })
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
        navigate('/auth', { replace: true })
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
                        {/* Auth controls */}
                        {isAuth === null ? null : isAuth ? (
                            <li className="nav-item dropdown">
                                <button
                                    className="btn nav-link dropdown-toggle d-flex align-items-center gap-2"
                                    data-bs-toggle="dropdown"
                                    aria-expanded="false"
                                    aria-label="Compte utilisateur"
                                >
                                    <i className="bi bi-person-circle fs-5" aria-hidden="true"></i>
                                    <span>Profil</span>
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end">
                                    <li>
                                        <button className="dropdown-item d-flex align-items-center gap-2" onClick={() => navigate('/profil')}>
                                            <i className="bi bi-person" aria-hidden="true"></i>
                                            Voir le profil
                                        </button>
                                    </li>
                                    <li>
                                        <button className="dropdown-item d-flex align-items-center gap-2" onClick={() => navigate('/profil?edit=1')}>
                                            <i className="bi bi-pencil-square" aria-hidden="true"></i>
                                            Modifier le profil
                                        </button>
                                    </li>
                                    <li><hr className="dropdown-divider" /></li>
                                    <li>
                                        <button className="dropdown-item text-danger d-flex align-items-center gap-2" onClick={onLogout}>
                                            <i className="bi bi-box-arrow-right" aria-hidden="true"></i>
                                            Se déconnecter
                                        </button>
                                    </li>
                                </ul>
                            </li>
                        ) : (
                            <li className="nav-item">
                                <NavLink to="/auth" className={({ isActive }) => `nav-link d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}>
                                    <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i>
                                    Se connecter
                                </NavLink>
                            </li>
                        )}
                    </ul>
                </div>
            </nav>
        </header>
    )
}

export default Header
