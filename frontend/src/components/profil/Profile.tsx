import { useSearchParams } from 'react-router-dom'
import ViewProfile from './ViewProfile'
import EditProfile from './EditProfile'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
// Localized dictionary for this component
const profilePageResources = {
    fr: { profilePage: { title: 'Mon profil' } },
    en: { profilePage: { title: 'My profile' } },
    ar: { profilePage: { title: 'ملفي' } },
}

for (const [lng, res] of Object.entries(profilePageResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function Profile() {
    const { t } = useTranslation()
    const [params] = useSearchParams()
    const isEdit = params.get('edit') === '1'

    return (
        <div className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2>{t('profilePage.title')}</h2>
            </div>
            {isEdit ? <EditProfile /> : <ViewProfile />}
        </div>
    )
}
