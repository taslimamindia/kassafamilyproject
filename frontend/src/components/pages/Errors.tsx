import './Errors.css'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

// Localized dictionary for this component
const errorsResources = {
  fr: { errors: { title: "Quelque chose s'est mal passé", description: 'La page demandée est introuvable ou temporairement indisponible.', backHome: "Retour à l'accueil" } },
  en: { errors: { title: 'Something went wrong', description: 'The requested page is unavailable or temporarily down.', backHome: 'Back to home' } },
  ar: { errors: { title: 'حدث خطأ ما', description: 'الصفحة المطلوبة غير متاحة أو متوقفة مؤقتًا.', backHome: 'العودة إلى الرئيسية' } },
}

for (const [lng, res] of Object.entries(errorsResources)) {
  i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

function Errors() {
  const { t } = useTranslation()
  return (
    <section className="py-5">
      <div className="container d-flex align-items-center justify-content-center">
        <div className="text-center errors-card p-4 p-md-5">
          <div className="display-5 mb-2">😕</div>
          <h2 className="h4 fw-semibold mb-2">{t('errors.title')}</h2>
          <p className="text-muted mb-4">
            {t('errors.description')}
          </p>
          <a href="/" className="btn btn-primary">{t('errors.backHome')}</a>
        </div>
      </div>
    </section>
  )
}

export default Errors
