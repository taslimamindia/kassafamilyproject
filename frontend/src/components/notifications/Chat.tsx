import { useState, useEffect } from 'react'
import { sendMessage, type MessageCreate } from '../../services/messages'
import { getReceivers, type User } from '../../services/users'
import './Chat.css'

type ChatProps = {
    onClose: () => void
}

export default function Chat({ onClose }: ChatProps) {
    const [recipientType, setRecipientType] = useState<MessageCreate['recipient_type']>('support')
    const [message, setMessage] = useState('')
    const [selectedMembers, setSelectedMembers] = useState<string[]>([])
    const [members, setMembers] = useState<User[]>([])
    const [loadingMembers, setLoadingMembers] = useState(false)
    const [sending, setSending] = useState(false)

    useEffect(() => {
        if (recipientType === 'member' && members.length === 0) {
            setLoadingMembers(true)
            getReceivers()
                .then(data => setMembers(data))
                .catch(err => console.error("Failed to load members", err))
                .finally(() => setLoadingMembers(false))
        }
    }, [recipientType, members.length])

    async function handleSend() {
        if (!message.trim()) return
        if (recipientType === 'member' && selectedMembers.length === 0) return

        const wordCount = message.trim().split(/\s+/).length
        if (wordCount > 150) {
            alert(`Le message est trop long (${wordCount} mots). La limite est de 150 mots.`)
            return
        }

        // Simple heuristic to detect code-like content
        const codePatterns = /<[^>]+>|function\s*\(|=>\s*\{|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|class\s+\w+\s*\{|import\s+.*from/i
        if (codePatterns.test(message)) {
            alert("Le message semble contenir du code ou du HTML, ce qui n'est pas autorisé. Veuillez envoyer uniquement du texte brut.")
            return
        }

        setSending(true)
        try {
            await sendMessage({
                message,
                recipient_type: recipientType,
                recipient_id: recipientType === 'member' ? selectedMembers.map(s => parseInt(s)) : undefined
            })
            onClose()
        } catch (error) {
            console.error(error)
            alert('Erreur lors de l\'envoi du message')
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="chat-overlay">
            <div className="chat-modal">
                <div className="chat-header">
                    <h5>Nouveau message</h5>
                    <button className="btn-close" onClick={onClose} aria-label="Close"></button>
                </div>
                <div className="chat-body">
                    <div className="mb-3">
                        <label className="form-label">Destinataire</label>
                        <select 
                            className="form-select" 
                            value={recipientType} 
                            onChange={(e) => setRecipientType(e.target.value as any)}
                        >
                            <option value="support">Support technique</option>
                            <option value="board">Conseil d'administration</option>
                            <option value="treasury">Trésorerie</option>
                            <option value="member">Un membre (Sélectionner)</option>
                        </select>
                    </div>

                    {recipientType === 'member' && (
                        <div className="mb-3">
                            <label className="form-label">Membres (sélection multiple possible)</label>
                            <div className="border rounded" style={{ maxHeight: '150px', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
                                {members.map(u => (
                                    <div className="d-flex align-items-center border-bottom py-2" key={u.id}>
                                        <input
                                            className="form-check-input ms-3 my-0"
                                            type="checkbox"
                                            value={u.id.toString()}
                                            id={`member-${u.id}`}
                                            checked={selectedMembers.includes(u.id.toString())}
                                            onChange={e => {
                                                const val = e.target.value
                                                if (e.target.checked) {
                                                    setSelectedMembers(prev => [...prev, val])
                                                } else {
                                                    setSelectedMembers(prev => prev.filter(id => id !== val))
                                                }
                                            }}
                                            disabled={loadingMembers}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <label className="d-flex align-items-center flex-grow-1 ps-2 pe-3 mb-0" htmlFor={`member-${u.id}`} style={{ cursor: 'pointer' }}>
                                            <span className="flex-grow-1 text-center">{u.firstname} {u.lastname}</span>
                                            {u.image_url ? (
                                                <img 
                                                    src={u.image_url} 
                                                    alt="" 
                                                    className="rounded-circle" 
                                                    style={{ width: '50px', height: '50px', objectFit: 'cover' }} 
                                                />
                                            ) : (
                                                <div className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white" style={{ width: '50px', height: '50px', fontSize: '10px' }}>
                                                    {(u.firstname?.[0] || u.username?.[0] || '?').toUpperCase()}
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                ))}
                            </div>
                            {loadingMembers && <small className="text-muted">Chargement des membres...</small>}
                        </div>
                    )}

                    <div className="mb-3">
                        <label className="form-label">Message</label>
                        <textarea 
                            className="form-control" 
                            rows={5} 
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Votre message..."
                        ></textarea>
                        <div className="text-end text-muted small mt-1">
                            {message.trim() ? message.trim().split(/\s+/).length : 0} / 150 mots
                        </div>
                    </div>
                </div>
                <div className="chat-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={sending}>Annuler</button>
                    <button className="btn btn-primary" onClick={handleSend} disabled={!message || sending || (recipientType === 'member' && selectedMembers.length === 0)}>
                        {sending ? 'Envoi...' : 'Envoyer'}
                    </button>
                </div>
            </div>
        </div>
    )
}
