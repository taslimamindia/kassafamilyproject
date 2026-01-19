import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getTransaction, updateTransactionStatus, type Transaction } from '../../../services/transactions'
import { useTranslation } from 'react-i18next'

export default function UpdateTransaction({ id: propId, onSuccess, onCancel }: { id?: number; onSuccess?: () => void; onCancel?: () => void }) {
    const { id } = useParams()
    const txId = typeof propId === 'number' ? propId : Number(id)
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [tx, setTx] = useState<Transaction | null>(null)
    const [status, setStatus] = useState<Transaction['status']>('PENDING')
    const { t } = useTranslation()

    useEffect(() => {
        let mounted = true
        async function loadTx() {
            try {
                const t = await getTransaction(txId)
                if (mounted) {
                    setTx(t)
                    setStatus(t.status)
                }
            } catch (e) {
                console.error('Failed to fetch transaction', e)
                toast.error('Transaction not found')
            }
        }
        loadTx()
        return () => { mounted = false }
    }, [txId])

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        try {
            await updateTransactionStatus(txId, status)
            toast.success('Transaction updated')
            if (onSuccess) {
                onSuccess()
            } else {
                navigate('/transactions')
            }
        } catch (e: any) {
            console.error(e)
            toast.error(e?.body?.detail || 'Failed to update')
        } finally {
            setLoading(false)
        }
    }

    if (!tx) return <div className="container py-3">{t('transactions.home.loading')}</div>

    function getMagnitudeLabel(n: number): string {
        if (!isFinite(n) || n <= 0) return ''
        if (n >= 1_000_000_000) return 'Milliards'
        if (n >= 1_000_000) return 'Millions'
        if (n >= 1_000) return 'Milles'
        if (n >= 100) return 'Cents'
        return 'Unités'
    }

    const magnitude = getMagnitudeLabel(tx.amount)

    return (
        <div className="container py-3">
            <h2 className="h5 mb-3">{t('transactions.update.title')}</h2>
            <form className="card" onSubmit={onSubmit}>
                <div className="card-body">
                    {tx.status !== 'PENDING' && (
                        <div className="alert alert-warning" role="alert">
                            {t('transactions.update.onlyPending')}
                        </div>
                    )}
                    <div className="row g-3">
                        <div className="col-md-3">
                            <label className="form-label">{t('transactions.update.status')}</label>
                            <select className="form-select" value={status} onChange={e => setStatus(e.target.value as any)} disabled={tx.status !== 'PENDING'}>
                                <option value="PENDING">{t('transactionStatus.PENDING')}</option>
                                <option value="PARTIALLY_APPROVED">{t('transactionStatus.PARTIALLY_APPROVED')}</option>
                                <option value="VALIDATED">{t('transactionStatus.VALIDATED')}</option>
                                <option value="REJECTED">{t('transactionStatus.REJECTED')}</option>
                            </select>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">{t('transactions.update.amount')}</label>
                            <input className="form-control" value={tx.amount} disabled />
                            <div className="form-text">{t('transactions.update.currency', 'Devise: Franc Guinéen (GNF)')}</div>
                            <div className="small text-muted mt-1">{t('transactions.update.magnitude', 'Rang:')} {magnitude}</div>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">{t('transactions.update.type')}</label>
                            <input className="form-control" value={t(`transactionTypes.${tx.transaction_type}`)} disabled />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label">{t('transactions.update.member')}</label>
                            <input className="form-control" value={tx.user_username || tx.users_id} disabled />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label">{t('transactions.update.paymentMethod')}</label>
                            <input className="form-control" value={tx.payment_method_name || tx.payment_methods_id} disabled />
                        </div>
                    </div>
                </div>
                <div className="card-footer d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => onCancel ? onCancel() : navigate('/transactions')}>{t('transactions.update.cancel')}</button>
                    <button type="submit" className="btn btn-primary" disabled={loading || tx.status !== 'PENDING'}>{t('transactions.update.save')}</button>
                </div>
            </form>
        </div>
    )
}
