import { useEffect } from 'react'

export default function Modal({
    isOpen,
    title,
    onClose,
    children,
    size,
}: {
    isOpen: boolean
    title?: string
    onClose: () => void
    children: React.ReactNode
    size?: 'sm' | 'lg' | 'xl'
}) {
    useEffect(() => {
        if (!isOpen) return
        const body = document.body
        const prevOverflow = body.style.overflow
        body.classList.add('modal-open')
        body.style.overflow = 'hidden'
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => {
            body.classList.remove('modal-open')
            body.style.overflow = prevOverflow
            window.removeEventListener('keydown', onKey)
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    const dialogClass = size ? `modal-dialog modal-${size}` : 'modal-dialog'

    return (
        <>
            <div className="modal fade show d-block" role="dialog" aria-modal="true" onClick={onClose}>
                <div className={dialogClass} onClick={e => e.stopPropagation()}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">{title}</h5>
                            <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
                        </div>
                        <div className="modal-body">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show"></div>
        </>
    )
}
