import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
    getTransaction,
    updateTransaction,
    listPaymentMethods,
    uploadTransactionProof,
    setTransactionProof,
    submitTransaction,
    type Transaction,
    type PaymentMethod,
} from '../../../services/transactions'
import { useTranslation } from 'react-i18next'
import { getCurrentUser, type User } from '../../../services/users'
import { getRolesForUser } from '../../../services/roleAttributions'
import { paymentMethodOptions, transactionKindOptions, mapKindToBackend, type TransactionKind } from '../../../constants/transactionOptions'

export default function UpdateTransaction({ id: propId, onSuccess, onCancel }: { id?: number; onSuccess?: () => void; onCancel?: () => void }) {
    const { id } = useParams()
    const txId = typeof propId === 'number' ? propId : Number(id)
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [initializing, setInitializing] = useState(true)
    const [tx, setTx] = useState<Transaction | null>(null)
    const { t, i18n } = useTranslation()

    // Refs and current user
    const [me, setMe] = useState<User | null>(null)
    const [methods, setMethods] = useState<PaymentMethod[]>([])

    // Editable fields (mirror AddTransaction, without member select)
    const [amount, setAmount] = useState<string>('')
    const [kind, setKind] = useState<TransactionKind>('COTISATION')
    const [payment_methods_id, setPaymentMethodId] = useState<number | ''>('')
    const [proof_reference, setProofReference] = useState<string>('')
    const [proof_file, setProofFile] = useState<File | null>(null)
    const [proofType, setProofType] = useState<'TRANSACTIONNUMBER' | 'LINK'>('TRANSACTIONNUMBER')
    const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true
        async function loadAll() {
            try {
                const [current, t] = await Promise.all([
                    getCurrentUser(),
                    getTransaction(txId),
                ])
                const roles = await getRolesForUser(current.id)
                const pms = await listPaymentMethods({ active: true })
                if (!mounted) return
                setMe({ ...current, roles: roles as any })
                setMethods(pms)
                setTx(t)
                // Initialize editable fields from existing tx
                setAmount(String(t.amount))
                setPaymentMethodId(t.payment_methods_id)
                setProofReference(t.proof_reference || '')
                // Map backend type to UI kind
                const backendType = (t.transaction_type || '').toUpperCase()
                const uiKind: TransactionKind = backendType === 'EXPENSE' ? 'DEPENSE' : backendType === 'DONATIONS' ? 'DONS' : 'COTISATION'
                setKind(uiKind)
                // Default proof type: prefer the existing proof if present, otherwise fall back to method
                const sel = pms.find(m => m.id === t.payment_methods_id)
                const pmType = (sel?.type_of_proof || 'TRANSACTIONNUMBER') as 'TRANSACTIONNUMBER' | 'LINK' | 'BOTH'
                const existingProof = (t.proof_reference || '').trim()
                const looksLikeUrl = existingProof && (/^https?:\/\//i.test(existingProof) || existingProof.includes('://'))
                if (looksLikeUrl) {
                    setProofType('LINK')
                    setProofPreviewUrl(existingProof)
                } else if (pmType === 'LINK') {
                    setProofType('LINK')
                } else {
                    setProofType('TRANSACTIONNUMBER')
                }
            } catch (e) {
                console.error('Failed to initialize update form', e)
                toast.error(t('transactions.update.loadFailed', 'Transaction not found'))
            } finally {
                if (mounted) setInitializing(false)
            }
        }
        loadAll()
        return () => { mounted = false }
    }, [txId])

    // Sync proofType to selected payment method when it forces a type.
    useEffect(() => {
        const selectedPm = methods.find(m => m.id === Number(payment_methods_id))
        const pmType = (selectedPm?.type_of_proof || 'TRANSACTIONNUMBER') as 'TRANSACTIONNUMBER' | 'LINK' | 'BOTH'
        if (pmType === 'LINK') {
            setProofType('LINK')
        } else if (pmType === 'TRANSACTIONNUMBER') {
            setProofType('TRANSACTIONNUMBER')
        }
        // if BOTH, leave user's current selection intact
    }, [payment_methods_id, methods])

    // Create/cleanup preview URL when user selects a file, or when the textual
    // proof_reference is an URL (existing uploaded image)
    useEffect(() => {
        let objectUrl: string | null = null
        if (proof_file) {
            objectUrl = URL.createObjectURL(proof_file)
            setProofPreviewUrl(objectUrl)
        } else {
            // If no file is selected but proof_reference looks like a URL, use it
            const ref = (proof_reference || '').trim()
            if (ref && (/^https?:\/\//i.test(ref) || ref.includes('://'))) {
                setProofPreviewUrl(ref)
            } else if (!ref) {
                setProofPreviewUrl(null)
            }
        }
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [proof_file, proof_reference])

    // Permissions
    const rolesLower = useMemo(() => (me?.roles || []).map(r => (r.role || '').toLowerCase()), [me])
    const isTreasury = rolesLower.includes('treasury')
    const allowExpense = rolesLower.includes('board') || rolesLower.includes('treasury')
    const canEdit = useMemo(() => {
        if (!tx || !me) return false
        const recordedByMe = Number(tx.recorded_by_id) === Number(me.id)
        if (!recordedByMe) return false
        const st = String(tx.status)
        if (st === 'SAVED') return true
        if (isTreasury && (st === 'SAVED' || st === 'PENDING')) return true
        return false
    }, [tx, me, isTreasury])

    // Amount helpers (mirror AddTransaction)
    function getMagnitudeLabel(n: number): string {
        if (!isFinite(n) || n <= 0) return ''
        if (n >= 1_000_000_000) return 'Milliards'
        if (n >= 1_000_000) return 'Millions'
        if (n >= 1_000) return 'Milles'
        if (n >= 100) return 'Cents'
        return 'Unités'
    }

    function normalizeAmountInput(input: string): string {
        let v = (input || '').replace(/\s/g, '').replace(',', '.')
        if (v === '') return ''
        v = v.replace(/[^0-9.]/g, '')
        const firstDot = v.indexOf('.')
        if (firstDot !== -1) {
            const before = v.slice(0, firstDot + 1)
            const afterRaw = v.slice(firstDot + 1).replace(/\./g, '')
            const after = afterRaw.slice(0, 2)
            v = before + after
        }
        return v
    }

    function formatAmountDisplay(raw: string, locale: string): string {
        if (!raw) return ''
        const num = Number(raw)
        if (!isFinite(num)) return ''
        const decimals = raw.includes('.') ? Math.min(2, (raw.split('.')[1] || '').length) : 0
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: 2,
        }).format(num)
    }

    function handleAmountChange(input: string) {
        const cleaned = input.replace(/[\s,]/g, '')
        setAmount(normalizeAmountInput(cleaned))
    }

    function handleAmountKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const current = Number(amount || '0')
            const decimals = amount.includes('.') ? Math.min(2, (amount.split('.')[1] || '').length) : 0
            const delta = e.key === 'ArrowUp' ? 1000 : -1000
            const next = Math.max(0, current + delta)
            const nextStr = decimals > 0 ? next.toFixed(decimals) : String(next)
            setAmount(nextStr)
        }
    }

    const amountNumber = amount ? Number(amount) : 0
    const magnitude = getMagnitudeLabel(amountNumber)
    const locale = (i18n?.language || 'fr-FR').startsWith('fr') ? 'fr-FR' : 'en-US'
    const formattedAmount = amountNumber >= 10000 ? formatAmountDisplay(amount, locale) : (
        locale === 'fr-FR' ? amount.replace('.', ',') : amount
    )

    const kindOptions = transactionKindOptions({ allowExpense })
    const pmOptions = paymentMethodOptions(methods)

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!tx) return
        if (!canEdit) {
            toast.error(t('transactions.update.forbidden', 'Modification non autorisée'))
            return
        }

        // Validate selection
        const selectedPm = methods.find(m => m.id === Number(payment_methods_id))
        const pmType = (selectedPm?.type_of_proof || 'TRANSACTIONNUMBER') as 'TRANSACTIONNUMBER' | 'LINK' | 'BOTH'
        const isLinkType = pmType === 'LINK' || (pmType === 'BOTH' && proofType === 'LINK')
        const proofOk = isLinkType ? true /* file handled via upload */ : !!proof_reference
        if (!payment_methods_id || !amount || !kind || !proofOk) {
            toast.error(t('transactions.add.requiredFields'))
            return
        }

        setLoading(true)
        try {
            // First, update core fields
            const { transaction_type } = mapKindToBackend(kind)
            const patch: any = {
                amount: Number(amount),
                payment_methods_id: Number(payment_methods_id),
                transaction_type,
            }
            if (!isLinkType) {
                patch.proof_reference = proof_reference
            }
            await updateTransaction(txId, patch)

            // Then, handle proof upload if needed
            if (isLinkType && proof_file) {
                const uploaded = await uploadTransactionProof(proof_file, txId)
                await setTransactionProof(txId, uploaded.url)
            }

            toast.success(t('transactions.update.updated'))
            if (onSuccess) onSuccess(); else navigate('/transactions')
        } catch (err: any) {
            console.error(err)
            toast.error(err?.body?.detail || t('transactions.update.updateFailed', 'Failed to update'))
        } finally {
            setLoading(false)
        }
    }

    if (initializing || !tx) {
        return <div className="p-5 text-center"><div className="spinner-border text-primary" role="status"></div></div>
    }

    return (
        <div className="container py-3">
            <h2 className="h5 mb-3">{t('transactions.update.title')}</h2>
            <form className="card" onSubmit={onSubmit} noValidate>
                <div className="card-body">
                    {!canEdit && (
                        <div className="alert alert-warning" role="alert">
                            {t('transactions.update.onlySavedRecorder', 'Seul l’initiateur peut modifier en statut « SAVED ». Le trésorier peut modifier ce qu’il a enregistré en « SAVED » ou « PENDING ».')}
                        </div>
                    )}
                    <div className="row g-3">
                        {/* Member (read-only) */}
                        <div className="col-md-6 form-section">
                            <label className="form-label label-with-icon">
                                <span className="label-icon" aria-hidden>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 2.239-7 5v2h14v-2c0-2.761-3.134-5-7-5z" /></svg>
                                </span>
                                {t('transactions.update.member')}
                            </label>
                            <input className="form-control" value={tx.user_lastname + " " + tx.user_firstname || `${tx.users_id}`} disabled />
                        </div>

                        {/* Amount */}
                        <div className="col-md-6 form-section">
                            <label className="form-label label-with-icon label-split">
                                <span className="label-left">
                                    <span className="label-icon" aria-hidden>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm.5 5a.5.5 0 0 1 .5.5V8h1.5a.5.5 0 0 1 0 1H13v3h1.5a.5.5 0 0 1 0 1H13v1.5a.5.5 0 0 1-1 0V13h-1.5a.5.5 0 0 1 0-1H12V9h-1.5a.5.5 0 0 1 0-1H12V6.5a.5.5 0 0 1 .5-.5z" /></svg>
                                    </span>
                                    {t('transactions.add.amount')}
                                </span>
                                {amountNumber > 0 && magnitude && (
                                    <span className="rank-pill active label-magnitude" aria-current="true">{magnitude}</span>
                                )}
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="form-control"
                                placeholder={t('transactions.add.amountPlaceholder', 'Ex: 50 000')}
                                value={formattedAmount}
                                onChange={e => canEdit && handleAmountChange(e.target.value)}
                                onKeyDown={handleAmountKeyDown}
                                disabled={!canEdit}
                            />
                            <div className="form-text">{t('transactions.add.currency', 'Devise: Franc Guinéen (GNF)')}</div>
                        </div>

                        {/* Type */}
                        <div className="col-md-6 form-section">
                            <label className="form-label label-with-icon">
                                <span className="label-icon" aria-hidden>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M21 7l-8-5-8 5v10l8 5 8-5V7zm-8 12l-6-3.75V8.5L13 5l6 3.5v6.75L13 19z" /></svg>
                                </span>
                                {t('transactions.add.type')}
                            </label>
                            <select className="form-select" value={kind} onChange={e => canEdit && setKind(e.target.value as TransactionKind)} disabled={!canEdit}>
                                {kindOptions.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Payment method */}
                        <div className="col-md-6 form-section">
                            <label className="form-label label-with-icon">
                                <span className="label-icon" aria-hidden>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4H4V6h16v2zm0 10H4v-8h16v8z" /></svg>
                                </span>
                                {t('transactions.add.paymentMethod')}
                            </label>
                            <select className="form-select" value={payment_methods_id} onChange={e => canEdit && setPaymentMethodId(e.target.value ? Number(e.target.value) : '')} disabled={!canEdit}>
                                <option value="">{t('transactions.add.selectMethod')}</option>
                                {pmOptions.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Proof type toggle for BOTH */}
                        {(() => {
                            const selectedPm = methods.find(m => m.id === Number(payment_methods_id))
                            const pmType = (selectedPm?.type_of_proof || 'TRANSACTIONNUMBER') as 'TRANSACTIONNUMBER' | 'LINK' | 'BOTH'
                            if (pmType === 'BOTH') {
                                return (
                                    <>
                                        <div className="col-md-6 form-section">
                                            <label className="form-label label-with-icon">{t('transactions.add.proofType', 'Type de preuve')}</label>
                                            <div className="form-check form-check-inline">
                                                <input className="form-check-input" type="radio" id="proof-type-number-update" name="proof-type" value="TRANSACTIONNUMBER" checked={proofType === 'TRANSACTIONNUMBER'} onChange={e => canEdit && setProofType(e.target.value as any)} disabled={!canEdit} />
                                                <label className="form-check-label" htmlFor="proof-type-number-update">{t('transactions.add.proofNumber', 'Numéro de transaction')}</label>
                                            </div>
                                            <div className="form-check form-check-inline">
                                                <input className="form-check-input" type="radio" id="proof-type-link-update" name="proof-type" value="LINK" checked={proofType === 'LINK'} onChange={e => canEdit && setProofType(e.target.value as any)} disabled={!canEdit} />
                                                <label className="form-check-label" htmlFor="proof-type-link-update">{t('transactions.add.proofLink', 'Lien/Justificatif')}</label>
                                            </div>
                                        </div>
                                        <div className="col-md-6 form-section">
                                            <label className="form-label">{t('transactions.update.currentProof', 'Preuve actuelle')}</label>
                                            <div className="d-flex justify-content-center align-items-center mt-2">
                                                {proofType === 'LINK' ? (
                                                    proofPreviewUrl ? (
                                                        <img src={proofPreviewUrl} alt="preuve" className="img-thumbnail" style={{ maxHeight: 64, maxWidth: 120 }} />
                                                    ) : (
                                                        <div className="text-muted small">{t('transactions.add.noPreview', 'Aperçu indisponible')}</div>
                                                    )
                                                ) : (
                                                    proof_reference ? (
                                                        <div className="badge bg-light text-dark small d-block text-center" style={{ maxWidth: '100%', wordBreak: 'break-all', whiteSpace: 'normal' }}>
                                                            {t('transactions.add.currentRef', 'Réf')}: {proof_reference}
                                                        </div>
                                                    ) : (
                                                        <div className="text-muted small">{t('transactions.add.noRef', 'Aucune référence')}</div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )
                            }
                            return null
                        })()}

                        {/* Proof input */}
                        <div className="col-12 form-section proof-card">
                            {(() => {
                                const selectedPm = methods.find(m => m.id === Number(payment_methods_id))
                                const pmType = (selectedPm?.type_of_proof || 'TRANSACTIONNUMBER') as 'TRANSACTIONNUMBER' | 'LINK' | 'BOTH'
                                if (pmType === 'BOTH') {
                                    return (
                                        <div>
                                            {proofType === 'TRANSACTIONNUMBER' ? (
                                                <div className="col-md-6">
                                                    <label className="form-label">{t('transactions.add.proofNumber', 'Numéro de transaction')}</label>
                                                    <input type="text" className="form-control" value={proof_reference} onChange={e => canEdit && setProofReference(e.target.value)} disabled={!canEdit} />
                                                    {proof_reference && !(/^https?:\/\//i.test(proof_reference) || proof_reference.includes('://')) && (
                                                        <div className="form-text mt-1">{t('transactions.add.currentRef', 'Réf actuelle')}: {proof_reference}</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div>
                                                    <label className="form-label">{t('transactions.add.proofLink', 'Lien/Justificatif (image)')}</label>
                                                    <input type="file" accept="image/*" className="form-control" onChange={e => canEdit && setProofFile(e.target.files?.[0] || null)} disabled={!canEdit} />
                                                </div>
                                            )}
                                        </div>
                                    )
                                } else if (pmType === 'LINK') {
                                    return (
                                        <div>
                                            <label className="form-label">{t('transactions.add.proofLink', 'Lien/Justificatif (image)')}</label>
                                            <input type="file" accept="image/*" className="form-control" onChange={e => canEdit && setProofFile(e.target.files?.[0] || null)} disabled={!canEdit} />
                                        </div>
                                    )
                                }
                                return (
                                    <div>
                                        <label className="form-label">{t('transactions.add.proofNumber', 'Numéro de transaction')}</label>
                                        <input type="text" className="form-control" value={proof_reference} onChange={e => canEdit && setProofReference(e.target.value)} disabled={!canEdit} />
                                    </div>
                                )
                            })()}
                        </div>
                    </div>
                </div>
                <div className="card-footer d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => onCancel ? onCancel() : navigate('/transactions')}>{t('transactions.update.cancel')}</button>
                    <button type="submit" className="btn btn-primary" disabled={loading || !canEdit}>{t('transactions.update.save')}</button>
                    <button type="button" className="btn btn-success" disabled={loading || !canEdit || tx.status !== 'SAVED'} onClick={async () => {
                        // Save and submit (only when SAVED)
                        const fakeEvent = { preventDefault() { } } as unknown as React.FormEvent
                        await onSubmit(fakeEvent)
                        try {
                            const updated = await submitTransaction(txId)
                            setTx(updated)
                            toast.success(t('transactions.update.submitted', 'Soumis au trésorier'))
                            if (onSuccess) onSuccess(); else navigate('/transactions')
                        } catch (e: any) {
                            toast.error(e?.body?.detail || t('transactions.update.submitFailed', 'Submission failed'))
                        }
                    }}>{t('transactions.add.createAndSend')}</button>
                </div>
            </form>
        </div>
    )
}
