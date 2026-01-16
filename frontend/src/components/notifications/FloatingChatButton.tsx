import { useState, useEffect } from 'react'
import Chat from './Chat'
import { getToken } from '../../services/auth'
import './Chat.css'

export default function FloatingChatButton() {
    const [open, setOpen] = useState(false)
    const [isAuthenticated, setIsAuthenticated] = useState(!!getToken())

    useEffect(() => {
        const handleAuthChange = () => {
            setIsAuthenticated(!!getToken())
        }
        window.addEventListener('auth-changed', handleAuthChange)
        // Check manually in case event was missed or on mount
        setIsAuthenticated(!!getToken())
        
        return () => window.removeEventListener('auth-changed', handleAuthChange)
    }, [])

    if (!isAuthenticated) return null

    return (
        <>
            <button 
                className="floating-chat-btn" 
                onClick={() => setOpen(true)}
                title="Envoyer un message"
                role="button"
                aria-label="Ouvrir le chat"
            >
                <i className="bi bi-chat-dots-fill"></i>
            </button>
            {open && <Chat onClose={() => setOpen(false)} />}
        </>
    )
}
