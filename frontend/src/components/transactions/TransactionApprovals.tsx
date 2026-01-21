import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listTransactions, approveTransaction, type Transaction } from '../../services/transactions'
import { getCurrentUser, type User } from '../../services/users'
import './TransactionApprovals.css'
import Modal from '../common/Modal'

// Helper to determine if a user has a specific role
const hasRole = (user: User | null, role: string) => {
    return user?.roles?.some(r => r.role === role) || false
}

export default function TransactionApprovals() {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(false)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [approving, setApproving] = useState(false)
    const [showConfirmBatch, setShowConfirmBatch] = useState(false)

    useEffect(() => {
        let mounted = true
        async function loadData() {
            setLoading(true)
            try {
                const user = await getCurrentUser()
                if (!mounted) return
                setCurrentUser(user)

                // Determine what to fetch based on roles
                const isTreasury = hasRole(user, 'treasury')
                const isBoard = hasRole(user, 'board')

                // We need Pending and Partially Approved transactions
                // Ideally we would have a backend endpoint for "transactions needing my approval"
                // For now, we fetch both statuses and filter client-side
                const [pending, partially] = await Promise.all([
                    listTransactions({ status: 'PENDING' }),
                    listTransactions({ status: 'PARTIALLY_APPROVED' })
                ])

                let all = [...pending, ...partially]

                // Filter based on role rules
                all = all.filter(tx => {
                    // Board: expenses only
                    if (isBoard && tx.transaction_type === 'EXPENSE') return true
                    // Treasury: contributions and donations only
                    if (isTreasury && (tx.transaction_type === 'CONTRIBUTION' || tx.transaction_type === 'DONATIONS')) return true

                    // If user is both? Show both sets.
                    return false
                })

                // Sort by date desc
                all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

                setTransactions(all)
            } catch (e) {
                console.error("Failed to load approvals", e)
            } finally {
                setLoading(false)
            }
        }
        loadData()
        return () => { mounted = false }
    }, [])

    const toggleSelection = (id: number) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelectedIds(newSet)
    }

    const toggleAll = () => {
        if (selectedIds.size === transactions.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(transactions.map(t => t.id)))
        }
    }

    const handleApprove = async (ids: number[]) => {
        if (ids.length === 0) return
        setApproving(true)
        try {
            // Process sequentially to avoid backend race conditions or overwhelming
            for (const id of ids) {
                await approveTransaction(id)
            }

            // Refresh list - simply remove approved items for immediate feedback or reload
            // Reloading is safer to get updated status (e.g. PARTIALLY -> VALIDATED)
            // But if it stays PARTIALLY we still want to remove it?
            // "Les treasury ne peuvent valider que les transactions en attente ou partiellement approvée"
            // If I approve a PARTIALLY_APPROVED one and it becomes VALIDATED, it should disappear from list.
            // If I approve a PENDING one and it becomes PARTIALLY_APPROVED, does it disappear?
            // "Treasury ... validate ... pending or partially approved". 
            // If they just approved it, they shouldn't approve it again.
            // Backend prevents double approval by same user? Not strictly enforced in the provided snippet but usually logic implies it.
            // Wait, helper: listApprovals returns who approved.
            // Ideally we filter out transactions *already approved by me*.

            // Let's refetch to be safe and implement the "already approved by me" filter filter below
            const [pending, partially] = await Promise.all([
                listTransactions({ status: 'PENDING' }),
                listTransactions({ status: 'PARTIALLY_APPROVED' })
            ])
            let all = [...pending, ...partially]

            // Re-apply role filters AND exclude if already approved by current user
            const isTreasury = hasRole(currentUser, 'treasury')
            const isBoard = hasRole(currentUser, 'board')
            const myId = currentUser?.id

            all = all.filter(tx => {
                // Check if already approved by me
                const alreadyApproved = tx.approvals?.some(a => a.users_id === myId)
                if (alreadyApproved) return false

                if (isBoard && tx.transaction_type === 'EXPENSE') return true
                if (isTreasury && (tx.transaction_type === 'CONTRIBUTION' || tx.transaction_type === 'DONATIONS')) return true
                return false
            })

            all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            setTransactions(all)
            setSelectedIds(new Set())
            setShowConfirmBatch(false)

        } catch (e) {
            console.error("Approval failed", e)
            alert("Une erreur est survenue lors de la validation")
        } finally {
            setApproving(false)
        }
    }

    if (!currentUser) return null // or loading

    // Filter out transactions already approved by me in the initial render too?
    // The useEffect fetch logic didn't filter by "approved by me". Let's fix that locally.
    const displayTransactions = transactions.filter(tx => {
        const alreadyApproved = tx.approvals?.some(a => a.users_id === currentUser.id)
        return !alreadyApproved
    })

    return (
        <div className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="mb-1">Validations</h2>
                    <p className="text-muted small mb-0">
                        {hasRole(currentUser, 'treasury') && hasRole(currentUser, 'board')
                            ? "Vue Trésorerie & Conseil d'Administration"
                            : hasRole(currentUser, 'treasury')
                                ? "Vue Trésorerie"
                                : "Vue Conseil d'Administration"}
                    </p>
                </div>
                <div>
                    {selectedIds.size > 0 && (
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowConfirmBatch(true)}
                            disabled={approving}
                        >
                            {approving ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-check-all me-2"></i>}
                            Valider la sélection ({selectedIds.size})
                        </button>
                    )}
                </div>
            </div>

            <div className="card transaction-approvals-card border-0 bg-transparent">
                {/* Mobile View */}
                <div className="d-block d-md-none">
                    {loading ? (
                        <div className="text-center py-5">Chargement...</div>
                    ) : displayTransactions.length === 0 ? (
                        <div className="text-center py-5 text-muted">Aucune transaction en attente.</div>
                    ) : (
                        displayTransactions.map(tx => (
                            <div key={tx.id} className="card border-0 shadow-sm mb-3 rounded-4">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="form-check">
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={selectedIds.has(tx.id)}
                                                onChange={() => toggleSelection(tx.id)}
                                                id={`mobile-check-${tx.id}`}
                                            />
                                            <label className="form-check-label small text-muted ms-2" htmlFor={`mobile-check-${tx.id}`}>
                                                {new Date(tx.created_at).toLocaleDateString()}
                                            </label>
                                        </div>
                                        <span className={`badge rounded-pill fw-normal text-uppercase px-2 py-1 ${tx.status === 'VALIDATED' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`} style={{ fontSize: '0.65rem' }}>
                                            {t(`transactionStatus.${tx.status}`)}
                                        </span>
                                    </div>

                                    <div className="d-flex align-items-center mb-3">
                                        {tx.user_image_url ? (
                                            <img src={tx.user_image_url} alt="" className="rounded-circle me-3" style={{ width: 40, height: 40, objectFit: 'cover' }} />
                                        ) : (
                                            <div className="d-flex align-items-center justify-content-center rounded-circle bg-light me-3" style={{ width: 40, height: 40 }}>
                                                {tx.user_firstname ? tx.user_firstname[0] : tx.user_username?.[0]}
                                            </div>
                                        )}
                                        <div>
                                            <div className="fw-bold">{tx.user_firstname} {tx.user_lastname}</div>
                                            <div className="small text-muted">{t(`transactionTypes.${tx.transaction_type}`)} • {tx.payment_method_name}</div>
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-end mt-3">
                                        <div>
                                            <div className="small text-muted mb-1">Montant</div>
                                            <div className={`fw-bold h5 mb-0 ${tx.transaction_type === 'EXPENSE' ? 'text-danger' : 'text-success'}`}>
                                                {Number(tx.amount).toLocaleString()}
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-outline-success btn-sm rounded-pill px-3"
                                            onClick={() => handleApprove([tx.id])}
                                            disabled={approving}
                                        >
                                            <i className="bi bi-check-lg me-1"></i> Valider
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop View */}
                <div className="table-responsive d-none d-md-block bg-white rounded-3 shadow-sm">
                    <table className="table table-hover align-middle mb-0 approvals-table">
                        <thead className="bg-light text-uppercase small text-muted">
                            <tr>
                                <th style={{ width: '40px' }} className="ps-3">
                                    <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={displayTransactions.length > 0 && selectedIds.size === displayTransactions.length}
                                        onChange={toggleAll}
                                    />
                                </th>
                                <th className="py-3">Date</th>
                                <th className="py-3">Utilisateur</th>
                                <th className="py-3">Type</th>
                                <th className="py-3 text-end">Montant</th>
                                <th className="py-3">Moyen de paiement</th>
                                <th className="py-3">Statut actuel</th>
                                <th className="py-3">Approbations</th>
                                <th className="py-3 text-end pe-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} className="text-center py-5">Chargement...</td></tr>
                            ) : displayTransactions.length === 0 ? (
                                <tr><td colSpan={9} className="text-center py-5 text-muted">Aucune transaction en attente de votre validation.</td></tr>
                            ) : (
                                displayTransactions.map(tx => (
                                    <tr key={tx.id}>
                                        <td className="ps-3">
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={selectedIds.has(tx.id)}
                                                onChange={() => toggleSelection(tx.id)}
                                            />
                                        </td>
                                        <td className="small text-muted">
                                            {new Date(tx.created_at).toLocaleDateString()} <br />
                                            {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center">
                                                {tx.user_image_url ? (
                                                    <img src={tx.user_image_url} alt="" className="rounded-circle me-2" style={{ width: '32px', height: '32px', objectFit: 'cover' }} />
                                                ) : (
                                                    <div className="avatar px-2 py-1 rounded-circle bg-secondary text-white me-2 small d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                                                        {tx.user_firstname ? tx.user_firstname[0] : tx.user_username?.[0]}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="fw-bold fs-6">
                                                        {tx.user_firstname && tx.user_lastname ? `${tx.user_firstname} ${tx.user_lastname}` : tx.user_username}
                                                    </div>
                                                    {tx.recorded_by_id !== tx.users_id && (
                                                        <small className="text-muted" style={{ fontSize: '0.75em' }}>
                                                            Enr. par {tx.recorded_by_firstname ? `${tx.recorded_by_firstname} ${tx.recorded_by_lastname}` : tx.recorded_by_username}
                                                        </small>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge bg-light text-dark border">
                                                {t(`transactionTypes.${tx.transaction_type}`)}
                                            </span>
                                        </td>
                                        <td className="text-end fw-bold">
                                            <span className={tx.transaction_type === 'EXPENSE' ? 'text-danger' : 'text-success'}>
                                                {Number(tx.amount).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="small">{tx.payment_method_name}</td>
                                        <td>
                                            <span className={`status-badge status-${tx.status.toLowerCase()}`}>
                                                {t(`transactionStatus.${tx.status}`)}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center">
                                                {tx.approvals?.map((app, i) => (
                                                    <div key={app.id} className="rounded-circle bg-info text-white d-flex align-items-center justify-content-center border border-white position-relative shadow-sm"
                                                        style={{ width: '28px', height: '28px', marginLeft: i > 0 ? '-8px' : '0', zIndex: 10 - i, cursor: 'help' }}
                                                        title={`Approuvé par ${app.approved_by_username} le ${new Date(app.approved_at).toLocaleDateString()}`}>
                                                        <span style={{ fontSize: '0.7rem' }}>{app.approved_by_username?.substring(0, 2).toUpperCase()}</span>
                                                    </div>
                                                ))}
                                                {(!tx.approvals || tx.approvals.length === 0) && <span className="text-muted small">-</span>}
                                            </div>
                                        </td>
                                        <td className="text-end pe-3">
                                            <button
                                                className="btn btn-sm btn-outline-success"
                                                onClick={() => handleApprove([tx.id])}
                                                disabled={approving}
                                                title="Valider cette transaction"
                                            >
                                                <i className="bi bi-check-lg"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={showConfirmBatch} onClose={() => setShowConfirmBatch(false)} title="Confirmer la validation">
                <div className="p-3">
                    <p>Vous êtes sur le point de valider <strong>{selectedIds.size}</strong> transaction(s).</p>
                    <p className="text-muted small">Ceci enregistrera votre approbation pour ces transactions.</p>
                    <div className="d-flex justify-content-end gap-2 mt-4">
                        <button className="btn btn-light" onClick={() => setShowConfirmBatch(false)}>Annuler</button>
                        <button className="btn btn-primary" onClick={() => handleApprove(Array.from(selectedIds))}>
                            Confirmer la validation
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
