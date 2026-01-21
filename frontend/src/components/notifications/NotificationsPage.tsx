import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getMessages, markAllMessagesRead, markMessageRead, getUserMessageInfo } from '@src/services/messages'
import { getCurrentUser } from '@src/services/users'
import Modal from '../common/Modal'
import './Notification.css'

export default function NotificationsPage() {
    const { t } = useTranslation()
    const [messages, setMessages] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const lastIdRef = useRef(0)
    const navigate = useNavigate()

    useEffect(() => {
        let mounted = true
        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const data = await getMessages(0)
                if (!mounted) return
                // Normalize and keep useful metadata
                const normalized = (data || []).map((m: any) => ({
                    id: String(m.id),
                    title: m.message_type,
                    body: m.message,
                    date: new Date(m.received_at).toLocaleString(),
                    received_at: m.received_at,
                    ts: new Date(m.received_at).getTime(),
                    link: m.link || '#',
                    read: m.isread === 1,
                    sended_by_id: m.sended_by_id,
                    received_by_id: m.received_by_id,
                    raw: m,
                }))
                const maxId = normalized.reduce((mx, m) => Math.max(mx, Number(m.id)), 0)
                lastIdRef.current = maxId
                setMessages(normalized)
            } catch (e: any) {
                setError(e?.message || t('notifications.loadFailed', 'Failed to load messages'))
            } finally {
                setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [])

    const unreadCount = useMemo(() => messages.filter(i => !i.read).length, [messages])

    const sorted = useMemo(() => {
        return [...messages].sort((a, b) => {
            const ar = a.read ? 1 : 0
            const br = b.read ? 1 : 0
            if (ar !== br) return ar - br // unread first
            return (b.ts || 0) - (a.ts || 0) // latest first
        })
    }, [messages])

    function openMessage(id: string) {
        const msg = messages.find(m => m.id === id)
        if (!msg) return
        // mark as read and open in modal
        markMessageRead(parseInt(id, 10)).catch(() => { })
        const newItemsOnOpen = messages.map(m => (m.id === id ? { ...m, read: true } : m))
        setMessages(newItemsOnOpen);
        // Fetch minimal sender info and current user for receiver name
        Promise.allSettled([
            getUserMessageInfo(parseInt(id, 10)),
            getCurrentUser(),
        ]).then(results => {
            const senderRes = results[0]
            const meRes = results[1]
            const sender = senderRes.status === 'fulfilled' ? senderRes.value.sender : undefined
            const receiver = meRes.status === 'fulfilled' ? meRes.value : undefined
            setModalMessage({ ...msg, sender, receiver })
        }).finally(() => setShowModal(true))
    }

    const [showModal, setShowModal] = useState(false)
    const [modalMessage, setModalMessage] = useState<any | null>(null)

    return (
        <div className="container py-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="h5 mb-0">{t('notifications.header', 'Notifications')}</h2>
                <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-secondary">{t('notifications.unreadLabel', 'Non lues')}: {unreadCount}</span>
                    <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={async () => {
                                try {
                                    await markAllMessagesRead()
                                    const newAllRead = messages.map(m => ({ ...m, read: true }))
                                    setMessages(newAllRead)
                                } catch { }
                        }}
                    >
                        {t('notifications.markAllRead', 'Marquer toutes lues')}
                    </button>
                </div>
            </div>

            {loading && <div>{t('common.loading', 'Chargement…')}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                <div className="notifications-list" style={{ maxHeight: 'unset' }}>
                    {sorted.length === 0 && <div className="text-muted p-2">{t('notifications.none', 'Aucun message')}</div>}
                    {sorted.map(m => (
                        <div key={m.id} className={`message-card ${m.read ? 'read' : 'unread'}`}>
                            <div className="message-main">
                                <div className="message-title">{m.title}</div>
                                <div className="message-body">{m.body}</div>
                                <div className="message-date">{m.date}</div>
                            </div>
                            <div className="message-meta">
                                {!m.read && (
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={async () => {
                                                try {
                                                    await markMessageRead(parseInt(m.id, 10))
                                                    const newItems = messages.map(x => (x.id === m.id ? { ...x, read: true } : x))
                                                    setMessages(newItems)
                                                } catch { }
                                        }}
                                    >
                                        {t('notifications.markOneRead', 'Marquer lue')}
                                    </button>
                                )}
                                <button type="button" className="btn btn-sm btn-primary" onClick={() => openMessage(m.id)}>
                                    {t('notifications.open', 'Ouvrir')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={showModal} onClose={() => { setShowModal(false); setModalMessage(null) }}>
                {modalMessage && (
                    <div>
                        <h5 className="mb-2">{modalMessage.title}</h5>
                        <div className="text-muted small mb-2">{t('notifications.received', 'Reçu')}: {modalMessage.date}</div>
                        {modalMessage.sender && (
                            <div className="mb-1"><strong>{t('notifications.sender', 'Expéditeur')}:</strong> {modalMessage.sender.firstname} {modalMessage.sender.lastname}</div>
                        )}
                        {modalMessage.receiver && (
                            <div className="mb-2"><strong>{t('notifications.receiver', 'Destinataire')}:</strong> {modalMessage.receiver.firstname} {modalMessage.receiver.lastname}</div>
                        )}

                        <div className="mb-3">{modalMessage.body}</div>

                        <div className="mb-3 small text-muted">
                            <div>{t('notifications.type', 'Type')}: {modalMessage.title}</div>
                            {/* No IDs in UI as requested */}
                            <div>{t('notifications.readLabel', 'Lu')}: {modalMessage.read ? t('common.yes', 'Oui') : t('common.no', 'Non')}</div>
                        </div>

                        <div className="d-flex justify-content-end">
                            {modalMessage.link && modalMessage.link !== '#' && (
                                <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => {
                                        const l = modalMessage.link
                                        if (/^https?:\/\//i.test(l)) {
                                            window.location.href = l
                                        } else {
                                            navigate(l)
                                        }
                                    }}
                                >
                                    {t('notifications.goToLink', 'Aller au lien')}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
