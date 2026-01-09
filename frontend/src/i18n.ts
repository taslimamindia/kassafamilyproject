import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Decentralized: keep resources empty, components will register their own bundles.
const resources = {}

const DEFAULT_LANG = 'fr'

// Ensure default language is French on first load and set html attributes
try {
    const stored = typeof window !== 'undefined' ? window.localStorage?.getItem('app.lang') : null
    const initial = stored || DEFAULT_LANG
    if (!stored && typeof window !== 'undefined') {
        window.localStorage?.setItem('app.lang', DEFAULT_LANG)
    }
    if (typeof document !== 'undefined') {
        document.documentElement.lang = initial
        document.documentElement.dir = initial === 'ar' ? 'rtl' : 'ltr'
    }
} catch {
    // Ignore storage/DOM access issues (SSR or restricted env)
}

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'fr',
        supportedLngs: ['fr', 'en', 'ar'],
        interpolation: {
            escapeValue: false,
        },
        detection: {
            // Prefer persisted setting, then browser, then <html lang>
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage'],
            lookupLocalStorage: 'app.lang',
        },
    })

// Keep html attributes and persistence in sync on language changes
i18n.on('languageChanged', lng => {
    try {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = lng
            document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr'
        }
        if (typeof window !== 'undefined') {
            window.localStorage?.setItem('app.lang', lng)
        }
    } catch {
        // ignore
    }
})

export default i18n