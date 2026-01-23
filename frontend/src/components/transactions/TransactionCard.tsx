import { useState } from 'react'
import { type Transaction } from '../../services/transactions'
import { type User } from '../../services/users'
import { useTranslation } from 'react-i18next'
import Modal from '../common/Modal'

interface TransactionCardProps {
    transaction: Transaction
    currentUser: User | null
    canEdit: boolean
    canDelete: boolean
    canSubmit: boolean
    onEdit: () => void
    onDelete: () => void
    onSubmit: () => void
}

export default function TransactionCard({
    transaction: tx,
    currentUser,
    canEdit,
    canDelete,
    canSubmit,
    onEdit,
    onDelete,
    onSubmit
}: TransactionCardProps) {
    const { t } = useTranslation()
    const [showProof, setShowProof] = useState(false)

    // Status Badge Color
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'VALIDATED': return 'bg-success'
            case 'PENDING': return 'bg-warning text-dark'
            case 'PARTIALLY_APPROVED': return 'bg-info text-dark'
            case 'REJECTED': return 'bg-danger'
            case 'SAVED': return 'bg-secondary'
            default: return 'bg-light text-dark'
        }
    }

    const typeBadge = tx.transaction_type === 'EXPENSE' ? 'bg-danger-subtle text-danger' :
        tx.transaction_type === 'DONATIONS' ? 'bg-info-subtle text-info' : 'bg-success-subtle text-success'

    // User initials
    const userInitials = tx.user_firstname && tx.user_lastname
        ? `${tx.user_firstname[0]}${tx.user_lastname[0]}`.toUpperCase()
        : tx.user_username?.substring(0, 2).toUpperCase()

    const userName = tx.user_firstname && tx.user_lastname
        ? `${tx.user_firstname} ${tx.user_lastname}`
        : tx.user_username

    const recordedByText = tx.recorded_by_id === currentUser?.id
        ? t('transactions.home.byMe', 'Par moi')
        : (tx.recorded_by_firstname && tx.recorded_by_lastname)
            ? `${t('transactions.home.by', 'Par')} ${tx.recorded_by_firstname} ${tx.recorded_by_lastname}`
            : `${t('transactions.home.by', 'Par')} ${tx.recorded_by_username}`

    const approvals = tx.approvals || []
    const notes = approvals.filter(a => a.note && a.note.trim() !== '')

    // Check if proof is a URL
    const isUrl = (str: string) => {
        try {
            new URL(str);
            return true;
        } catch (_) {
            return false;
        }
    }

    const hasProofUrl = tx.proof_reference && (isUrl(tx.proof_reference) || tx.proof_reference.includes('/'));

    return (
        <div className="card h-100 border-0 shadow-sm rounded-4 transaction-card">
            <div className="card-body px-1 py-2 p-md-3 p-lg-4 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start mb-2 mb-md-3">
                    <div className="d-flex align-items-center gap-2 gap-md-3">
                        {tx.user_image_url ? (
                            <img src={tx.user_image_url} alt="" className="rounded-circle" style={{ width: '48px', height: '48px', objectFit: 'cover' }} />
                        ) : (
                            <div className="avatar-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold rounded-circle" style={{ width: '48px', height: '48px', fontSize: '1.2rem' }}>
                                {userInitials}
                            </div>
                        )}
                        <div>
                            <div className="fw-bold text-dark">{userName}</div>
                            <div className="small text-muted">{recordedByText}</div>
                        </div>
                    </div>
                    <div className="text-end">
                        <span className={`badge ${typeBadge} px-3 py-2 rounded-pill small mb-2 d-inline-block`}>
                            {t(`transactionTypes.${tx.transaction_type}`)}
                        </span>
                        <h4 className={`mb-0 fw-bold ${tx.transaction_type === 'EXPENSE' ? 'text-danger' : 'text-success'}`}>
                            {tx.transaction_type === 'EXPENSE' ? '-' : '+'}{Number(tx.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                        </h4>
                    </div>
                </div>

                <div className="flex-grow-1">
                    <div className="row g-3 mb-3">
                        <div className="col-6">
                            <small className="text-muted d-block mb-1">{t('transactions.home.thDate', 'Date')}</small>
                            <div className="fw-medium">
                                {new Date(tx.created_at).toLocaleDateString()}
                            </div>
                        </div>
                        <div className="col-6">
                            <small className="text-muted d-block mb-1">{t('transactions.home.thPayment', 'Mode')}</small>
                            <div className="fw-medium">
                                {tx.payment_method_name || '-'}
                            </div>
                        </div>
                        <div className="col-12">
                            <small className="text-muted d-block mb-1">{t('transactions.home.thStatus', 'Statut')}</small>
                            <span className={`badge ${getStatusBadge(tx.status)} rounded-pill`}>
                                {t(`transactionStatus.${tx.status}`)}
                            </span>
                        </div>
                    </div>

                    {approvals.length > 0 && (
                        <div className="mb-3">
                            <small className="text-muted d-block mb-1">{t('transactions.home.approvedBy', 'Validations')}</small>
                            <div className="d-flex flex-column gap-1">
                                {approvals.map((a, i) => {
                                    const n = a.approved_by_firstname && a.approved_by_lastname
                                        ? `${a.approved_by_firstname} ${a.approved_by_lastname}`
                                        : a.approved_by_username
                                    return (
                                        <div key={i} className="small text-muted d-flex align-items-center">
                                            <i className="bi bi-check-circle-fill text-success me-2"></i>
                                            <span className="fw-medium text-dark me-1">{n}</span>
                                            <span className="text-muted" style={{ fontSize: '0.85em' }}>({a.approved_by_username})</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {notes.length > 0 && (
                        <div className="alert alert-light border border-warning-subtle mb-3 p-2 small">
                            {notes.map((note, idx) => {
                                const approverName = note.approved_by_firstname && note.approved_by_lastname
                                    ? `${note.approved_by_firstname} ${note.approved_by_lastname}`
                                    : note.approved_by_username
                                return (
                                    <div key={idx} className="mb-1">
                                        <i className="bi bi-info-circle text-warning me-2"></i>
                                        <span className="fw-bold">{approverName} ({note.role_at_approval}): </span>
                                        {note.note}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="border-top pt-2 pt-md-3 d-flex justify-content-end align-items-center gap-1 gap-md-2 mt-auto">
                    {tx.proof_reference && !hasProofUrl && (
                        <span className="text-muted small me-auto">
                            <strong>Ref:</strong> {tx.proof_reference}
                        </span>
                    )}

                    {canSubmit && (
                        <button className="btn btn-sm btn-success rounded-pill px-2 px-md-3" onClick={onSubmit} title="Soumettre">
                            <i className="bi bi-send me-1"></i>
                        </button>
                    )}
                    {canEdit && (
                        <button className="btn btn-sm btn-outline-primary rounded-circle" onClick={onEdit} style={{ width: 32, height: 32, padding: 0 }}>
                            <i className="bi bi-pencil"></i>
                        </button>
                    )}
                    {canDelete && (
                        <button className="btn btn-sm btn-outline-danger rounded-circle" onClick={onDelete} style={{ width: 32, height: 32, padding: 0 }}>
                            <i className="bi bi-trash"></i>
                        </button>
                    )}
                    {hasProofUrl && (
                        <button className="btn btn-sm btn-info text-white rounded-pill px-2 px-md-3" onClick={() => setShowProof(true)}>
                            <i className="bi bi-eye me-1"></i> Preuve
                        </button>
                    )}
                </div>
            </div>

            {hasProofUrl && (
                <Modal isOpen={showProof} onClose={() => setShowProof(false)} title="Preuve de transaction" size="lg">
                    <div className="text-center p-3">
                        <img src={tx.proof_reference} alt="Preuve" className="img-fluid rounded shadow-sm" style={{ maxHeight: '80vh' }} />
                        <div className="mt-3">
                            <a href={tx.proof_reference} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary">
                                <i className="bi bi-box-arrow-up-right me-2"></i> Ouvrir
                            </a>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}
