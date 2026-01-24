import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './Transactions.css'
import { listTransactions, type Transaction, listPaymentMethods, type PaymentMethod, deleteTransaction, submitTransaction } from '../../services/transactions'
import { getCurrentUser, type User } from '../../services/users'
import Modal from '../common/Modal'
import AddTransaction from './add/AddTransaction'
import TransactionCard from './TransactionCard'
import UpdateTransaction from './update/UpdateTransaction'
import { useTranslation } from 'react-i18next'
import { transactionStatusOptions, transactionTypeOptions } from '../../constants/transactionOptions'

type TxStatus = 'SAVED' | 'PENDING' | 'PARTIALLY_APPROVED' | 'VALIDATED' | 'REJECTED'
type TxType = 'CONTRIBUTION' | 'DONATIONS' | 'EXPENSE'

export default function Transactions() {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<Transaction[]>([])
    const [methods, setMethods] = useState<PaymentMethod[]>([])
    const [currentUser, setCurrentUser] = useState<User | null>(null)

    // Filters
    const [status, setStatus] = useState<TxStatus | ''>('')
    const [transactionType, setTransactionType] = useState<TxType | ''>('')
    const [paymentMethodId, setPaymentMethodId] = useState<number | ''>('')
    const [dateFrom, setDateFrom] = useState<string>('')
    const [dateTo, setDateTo] = useState<string>('')
    const [search, setSearch] = useState('')

    // Modals
    const [showAdd, setShowAdd] = useState(false)
    const [showEditId, setShowEditId] = useState<number | null>(null)

    const filteredItems = items.filter(t => {
        if (!search) return true
        const s = search.toLowerCase()
        return (
            t.id.toString().includes(s) ||
            t.amount.toString().includes(s) ||
            (t.user_firstname && t.user_firstname.toLowerCase().includes(s)) ||
            (t.user_lastname && t.user_lastname.toLowerCase().includes(s)) ||
            (t.recorded_by_firstname && t.recorded_by_firstname.toLowerCase().includes(s)) ||
            (t.payment_method_name && t.payment_method_name.toLowerCase().includes(s))
        )
    })

    const resetFilters = () => {
        setStatus('')
        setTransactionType('')
        setPaymentMethodId('')
        setDateFrom('')
        setDateTo('')
        setSearch('')
    }

    useEffect(() => {
        let mounted = true
        async function fetchAll() {
            setLoading(true)
            try {
                const [txs, pms, user] = await Promise.all([
                    listTransactions({
                        status: status || undefined,
                        payment_methods_id: typeof paymentMethodId === 'number' ? paymentMethodId : undefined,
                        transaction_type: transactionType || undefined,
                        date_from: dateFrom || undefined,
                        date_to: dateTo || undefined,
                    }),
                    listPaymentMethods({ active: true }),
                    getCurrentUser(),
                ])
                if (mounted) { setItems(txs); setMethods(pms); setCurrentUser(user); }
            } catch (e) {
                console.error('Failed to load transactions:', e)
            } finally {
                setLoading(false)
            }
        }
        fetchAll()
        return () => { mounted = false }
    }, [status, paymentMethodId, transactionType, dateFrom, dateTo])

    // Open modals from query params (e.g. /transactions?openAdd=1 or /transactions?editId=123)
    const location = useLocation()
    const navigate = useNavigate()
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        if (params.get('openAdd')) {
            setShowAdd(true)
        }
        const edit = params.get('editId')
        if (edit) {
            const id = Number(edit)
            if (!Number.isNaN(id)) setShowEditId(id)
        }
    }, [location.search])

    return (
        <div className="container py-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center gap-2">
                    <Link to="/caisse" className="btn btn-sm btn-outline-secondary">
                        <i className="bi bi-arrow-left me-1"></i> Caisse
                    </Link>
                    <h2 className="h5 mb-0">{t('transactions.home.title')}</h2>
                </div>
                <button className="btn btn-primary" onClick={() => setShowAdd(true)}>{t('transactions.home.new')}</button>
            </div>

            <div className="card mb-4 border-0 shadow-sm filter-card">
                <div className="card-body px-1 py-3 p-md-4">
                    <div className="row g-3 align-items-end">
                        <div className="col-12 col-md-4 col-lg-2">
                            <label className="form-label small text-muted fw-bold">{t('transactions.home.status')}</label>
                            <select className="form-select form-select-sm bg-light border-0" value={status} onChange={e => setStatus(e.target.value as any)}>
                                <option value="">{t('transactions.home.all')}</option>
                                {transactionStatusOptions().map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12 col-md-4 col-lg-2">
                            <label className="form-label small text-muted fw-bold">{t('transactions.home.type')}</label>
                            <select className="form-select form-select-sm bg-light border-0" value={transactionType} onChange={e => setTransactionType(e.target.value as any)}>
                                <option value="">{t('transactions.home.all')}</option>
                                {transactionTypeOptions().map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12 col-md-4 col-lg-3">
                            <label className="form-label small text-muted fw-bold">{t('transactions.home.paymentMethod')}</label>
                            <select className="form-select form-select-sm bg-light border-0" value={paymentMethodId} onChange={e => {
                                const v = e.target.value
                                setPaymentMethodId(v ? Number(v) : '')
                            }}>
                                <option value="">{t('transactions.home.all')}</option>
                                {methods.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-6 col-md-6 col-lg-2">
                            <label className="form-label small text-muted fw-bold">{t('transactions.home.from')}</label>
                            <input type="date" className="form-control form-control-sm bg-light border-0" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                        </div>
                        <div className="col-6 col-md-6 col-lg-2">
                            <label className="form-label small text-muted fw-bold">{t('transactions.home.to')}</label>
                            <input type="date" className="form-control form-control-sm bg-light border-0" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                        </div>
                        <div className="col-12 col-lg-1 d-flex justify-content-end">
                            <button className="btn btn-sm btn-outline-secondary w-100" onClick={resetFilters} title={t('transactions.home.resetFilters')}>
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                        <div className="col-12 mt-3">
                            <input
                                type="text"
                                className="form-control bg-light border-0"
                                placeholder={t('transactions.home.searchPlaceholder')}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>


            {loading ? (
                <div className="text-center py-5 text-muted">{t('transactions.home.loading')}</div>
            ) : filteredItems.length === 0 ? (
                <div className="text-center py-5 text-muted">{t('transactions.home.empty')}</div>
            ) : (
                <div className="row g-3">
                    {filteredItems.map(tx => {
                        const isTreasury = !!currentUser?.roles?.some(r => (r.role || '').toLowerCase() === 'treasury')
                        const isCreatedByMe = Number(tx.recorded_by_id) === Number(currentUser?.id)

                        let canEdit = false;
                        if (isTreasury) {
                            canEdit = !!isCreatedByMe && (tx.status === 'SAVED' || tx.status === 'PENDING');
                        } else {
                            canEdit = tx.status === 'SAVED';
                        }

                        let canDelete = false;
                        if (isTreasury) {
                            canDelete = !!isCreatedByMe && (tx.status === 'SAVED' || tx.status === 'PENDING');
                        } else {
                            canDelete = tx.status === 'SAVED';
                        }

                        const canSubmit = canEdit && tx.status === 'SAVED'

                        return (
                            <div key={tx.id} className="col-12 col-md-6">
                                <TransactionCard
                                    transaction={tx}
                                    currentUser={currentUser}
                                    canEdit={canEdit}
                                    canDelete={canDelete}
                                    canSubmit={canSubmit}
                                    onEdit={() => setShowEditId(tx.id)}
                                    onSubmit={async () => {
                                        try {
                                            await submitTransaction(tx.id)
                                            const txs = await listTransactions({
                                                status: status || undefined,
                                                payment_methods_id: typeof paymentMethodId === 'number' ? paymentMethodId : undefined,
                                                transaction_type: transactionType || undefined,
                                                date_from: dateFrom || undefined,
                                                date_to: dateTo || undefined,
                                            })
                                            setItems(txs)
                                        } catch (e) {
                                            console.error('Submit failed', e)
                                            toast.error('Echec de l\'envoi')
                                        }
                                    }}
                                    onDelete={async () => {
                                        const ok = window.confirm(t('transactions.home.confirmDelete') || 'Confirmer la suppression ?')
                                        if (!ok) return
                                        try {
                                            await deleteTransaction(tx.id)
                                            const txs = await listTransactions({
                                                status: status || undefined,
                                                payment_methods_id: typeof paymentMethodId === 'number' ? paymentMethodId : undefined,
                                                transaction_type: transactionType || undefined,
                                                date_from: dateFrom || undefined,
                                                date_to: dateTo || undefined,
                                            })
                                            setItems(txs)
                                        } catch (e) {
                                            console.error('Delete failed', e)
                                            toast.error(t('transactions.home.deleteFailed') || 'Suppression échouée')
                                        }
                                    }}
                                />
                            </div>
                        )
                    })}
                </div>
            )}

            <Modal isOpen={showAdd} onClose={() => { setShowAdd(false); navigate('/transactions', { replace: true }) }} title={t('transactions.home.addTitle')} size="lg">
                <AddTransaction
                    onSuccess={() => {
                        setShowAdd(false)
                        navigate('/transactions', { replace: true })
                            // refresh list
                            ; (async () => {
                                try {
                                    const txs = await listTransactions({
                                        status: status || undefined,
                                        payment_methods_id: typeof paymentMethodId === 'number' ? paymentMethodId : undefined,
                                        transaction_type: transactionType || undefined,
                                        date_from: dateFrom || undefined,
                                        date_to: dateTo || undefined,
                                    })
                                    setItems(txs)
                                } catch { }
                            })()
                    }}
                    onCancel={() => { setShowAdd(false); navigate('/transactions', { replace: true }) }}
                />
            </Modal>

            <Modal isOpen={showEditId !== null} onClose={() => { setShowEditId(null); navigate('/transactions', { replace: true }) }} title={t('transactions.home.updateTitle')} size="lg">
                {showEditId !== null && (
                    <UpdateTransaction
                        id={showEditId}
                        onSuccess={() => {
                            setShowEditId(null)
                            navigate('/transactions', { replace: true })
                                ; (async () => {
                                    try {
                                        const txs = await listTransactions({
                                            status: status || undefined,
                                            payment_methods_id: typeof paymentMethodId === 'number' ? paymentMethodId : undefined,
                                            transaction_type: transactionType || undefined,
                                            date_from: dateFrom || undefined,
                                            date_to: dateTo || undefined,
                                        })
                                        setItems(txs)
                                    } catch { }
                                })()
                        }}
                        onCancel={() => { setShowEditId(null); navigate('/transactions', { replace: true }) }}
                    />
                )}
            </Modal>
        </div>
    )
}
