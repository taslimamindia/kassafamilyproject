import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

type NotifyDetail = {
    type: 'success' | 'danger' | 'info' | 'warning'
    message: string
    durationMs?: number
}

type Item = NotifyDetail & { id: number }

export default function Notifications() {
    const { t } = useTranslation()
    const [items, setItems] = useState<Item[]>([])

    useEffect(() => {
        let nextId = 1
        const handler = (evt: Event) => {
            const e = evt as CustomEvent<NotifyDetail>
            const detail = e.detail
            if (!detail || !detail.message) return
            const id = nextId++
            const duration = detail.durationMs ?? 3500
            setItems((prev) => [...prev, { id, ...detail }])
            setTimeout(() => {
                setItems((prev) => prev.filter((it) => it.id !== id))
            }, duration)
        }
        window.addEventListener('notify', handler as EventListener)
        return () => {
            window.removeEventListener('notify', handler as EventListener)
        }
    }, [])

    const typeClass = (t: Item['type']) => {
        switch (t) {
            case 'success': return 'text-bg-success'
            case 'danger': return 'text-bg-danger'
            case 'warning': return 'text-bg-warning'
            default: return 'text-bg-info'
        }
    }

    return (
        <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1080 }}>
            <div className="toast-container">
                {items.map((it) => (
                    <div key={it.id} className={`toast show ${typeClass(it.type)} mb-2`} role="alert" aria-live="assertive" aria-atomic="true">
                        <div className="d-flex">
                            <div className="toast-body">
                                {it.message}
                            </div>
                            <button type="button" className="btn-close btn-close-white me-2 m-auto" aria-label={t('common.close', 'Close')} onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
