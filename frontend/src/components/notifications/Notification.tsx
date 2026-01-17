import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMessages, markMessageRead, markAllMessagesRead } from '@src/services/messages'
import './Notification.css'
import Chat from './Chat'

type Message = {
	id: string
	title: string
	body: string
	date: string
	link: string
	read?: boolean
}

function MessageCard({ msg, onOpen }: { msg: Message; onOpen: (id: string) => void }) {
	return (
		<div className={`message-card ${msg.read ? 'read' : 'unread'}`}>
			<div className="message-main">
				<div className="message-title">{msg.title}</div>
				<div className="message-body">{msg.body}</div>
                <div className="message-date">{msg.date}</div>
			</div>
			<div className="message-meta">
				<button className="btn btn-sm btn-primary" onClick={() => onOpen(msg.id)}>
					Voir
				</button>
			</div>
		</div>
	)
}

export default function Notifications() {
	const [messages, setMessages] = useState<Message[]>([])
	const [open, setOpen] = useState(false)
	const [chatOpen, setChatOpen] = useState(false)
	const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
	const navigate = useNavigate()
	const containerRef = useRef<HTMLLIElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const lastIdRef = useRef(0)

	const unreadCount = messages.filter(m => !m.read).length

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
								link: m.link || '#',
								read: readMap.has(id) ? !!readMap.get(id) : m.isread === 1
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
			
			const style: React.CSSProperties = {}

			// Vertical positioning
			if (containerRect.bottom + dropdownRect.height > viewportHeight - 10) {
				style.top = 'auto'
				style.bottom = '100%'
				style.marginBottom = '0.125rem'
			} else {
				style.top = '100%'
				style.bottom = 'auto'
				style.marginTop = '0.125rem'
			}

			// Horizontal positioning
			const isRightSide = containerRect.left > viewportWidth / 2
			
			if (isRightSide) {
				const rightAlignedLeftEdge = containerRect.right - dropdownRect.width
				if (rightAlignedLeftEdge < 10) {
                    const leftAlignedRightEdge = containerRect.left + dropdownRect.width
                    if (leftAlignedRightEdge > viewportWidth - 10) {
                        style.right = 0
                        style.left = 'auto'
                    } else {
                        style.left = 0
                        style.right = 'auto'
                    }
				} else {
					style.right = 0
					style.left = 'auto'
				}
			} else {
				const leftAlignedRightEdge = containerRect.left + dropdownRect.width
				if (leftAlignedRightEdge > viewportWidth - 10) {
					style.right = 0
					style.left = 'auto'
				} else {
					style.left = 0
					style.right = 'auto'
				}
			}
			setDropdownStyle(style)
		}
	}, [open])

	function openMessage(id: string) {
		const msg = messages.find(m => m.id === id)
		if (!msg) return
		// Mark as read
        markMessageRead(parseInt(id)).catch(console.error)
		setMessages(prev => prev.map(m => (m.id === id ? { ...m, read: true } : m)))
		// Navigate to message link
		if (msg.link && msg.link !== '#' && msg.link.trim() !== '') {
			if (/^https?:\/\//i.test(msg.link)) {
				window.location.href = msg.link
			} else {
				navigate(msg.link)
			}
		}
		setOpen(false)
	}

	return (
		<>
		<li className="nav-item dropdown notifications-root" ref={containerRef}>
			<button
				className="btn nav-link d-flex align-items-center gap-2 position-relative"
				onClick={() => setOpen(v => !v)}
				aria-expanded={open}
				aria-label="Notifications"
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
						<strong>Notifications</strong>
						<div className="d-flex gap-2">
							<button className="btn btn-sm btn-light" onClick={() => { setOpen(false); setChatOpen(true) }} title="Nouveau message">
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
								Marquer lues
							</button>
						</div>
					</div>
					<div className="notifications-list mt-2">
						{messages.length === 0 && <div className="text-muted p-2">Aucun message</div>}
						{messages.map(m => (
							<MessageCard key={m.id} msg={m} onOpen={openMessage} />
						))}
					</div>
					<div className="dropdown-footer text-center mt-2">
						<button type="button" className="btn btn-sm btn-outline-secondary" onClick={(e) => { e.preventDefault(); setOpen(false); navigate('/notifications') }}>
							Voir toutes
						</button>
					</div>
				</div>
			)}
		</li>
		{chatOpen && <Chat onClose={() => setChatOpen(false)} />}
		</>
	)
}

