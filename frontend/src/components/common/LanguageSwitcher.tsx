import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../contexts/LanguageContext'
import { useState, useRef, useEffect } from 'react'

const options = [
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
    { value: 'en', label: 'English', flag: '🇬🇧' },
    { value: 'ar', label: 'العربية', flag: '🇸🇦' },
] as const

function LanguageSwitcher() {
    const { i18n } = useTranslation()
    const { language, setLanguage } = useLanguage()
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const currentLang = options.find(o => o.value === language) || options[0]

    const handleSelect = (lng: typeof options[number]['value']) => {
        setLanguage(lng)
        if (i18n.language !== lng) i18n.changeLanguage(lng)
        setIsOpen(false)
    }

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="dropdown ms-2" ref={containerRef}>
            <button 
                className="btn btn-sm d-flex align-items-center gap-2 border-0 bg-transparent text-secondary nav-link"
                type="button" 
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                title={currentLang.label}
            >
                <span className="fs-5">{currentLang.flag}</span>
                <i className="bi bi-chevron-down small" style={{ fontSize: '0.7em' }}></i>
            </button>
            <ul className={`dropdown-menu dropdown-menu-end shadow-sm border-0 ${isOpen ? 'show' : ''}`} style={{ minWidth: '160px', marginTop: '0.5rem' }}>
                {options.map(o => (
                    <li key={o.value}>
                        <button 
                            className={`dropdown-item d-flex align-items-center gap-3 py-2 ${language === o.value ? 'active bg-light text-primary fw-bold' : ''}`}
                            onClick={() => handleSelect(o.value)}
                        >
                            <span className="fs-5">{o.flag}</span>
                            <span>{o.label}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default LanguageSwitcher