import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getMessages, markMessageRead, markAllMessagesRead, getUserMessageInfo } from '@src/services/messages'
import { getCurrentUser } from '@src/services/users'
import './Notification.css'
import Chat from './Chat'
import Modal from '../common/Modal'

type Message = {
	id: string
	title: string
	body: string
	date: string
	link: string
	read?: boolean
	ts?: number
	sended_by_id?: number
	received_by_id?: number
	raw?: any
}

function MessageCard({ msg, onOpen }: { msg: Message; onOpen: (id: string) => void }) {
	const { t } = useTranslation()
	return (
		<div className={`message-card ${msg.read ? 'read' : 'unread'}`}>
			<div className="message-main">
				<div className="message-title">{msg.title}</div>
				<div className="message-body">{msg.body}</div>
                <div className="message-date">{msg.date}</div>
			</div>
			<div className="message-meta">
				<button type="button" className="btn btn-sm btn-primary" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen(msg.id) }}>
					{t('notifications.view', 'Voir')}
				</button>
			</div>
		</div>
	)
}

export default function Notifications() {
	const { t } = useTranslation()
	const [messages, setMessages] = useState<Message[]>([])
	const [open, setOpen] = useState(false)
	const [chatOpen, setChatOpen] = useState(false)
	const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
	const [listMaxHeight, setListMaxHeight] = useState<number | undefined>(undefined)
	const navigate = useNavigate()
	const containerRef = useRef<HTMLLIElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const lastIdRef = useRef(0)

	const unreadCount = messages.filter(m => !m.read).length

	const [showModal, setShowModal] = useState(false)
	const [modalMessage, setModalMessage] = useState<any | null>(null)

    // Load messages
	useEffect(() => {
		const fetchMessages = async () => {
			try {
				const lastId = lastIdRef.current
				const data = await getMessages(lastId)
				
				if (data && data.length > 0) {
                    let fullList = data
                    
                    // Si ce n'est pas le chargement initial et qu'on a des données, on recharge tout
                    // pour garantir la cohérence (comme demandé)
                    if (lastId > 0) {
                        fullList = await getMessages(0)
                    }

					// Update max ID
					const maxId = fullList.reduce((max: number, m: any) => m.id > max ? m.id : max, 0)
					if (maxId > lastIdRef.current) {
						lastIdRef.current = maxId
					}

					setMessages(prev => {
						const readMap = new Map(prev.map(m => [m.id, m.read]))
						return fullList.map((m: any) => {
							const id = m.id.toString()
							return {
								id,
								title: m.message_type,
								body: m.message,
								date: new Date(m.received_at).toLocaleString(),
								ts: new Date(m.received_at).getTime(),
								link: m.link || '#',
								read: readMap.has(id) ? !!readMap.get(id) : m.isread === 1,
								sended_by_id: m.sended_by_id,
								received_by_id: m.received_by_id,
								raw: m,
							}
						})
					})
				}
			} catch (err) {
				console.error('Failed to fetch messages', err)
			}
		}

		// initial fetch
		fetchMessages()
		// poll every 30 seconds
		const interval = setInterval(fetchMessages, 30_000)
		return () => clearInterval(interval)
	}, [])

	// Close on click outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setOpen(false)
			}
		}
		if (open) {
			document.addEventListener('mousedown', handleClickOutside)
		}
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [open])

	// Calculate position
	useLayoutEffect(() => {
		if (open && containerRef.current && dropdownRef.current) {
			const containerRect = containerRef.current.getBoundingClientRect()
			const dropdownRect = dropdownRef.current.getBoundingClientRect()
			const viewportWidth = window.innerWidth
			const viewportHeight = window.innerHeight
			const margin = 10

			const style: React.CSSProperties = {}

			// Always open downward
			style.top = '100%'
			style.bottom = 'auto'
			style.marginTop = '0.125rem'

			// Responsive sizing on very small screens
			const isSmallScreen = viewportWidth < 576
			if (isSmallScreen) {
				style.minWidth = '240px'
				style.maxWidth = `${viewportWidth - margin * 2}px`
			}

			// Horizontal alignment: try center, else right, else left, else clamp
			const centerLeft = containerRect.left + containerRect.width / 2 - dropdownRect.width / 2
			const centerRight = centerLeft + dropdownRect.width
			const fitsCenter = centerLeft >= margin && centerRight <= viewportWidth - margin

			const rightLeft = containerRect.right - dropdownRect.width
			const fitsRight = rightLeft >= margin

			const leftRight = containerRect.left + dropdownRect.width
			const fitsLeft = leftRight <= viewportWidth - margin

			if (fitsCenter) {
				style.left = '50%'
				style.right = 'auto'
				style.transform = 'translateX(-50%)'
			} else if (fitsRight) {
				style.right = 0
				style.left = 'auto'
				style.transform = undefined
			} else if (fitsLeft) {
				style.left = 0
				style.right = 'auto'
				style.transform = undefined
			} else {
				// Fallback: center and clamp width to viewport
				style.left = '50%'
				style.right = 'auto'
				style.transform = 'translateX(-50%)'
				style.maxWidth = `${viewportWidth - margin * 2}px`
			}

			// Compute list max-height so only the list scrolls (avoid double scrollbars)
			const availableHeight = Math.max(150, viewportHeight - containerRect.bottom - margin)
			const headerEl = dropdownRef.current.querySelector('.dropdown-header') as HTMLElement | null
			const footerEl = dropdownRef.current.querySelector('.dropdown-footer') as HTMLElement | null
			const padding = 16 // approximate padding from p-2
			const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0
			const footerH = footerEl ? footerEl.getBoundingClientRect().height : 0
			const computedListMax = Math.max(100, availableHeight - headerH - footerH - padding)
			setListMaxHeight(computedListMax)

			setDropdownStyle(style)
		}
	}, [open])

	function openMessage(id: string) {
		const msg = messages.find(m => m.id === id)
		if (!msg) return
		// Mark as read
		markMessageRead(parseInt(id)).catch(console.error)
		setMessages(prev => prev.map(m => (m.id === id ? { ...m, read: true } : m)))
		// Enrich modal with minimal sender info via authenticated endpoint
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
		setOpen(false)
	}

	return (
		<>
		<li className="nav-item dropdown notifications-root" ref={containerRef}>
			<button
				className="btn nav-link d-flex align-items-center gap-2 position-relative"
				onClick={() => setOpen(v => !v)}
				aria-expanded={open}
				aria-label={t('notifications.menu', 'Notifications')}
			>
				<i className="bi bi-bell fs-5" aria-hidden="true"></i>
				{unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
			</button>
			{open && (
				<div 
					className="notifications-dropdown dropdown-menu show p-2" 
					ref={dropdownRef}
					style={dropdownStyle}
				>
					<div className="dropdown-header d-flex justify-content-between align-items-center">
						<strong>{t('notifications.header', 'Notifications')}</strong>
						<div className="d-flex gap-2">
							<button className="btn btn-sm btn-light" onClick={() => { setOpen(false); setChatOpen(true) }} title={t('notifications.new', 'Nouveau message')}>
								<i className="bi bi-pencil-square"></i>
							</button>
							<button
								className="btn btn-sm btn-link"
								onClick={async () => {
									try {
										await markAllMessagesRead()
										setMessages(prev => prev.map(m => ({ ...m, read: true })))
									} catch (err) {
										console.error('Failed to mark all as read', err)
									}
								}}
							>
								{t('notifications.markAllRead', 'Marquer lues')}
							</button>
						</div>
					</div>
					<div className="notifications-list mt-2" style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}>
						{messages.length === 0 && <div className="text-muted p-2">{t('notifications.none', 'Aucun message')}</div>}
						{[...messages]
							.sort((a, b) => {
								const ar = a.read ? 1 : 0
								const br = b.read ? 1 : 0
								if (ar !== br) return ar - br // unread (0) first
								const at = a.ts || 0
								const bt = b.ts || 0
								return bt - at // newer first
							})
							.map(m => (
							<MessageCard key={m.id} msg={m} onOpen={openMessage} />
						))}
					</div>
					<div className="dropdown-footer text-center mt-2">
						<button type="button" className="btn btn-sm btn-outline-secondary" onClick={(e) => { e.preventDefault(); setOpen(false); navigate('/notifications') }}>
							{t('notifications.viewAll', 'Voir toutes')}
						</button>
					</div>
				</div>
			)}
		</li>
		{chatOpen && <Chat onClose={() => setChatOpen(false)} />}

		<Modal isOpen={showModal} onClose={() => { setShowModal(false); setModalMessage(null) }}>
			{modalMessage && (
				<div>
					<h6 className="mb-1">{modalMessage.title}</h6>
					<div className="text-muted small mb-2">{t('notifications.received', 'Reçu')}: {modalMessage.date}</div>
					{modalMessage.sender && (
						<div className="mb-1"><strong>{t('notifications.sender', 'Expéditeur')}:</strong> {modalMessage.sender.firstname} {modalMessage.sender.lastname}</div>
					)}
					{modalMessage.receiver && (
						<div className="mb-2"><strong>{t('notifications.receiver', 'Destinataire')}:</strong> {modalMessage.receiver.firstname} {modalMessage.receiver.lastname}</div>
					)}
					<div className="mb-3">{modalMessage.body}</div>
				</div>
			)}
		</Modal>
		</>
	)
}

