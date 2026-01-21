import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './Transactions.css'
import { listTransactions, type Transaction, listPaymentMethods, type PaymentMethod, deleteTransaction, submitTransaction } from '../../services/transactions'
import { getCurrentUser, type User } from '../../services/users'
import Modal from '../common/Modal'
import AddTransaction from './add/AddTransaction'
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
                <div className="card-body p-4">
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

            <div className="d-block d-md-none">
                {loading ? (
                    <div className="text-center py-5 text-muted">{t('transactions.home.loading')}</div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-5 text-muted">{t('transactions.home.empty')}</div>
                ) : filteredItems.map(tx => {
                    const isExpense = tx.transaction_type === 'EXPENSE';
                    const isTreasury = !!currentUser?.roles?.some(r => (r.role || '').toLowerCase() === 'treasury');
                    const isCreatedByMe = Number(tx.recorded_by_id) === Number(currentUser?.id);
                    let canEdit = false;
                    if (isTreasury) { canEdit = !!isCreatedByMe && (tx.status === 'SAVED' || tx.status === 'PENDING'); } else { canEdit = tx.status === 'SAVED'; }
                    let canDelete = false;
                    if (isTreasury) { canDelete = !!isCreatedByMe && (tx.status === 'SAVED' || tx.status === 'PENDING'); } else { canDelete = tx.status === 'SAVED'; }

                    return (
                        <div key={tx.id} className="card border-0 shadow-sm mb-3 rounded-4">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className={`badge rounded-pill fw-normal text-uppercase px-3 py-2 ${tx.status === 'VALIDATED' ? 'bg-success-subtle text-success' : tx.status === 'PENDING' ? 'bg-warning-subtle text-warning' : 'bg-secondary-subtle text-secondary'}`} style={{ fontSize: '0.7rem' }}>
                                        {t(`transactionStatus.${tx.status}`)}
                                    </span>
                                    <small className="text-muted">{new Date(tx.created_at).toLocaleDateString()}</small>
                                </div>
                                <div className="d-flex align-items-center mb-3">
                                    {tx.user_image_url ? (
                                        <img src={tx.user_image_url} alt="" className="rounded-circle me-3" style={{ width: 40, height: 40, objectFit: 'cover' }} />
                                    ) : (
                                        <div className="d-flex align-items-center justify-content-center rounded-circle bg-light me-3" style={{ width: 40, height: 40 }}>
                                            <span className="fw-bold text-secondary">
                                                {tx.user_firstname ? tx.user_firstname[0] : tx.user_username?.[0]}
                                            </span>
                                        </div>
                                    )}
                                    <div>
                                        <div className="fw-bold text-dark">{tx.user_firstname} {tx.user_lastname}</div>
                                        <div className="small text-muted text-uppercase">{t(`transactionTypes.${tx.transaction_type}`)}</div>
                                    </div>
                                </div>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <span className="text-muted small">{t('transactions.home.thAmount')}</span>
                                    <span className={`fw-bold ${!isExpense ? 'text-success' : 'text-danger'}`}>
                                        {Number(tx.amount).toLocaleString()}
                                    </span>
                                </div>
                                <div className="d-flex justify-content-end gap-3 border-top pt-3">
                                    {canEdit && (
                                        <button className="btn btn-sm btn-outline-primary" onClick={() => setShowEditId(tx.id)}>
                                            <i className="bi bi-pencil-square me-1"></i> {t('transactions.home.edit')}
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button className="btn btn-sm btn-outline-danger" onClick={async () => {
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
                                            } catch (e) { console.error(e) }
                                        }}>
                                            <i className="bi bi-trash me-1"></i> {t('transactions.home.delete')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="table-responsive d-none d-md-block">
                <table className="table table-hover align-middle border-light shadow-sm bg-white rounded-3 overflow-hidden" style={{ borderCollapse: 'separate', borderSpacing: '0' }}>
                    <thead className="bg-light text-uppercase small fw-bold text-muted">
                        <tr>
                            {currentUser?.roles?.some(r => r.role === 'admin') && <th className="py-3 ps-4 border-bottom-0">ID</th>}
                            <th className="py-3 border-bottom-0">{t('transactions.home.thAmount')}</th>
                            <th className="py-3 border-bottom-0">{t('transactions.home.thType')}</th>
                            <th className="py-3 border-bottom-0">{t('transactions.home.thUser')}</th>
                            <th className="py-3 border-bottom-0">{t('transactions.home.thPayment')}</th>
                            <th className="py-3 border-bottom-0">{t('transactions.home.thStatus')}</th>
                            <th className="py-3 border-bottom-0">Validations</th>
                            <th className="py-3 border-bottom-0">{t('transactions.home.thCreated')}</th>
                            <th className="py-3 pe-4 text-end border-bottom-0"></th>
                        </tr>
                    </thead>
                    <tbody className="border-top-0">
                        {loading ? (
                            <tr><td colSpan={9} className="text-center py-5 text-muted">{t('transactions.home.loading')}</td></tr>
                        ) : filteredItems.length === 0 ? (
                            <tr><td colSpan={9} className="text-center py-5 text-muted">{t('transactions.home.empty')}</td></tr>
                        ) : filteredItems.map(tx => {
                            const isExpense = tx.transaction_type === 'EXPENSE';
                            const approvals = tx.approvals || [];
                            console.log('Current User:', currentUser);
                            const isTreasury = !!currentUser?.roles?.some(r => (r.role || '').toLowerCase() === 'treasury');
                            const isCreatedByMe = Number(tx.recorded_by_id) === Number(currentUser?.id);

                            console.log('isTreasury and isCreatedByMe:', isCreatedByMe, 'tx.status:', tx.status);
                            console.log('user: ', isTreasury);
                            // User Display
                            const userInitials = tx.user_firstname && tx.user_lastname
                                ? `${tx.user_firstname[0]}${tx.user_lastname[0]}`.toUpperCase()
                                : tx.user_username?.substring(0, 2).toUpperCase();
                            const userName = tx.user_firstname && tx.user_lastname
                                ? `${tx.user_firstname} ${tx.user_lastname}`
                                : tx.user_username;

                            // Recorded By Display
                            let recordedByText = '';
                            if (tx.recorded_by_id === currentUser?.id) {
                                recordedByText = 'Par moi';
                            } else {
                                recordedByText = (tx.recorded_by_firstname && tx.recorded_by_lastname)
                                    ? `Par ${tx.recorded_by_firstname} ${tx.recorded_by_lastname}`
                                    : `Par ${tx.recorded_by_username}`;
                            }

                            // Modification Logic:
                            // - Treasury: can edit only own transactions when status is SAVED or PENDING
                            // - Others: unchanged (can edit when status is SAVED)
                            let canEdit = false;
                            if (isTreasury) {
                                canEdit = !!isCreatedByMe && (tx.status === 'SAVED' || tx.status === 'PENDING');
                            } else {
                                canEdit = tx.status === 'SAVED';
                            }

                            // Deletion Logic:
                            // - Treasury: can delete only own transactions when status is SAVED or PENDING
                            // - Others: only when status is SAVED (unchanged)
                            let canDelete = false;
                            if (isTreasury) {
                                console.log('isTreasury and isCreatedByMe:', isCreatedByMe, 'tx.status:', tx.status);
                                canDelete = !!isCreatedByMe && (tx.status === 'SAVED' || tx.status === 'PENDING');
                            } else {
                                canDelete = tx.status === 'SAVED';
                            }

                            return (
                                <tr key={tx.id} className="">
                                    {currentUser?.roles?.some(r => r.role === 'admin') && <td className="ps-4 fw-bold text-secondary">#{tx.id}</td>}
                                    <td>
                                        <span className={`fw-bold fs-6 ${!isExpense ? 'text-success' : 'text-danger'}`}>
                                            {Number(tx.amount).toLocaleString()}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge rounded-pill bg-light text-dark border`}>
                                            {t(`transactionTypes.${tx.transaction_type}`)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="d-flex align-items-center">
                                            {tx.user_image_url ? (
                                                <img src={tx.user_image_url} alt="" className="rounded-circle me-2" style={{ width: '32px', height: '32px', objectFit: 'cover' }} />
                                            ) : (
                                                <div className="avatar px-2 py-1 rounded-circle bg-secondary text-white me-2 small d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                                                    {userInitials}
                                                </div>
                                            )}
                                            <div style={{ lineHeight: '1.2' }}>
                                                <div className="fw-bold text-dark" style={{ fontSize: '0.9rem' }}>{userName}</div>
                                                <small className="text-muted" style={{ fontSize: '0.75rem' }}>{recordedByText}</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="text-muted small">{tx.payment_method_name}</td>
                                    <td>
                                        <span className={`badge status-${tx.status.toLowerCase()} text-uppercase px-2 py-1`} style={{ fontSize: '0.7rem' }}>
                                            {t(`transactionStatus.${tx.status}`)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="d-flex align-items-center">
                                            {approvals.map((app, i) => (
                                                <div key={app.id} className="rounded-circle bg-info text-white d-flex align-items-center justify-content-center border border-white position-relative shadow-sm"
                                                    style={{ width: '32px', height: '32px', marginLeft: i > 0 ? '-10px' : '0', zIndex: 10 - i, cursor: 'help' }}
                                                    title={`Approuvé par ${app.approved_by_username} (${app.role_at_approval})`}>
                                                    <span style={{ fontSize: '0.75rem' }}>{app.approved_by_username?.substring(0, 2).toUpperCase()}</span>
                                                    {['treasury'].includes((app.role_at_approval || '').toLowerCase()) && (
                                                        <span className="position-absolute top-0 start-100 translate-middle badge rounded-circle bg-warning p-1 border border-light" style={{ width: '10px', height: '10px' }}>
                                                            <span className="visually-hidden">Treasury</span>
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                            {approvals.length === 0 && <span className="text-muted small fst-italic">-</span>}
                                            {tx.status === 'VALIDATED' && <i className="bi bi-check-circle-fill text-success ms-2 fs-5" title="Validée"></i>}
                                        </div>
                                    </td>
                                    <td className="text-muted small">
                                        {new Date(tx.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="text-end pe-4">
                                        {canEdit && (
                                            <button
                                                className="btn btn-sm btn-link text-primary p-0 me-3"
                                                onClick={async () => {
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
                                                        alert('Échec de l\'envoi')
                                                    }
                                                }}
                                                title="Envoyer"
                                            >
                                                <i className="bi bi-send fs-5"></i>
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-sm btn-link text-secondary p-0 me-3"
                                            onClick={() => setShowEditId(tx.id)}
                                            disabled={!canEdit}
                                            title={canEdit ? t('transactions.home.edit') : t('transactions.home.onlyPendingOrSaved')}
                                        >
                                            <i className="bi bi-pencil-square fs-5"></i>
                                        </button>
                                        <button
                                            className="btn btn-sm btn-link text-danger p-0"
                                            onClick={async () => {
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
                                                    alert(t('transactions.home.deleteFailed') || 'Suppression échouée')
                                                }
                                            }}
                                            disabled={!canDelete}
                                            title={canDelete ? t('transactions.home.delete') : t('transactions.home.onlyPendingOrSaved')}
                                        >
                                            <i className="bi bi-trash fs-5"></i>
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

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
