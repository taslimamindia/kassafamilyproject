import type { ChangeEvent } from 'react'

export default function FilterBar({
    value,
    onChange,
    placeholder = 'Rechercher…',
    className,
}: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}) {
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
                    placeholder={placeholder}
                    aria-label="Rechercher"
                    aria-describedby="search-addon"
                    value={value}
                    onChange={handle}
                />
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => onChange('')}
                    disabled={!value}
                    aria-label="Effacer la recherche"
                >
                    <i className="bi bi-x-lg" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    )
}
