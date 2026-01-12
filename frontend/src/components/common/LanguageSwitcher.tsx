import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../contexts/LanguageContext'

const options = [
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
    { value: 'ar', label: 'العربية' },
] as const

function LanguageSwitcher() {
    const { i18n } = useTranslation()
    const { language, setLanguage } = useLanguage()

    const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const lng = e.target.value as (typeof options)[number]['value']
        setLanguage(lng)
        if (i18n.language !== lng) i18n.changeLanguage(lng)
    }

    return (
        <select
            aria-label="Choisir la langue"
            className="form-select form-select-sm ms-2"
            style={{ width: 140 }}
            value={language}
            onChange={onChange}
        >
            {options.map(o => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    )
}

export default LanguageSwitcher