import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { createPaymentMethod, listPaymentMethods, updatePaymentMethod, type PaymentMethod } from '../../../services/transactions'

export default function PaymentMethodsTab() {
    const { t } = useTranslation()
    const [name, setName] = useState<string>('')
    const [isactive, setIsActive] = useState<boolean>(true)
    const [loading, setLoading] = useState<boolean>(false)
    const [listLoading, setListLoading] = useState<boolean>(false)
    const [methods, setMethods] = useState<PaymentMethod[]>([])
    const [accountNumber, setAccountNumber] = useState<string>('')
    // Pour l'édition
    const [editId, setEditId] = useState<number | null>(null)
    const [editName, setEditName] = useState<string>('')
    const [editAccount, setEditAccount] = useState<string>('')
    const [editLoading, setEditLoading] = useState<boolean>(false)

    async function loadMethods() {
        setListLoading(true)
        try {
            const data = await listPaymentMethods()
            setMethods(data)
        } catch (err) {
            toast.error(t('admin.transactions.pm.listFailed', 'Failed to load payment methods'))
        } finally {
            setListLoading(false)
        }
    }

    useEffect(() => { loadMethods() }, [])

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name) {
            toast.error(t('admin.transactions.pm.requiredName', 'Please select a payment method name'))
            return
        }
        setLoading(true)
        try {
            await createPaymentMethod({ name, isactive: isactive ? 1 : 0, type_of_proof: 'BOTH', account_number: accountNumber })
            toast.success(t('admin.transactions.pm.created', 'Payment method created'))
            setName('')
            setIsActive(true)
            setAccountNumber('')
            await loadMethods()
        } catch (err: any) {
            const msg = err?.body?.detail || err?.message || t('admin.transactions.pm.createFailed', 'Failed to create payment method')
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }

    async function toggleActive(pm: PaymentMethod) {
        const newVal = pm.isactive === 1 ? 0 : 1
        try {
            await updatePaymentMethod(pm.id, { isactive: newVal, account_number: pm.account_number || '' })
            toast.success(t('admin.transactions.pm.updated', 'Updated'))
            await loadMethods()
        } catch (err: any) {
            const msg = err?.body?.detail || err?.message || t('admin.transactions.pm.updateFailed', 'Failed to update')
            toast.error(msg)
        }
    }

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h5 className="card-title mb-0">{t('admin.transactions.pm.title', 'Add Payment Method')}</h5>
                </div>
                <form onSubmit={onSubmit}>
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label">{t('admin.transactions.pm.name', 'Payment Method')}</label>
                                <input
                                    list="pm-name-list"
                                    type="text"
                                    className="form-control"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder={t('admin.transactions.pm.typeName', 'Type a method name')}
                                />
                                <datalist id="pm-name-list">
                                    {methods.map(pm => (
                                        <option key={pm.id} value={pm.name} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label">{t('admin.transactions.pm.typeOfProof', 'Type of Proof')}</label>
                                <input type="text" className="form-control" value={t('admin.transactions.pm.proofBoth', 'Both (number or link)')} disabled />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label">{t('admin.transactions.pm.accountNumber', 'Account Number')}</label>
                                <input type="text" className="form-control" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                            </div>
                            <div className="col-md-3 d-flex align-items-end">
                                <div className="form-check">
                                    <input className="form-check-input" type="checkbox" id="pm-active" checked={isactive} onChange={e => setIsActive(e.target.checked)} />
                                    <label className="form-check-label" htmlFor="pm-active">{t('admin.transactions.pm.active', 'Active')}</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="card-footer d-flex justify-content-end">
                        <button type="submit" className="btn btn-primary" disabled={loading}>{t('admin.transactions.pm.create', 'Create')}</button>
                    </div>
                </form>
            </div>

            <div className="card mt-3">
                <div className="card-header d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">{t('admin.transactions.pm.listTitle', 'Existing Payment Methods')}</h6>
                    <button className="btn btn-sm btn-outline-secondary" onClick={loadMethods} disabled={listLoading}>
                        {t('admin.transactions.pm.refresh', 'Refresh')}
                    </button>
                </div>
                <div className="table-responsive">
                    <table className="table table-striped mb-0">
                        <thead>
                            <tr>
                                <th>{t('admin.transactions.pm.colName', 'Name')}</th>
                                <th style={{ width: '180px' }}>{t('admin.transactions.pm.colTypeOfProof', 'Type of Proof')}</th>
                                <th style={{ width: '180px' }}>{t('admin.transactions.pm.colAccountNumber', 'Account Number')}</th>
                                <th style={{ width: '120px' }}>{t('admin.transactions.pm.colActive', 'Active')}</th>
                                <th style={{ width: '200px' }}>{t('admin.transactions.pm.colUpdated', 'Updated')}</th>
                                <th style={{ width: '180px' }}>{t('admin.transactions.pm.colActions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {methods.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center text-muted py-3">
                                        {listLoading ? t('admin.transactions.pm.loading', 'Loading...') : t('admin.transactions.pm.empty', 'No payment methods')}
                                    </td>
                                </tr>
                            ) : methods.map(pm => (
                                <tr key={pm.id}>
                                    {/* Affichage ou édition inline */}
                                    {editId === pm.id ? (
                                        <>
                                            <td>
                                                <input type="text" className="form-control form-control-sm" value={editName} onChange={e => setEditName(e.target.value)} />
                                            </td>
                                            <td>
                                                <select
                                                    className="form-select form-select-sm"
                                                    value={(pm.type_of_proof as any) || 'BOTH'}
                                                    onChange={async e => {
                                                        try {
                                                            await updatePaymentMethod(pm.id, { type_of_proof: e.target.value as any, account_number: editId === pm.id ? editAccount : pm.account_number || '' })
                                                            toast.success(t('admin.transactions.pm.updated', 'Updated'))
                                                            await loadMethods()
                                                        } catch (err: any) {
                                                            const msg = err?.body?.detail || err?.message || t('admin.transactions.pm.updateFailed', 'Failed to update')
                                                            toast.error(msg)
                                                        }
                                                    }}>
                                                    <option value="TRANSACTIONNUMBER">{t('admin.transactions.pm.proofTransactionNumber', 'Transaction Number')}</option>
                                                    <option value="LINK">{t('admin.transactions.pm.proofLink', 'Link (image)')}</option>
                                                    <option value="BOTH">{t('admin.transactions.pm.proofBoth', 'Both (number or link)')}</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input type="text" className="form-control form-control-sm" value={editAccount} onChange={e => setEditAccount(e.target.value)} />
                                            </td>
                                            <td>
                                                {pm.isactive === 1 ? (
                                                    <span className="badge bg-success">{t('admin.transactions.pm.active', 'Active')}</span>
                                                ) : (
                                                    <span className="badge bg-secondary">{t('admin.transactions.pm.inactive', 'Inactive')}</span>
                                                )}
                                            </td>
                                            <td>{pm.updated_at ? new Date(pm.updated_at).toLocaleString() : ''}</td>
                                            <td>
                                                <button className="btn btn-sm btn-success me-1" disabled={editLoading} onClick={async () => {
                                                    setEditLoading(true)
                                                    try {
                                                        await updatePaymentMethod(pm.id, { name: editName, account_number: editAccount })
                                                        toast.success(t('admin.transactions.pm.updated', 'Updated'))
                                                        setEditId(null)
                                                        await loadMethods()
                                                    } catch (err: any) {
                                                        const msg = err?.body?.detail || err?.message || t('admin.transactions.pm.updateFailed', 'Failed to update')
                                                        toast.error(msg)
                                                    } finally {
                                                        setEditLoading(false)
                                                    }
                                                }}>
                                                    {t('admin.transactions.pm.save', 'Save')}
                                                </button>
                                                <button className="btn btn-sm btn-secondary" onClick={() => setEditId(null)}>{t('admin.transactions.pm.cancel', 'Cancel')}</button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td>{pm.name}</td>
                                            <td>
                                                <select
                                                    className="form-select form-select-sm"
                                                    value={(pm.type_of_proof as any) || 'BOTH'}
                                                    onChange={async e => {
                                                        try {
                                                            await updatePaymentMethod(pm.id, { type_of_proof: e.target.value as any, account_number: pm.account_number || '' })
                                                            toast.success(t('admin.transactions.pm.updated', 'Updated'))
                                                            await loadMethods()
                                                        } catch (err: any) {
                                                            const msg = err?.body?.detail || err?.message || t('admin.transactions.pm.updateFailed', 'Failed to update')
                                                            toast.error(msg)
                                                        }
                                                    }}>
                                                    <option value="TRANSACTIONNUMBER">{t('admin.transactions.pm.proofTransactionNumber', 'Transaction Number')}</option>
                                                    <option value="LINK">{t('admin.transactions.pm.proofLink', 'Link (image)')}</option>
                                                    <option value="BOTH">{t('admin.transactions.pm.proofBoth', 'Both (number or link)')}</option>
                                                </select>
                                            </td>
                                            <td>{pm.account_number || ''}</td>
                                            <td>
                                                {pm.isactive === 1 ? (
                                                    <span className="badge bg-success">{t('admin.transactions.pm.active', 'Active')}</span>
                                                ) : (
                                                    <span className="badge bg-secondary">{t('admin.transactions.pm.inactive', 'Inactive')}</span>
                                                )}
                                            </td>
                                            <td>{pm.updated_at ? new Date(pm.updated_at).toLocaleString() : ''}</td>
                                            <td>
                                                <button className="btn btn-sm btn-outline-primary me-1" onClick={() => {
                                                    setEditId(pm.id)
                                                    setEditName(pm.name)
                                                    setEditAccount(pm.account_number || '')
                                                }}>
                                                    {t('admin.transactions.pm.edit', 'Edit')}
                                                </button>
                                                <button className="btn btn-sm btn-outline-primary" onClick={() => toggleActive(pm)} disabled={listLoading}>
                                                    {pm.isactive === 1 ? t('admin.transactions.pm.deactivate', 'Deactivate') : t('admin.transactions.pm.activate', 'Activate')}
                                                </button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    )
}
