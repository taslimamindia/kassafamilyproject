import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import i18n from '../i18n'

type Lang = 'fr' | 'en' | 'ar'

type LanguageContextValue = {
  language: Lang
  setLanguage: (lng: Lang) => void
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

function applyDomLanguage(lng: Lang) {
  const html = document.documentElement
  const isRTL = lng === 'ar'
  html.setAttribute('lang', lng)
  html.setAttribute('dir', isRTL ? 'rtl' : 'ltr')
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const initial: Lang = (i18n.language as Lang) || 'fr'
  const [language, setLang] = useState<Lang>(initial)

  // keep DOM direction and i18n in sync
  useEffect(() => {
    applyDomLanguage(language)
    if (i18n.language !== language) {
      i18n.changeLanguage(language)
      // Persist for detector
      try {
        localStorage.setItem('app.lang', language)
      } catch {}
    }
  }, [language])

  // react to external i18n changes
  useEffect(() => {
    const handler = (lng: Lang) => setLang(lng)
    i18n.on('languageChanged', handler)
    return () => {
      i18n.off('languageChanged', handler)
    }
  }, [])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: setLang,
    isRTL: language === 'ar',
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}