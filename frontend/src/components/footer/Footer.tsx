import './Footer.css'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

// Localized dictionary for this component
const footerResources = {
    fr: { footer: { association: 'Association Familiale' }, common: { email: 'Email' } },
    en: { footer: { association: 'Family Association' }, common: { email: 'Email' } },
    ar: { footer: { association: 'الجمعية العائلية' }, common: { email: 'البريد الإلكتروني' } },
}

for (const [lng, res] of Object.entries(footerResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

function Footer() {
    const { t } = useTranslation()
    return (
        <footer className="mt-auto border-top bg-light">
            <div className="container py-3 d-flex flex-column flex-sm-row align-items-center justify-content-between gap-2">
                <div className="text-muted small">
                    © {new Date().getFullYear()} {t('footer.association')}
                </div>
                <div className="d-flex align-items-center gap-3">
                    <a className="text-muted" href="#" aria-label={t('common.email')}>
                        <i className="bi bi-envelope fs-5"></i>
                    </a>
                </div>
            </div>
        </footer>
    )
}

export default Footer
