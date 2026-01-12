import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
// Localized dictionary for this component
const filterBarResources = {
    fr: { search: 'Rechercher…', common: { close: 'Fermer' } },
    en: { search: 'Search…', common: { close: 'Close' } },
    ar: { search: 'بحث…', common: { close: 'إغلاق' } },
}

for (const [lng, res] of Object.entries(filterBarResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function FilterBar({
    value,
    onChange,
    placeholder,
    className,
}: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}) {
    const { t } = useTranslation()
    function handle(e: ChangeEvent<HTMLInputElement>) {
        onChange(e.target.value)
    }
    return (
        <div className={className ?? 'mb-3'}>
            <div className="input-group">
                <span className="input-group-text" id="search-addon">
                    <i className="bi bi-search" aria-hidden="true"></i>
                </span>
                <input
                    type="search"
                    className="form-control"
                    placeholder={placeholder ?? t('search')}
                    aria-label={t('search')}
                    aria-describedby="search-addon"
                    value={value}
                    onChange={handle}
                />
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => onChange('')}
                    disabled={!value}
                    aria-label={t('common.close')}
                >
                    <i className="bi bi-x-lg" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    )
}
