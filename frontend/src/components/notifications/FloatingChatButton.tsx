import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import Chat from './Chat'
import { getToken } from '../../services/auth'
import './Chat.css'

const floatingChatResources = {
    fr: {
        notifications: {
            floating: {
                title: 'Envoyer un message',
                aria: 'Ouvrir le chat'
            }
        }
    },
    en: {
        notifications: {
            floating: {
                title: 'Send a message',
                aria: 'Open chat'
            }
        }
    },
    ar: {
        notifications: {
            floating: {
                title: 'إرسال رسالة',
                aria: 'فتح الدردشة'
            }
        }
    }
}

for (const [lng, res] of Object.entries(floatingChatResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function FloatingChatButton() {
    const { t } = useTranslation()
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
                title={t('notifications.floating.title', 'Envoyer un message')}
                role="button"
                aria-label={t('notifications.floating.aria', 'Ouvrir le chat')}
            >
                <i className="bi bi-chat-dots-fill"></i>
            </button>
            {open && <Chat onClose={() => setOpen(false)} />}
        </>
    )
}
