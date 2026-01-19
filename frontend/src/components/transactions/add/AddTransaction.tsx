import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { createTransaction, listPaymentMethods, type PaymentMethod, uploadTransactionProof } from '../../../services/transactions'
import { getUsers, getCurrentUser, type User } from '../../../services/users'
import { getRolesForUser } from '../../../services/roleAttributions'
import { useTranslation } from 'react-i18next'
import { paymentMethodOptions, transactionKindOptions, mapKindToBackend, type TransactionKind } from '../../../constants/transactionOptions'
import './AddTransaction.css'

export default function AddTransaction({ onSuccess, onCancel }: { onSuccess?: () => void; onCancel?: () => void }) {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [initializing, setInitializing] = useState(true)
    const { t, i18n } = useTranslation()

    const [users, setUsers] = useState<User[]>([])
    const [methods, setMethods] = useState<PaymentMethod[]>([])

    const [users_id, setUsersId] = useState<number | ''>('')
    const [payment_methods_id, setPaymentMethodId] = useState<number | ''>('')
    const [amount, setAmount] = useState<string>('50000')
    const [kind, setKind] = useState<TransactionKind>('COTISATION') // default to revenue by contribution
    const [me, setMe] = useState<User | null>(null)
    const [proof_reference, setProofReference] = useState<string>('')
    const [proof_file, setProofFile] = useState<File | null>(null)
    const [proofType, setProofType] = useState<'TRANSACTIONNUMBER' | 'LINK'>('TRANSACTIONNUMBER')
    useEffect(() => {
        let mounted = true
        async function loadRefs() {
            try {
                const current = await getCurrentUser()
                const [pms, myRoles] = await Promise.all([
                    listPaymentMethods({ active: true }),
                    getRolesForUser(current.id),
                ])
                let canChooseMember = false
                const roles = (myRoles || []).map(r => (r.role || '').toLowerCase())
                // Only admingroup and treasury can select a member (admin hidden)
                if (roles.includes('admingroup') || roles.includes('treasury')) {
                    canChooseMember = true
                }

                if (mounted) {
                    // attach roles to current user for downstream logic
                    setMe({ ...current, roles: myRoles as any })
                    setMethods(pms)
                    // Default payment method: Orange money
                    const orange = pms.find(pm => (pm.name || '').toLowerCase() === 'orange money' && pm.isactive === 1)
                    if (orange) {
                        setPaymentMethodId(orange.id)
                        // Default proof type to number even if BOTH
                        setProofType('TRANSACTIONNUMBER')
                    }
                    if (canChooseMember) {
                        // Load only active members; backend enforces scope by role
                        getUsers({ status: 'active', roles: 'member' })
                            .then(list => { setUsers(list) })
                            .catch((err) => { console.error('[AddTransaction] users load failed', err) })
                    } else {
                        setUsersId(current.id)
                    }
                }
            } catch (e) { console.error('Failed loading refs', e) } finally {
                if (mounted) setInitializing(false)
            }
        }
        loadRefs()
        return () => { mounted = false }
    }, [])

    async function submit(sendToTreasury: boolean) {
        const { transaction_type } = mapKindToBackend(kind)
        const selectedPm = methods.find(m => m.id === Number(payment_methods_id))
        const pmType = (selectedPm?.type_of_proof || 'TRANSACTIONNUMBER') as 'TRANSACTIONNUMBER' | 'LINK' | 'BOTH'
        // Validate proof according to method's type_of_proof and chosen proofType when BOTH
        const isLinkType = pmType === 'LINK' || (pmType === 'BOTH' && proofType === 'LINK')
        const proofOk = isLinkType ? !!proof_file : !!proof_reference
        if (!users_id || !payment_methods_id || !amount || !kind || !proofOk) {
            toast.error(t('transactions.add.requiredFields'))
            return
        }
        setLoading(true)
        try {
            if (isLinkType && proof_file) {
                // Upload image first to get deterministic URL, then create transaction with that URL
                const uploaded = await uploadTransactionProof(proof_file)
                await createTransaction({
                    amount: Number(amount),
                    payment_methods_id: Number(payment_methods_id),
                    users_id: Number(users_id),
                    transaction_type,
                    proof_reference: uploaded.url,
                    issubmitted: sendToTreasury ? 1 : 0,
                })
            } else {
                await createTransaction({
                    amount: Number(amount),
                    payment_methods_id: Number(payment_methods_id),
                    users_id: Number(users_id),
                    transaction_type,
                    proof_reference: proof_reference,
                    issubmitted: sendToTreasury ? 1 : 0,
                })
            }
            toast.success(t('transactions.add.createdSuccess'))
            if (onSuccess) {
                onSuccess()
            } else {
                navigate('/transactions')
            }
        } catch (e: any) {
            console.error(e)
            toast.error(e?.body?.detail || t('transactions.add.createFailed'))
        } finally {
            setLoading(false)
        }
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        await submit(false)
    }

    const pmOptions = paymentMethodOptions(methods)
    
    const canChooseMember = (() => {
        const roles = (me?.roles || []).map(r => (r.role || '').toLowerCase())
        const can = roles.includes('admingroup') || roles.includes('treasury')
        return can
    })()
    const allowExpense = (() => {
        const roles = (me?.roles || []).map(r => (r.role || '').toLowerCase())
        return roles.includes('board') || roles.includes('treasury')
    })()
    const kindOptions = transactionKindOptions({ allowExpense })

    // Debug reactive logs for visibility and data
    useEffect(() => {
        const roles = (me?.roles || []).map(r => (r.role || '').toLowerCase())
        console.log('[AddTransaction] reactive state', {
            meId: me?.id || null,
            roles,
            canChooseMember,
            usersCount: users.length,
            selectedUserId: users_id || null,
            paymentMethodId: payment_methods_id || null,
        })
    }, [me, users, canChooseMember, users_id, payment_methods_id])

    useEffect(() => {
        if (!allowExpense && kind === 'DEPENSE') {
            setKind('COTISATION')
        }
    }, [allowExpense])

    function getMagnitudeLabel(n: number): string {
        if (!isFinite(n) || n <= 0) return ''
        if (n >= 1_000_000_000) return 'Milliards'
        if (n >= 1_000_000) return 'Millions'
        if (n >= 1_000) return 'Milles'
        if (n >= 100) return 'Cents'
        if (n >= 10) return 'Dizaines'
        return 'Unités'
    }

    function normalizeAmountInput(input: string): string {
        // Replace comma with dot and keep only digits + one dot
        let v = (input || '').replace(/\s/g, '').replace(',', '.')
        // Allow empty
        if (v === '') return ''
        // Remove invalid characters
        v = v.replace(/[^0-9.]/g, '')
        const firstDot = v.indexOf('.')
        if (firstDot !== -1) {
            // Remove any additional dots
            const before = v.slice(0, firstDot + 1)
            const afterRaw = v.slice(firstDot + 1).replace(/\./g, '')
            const after = afterRaw.slice(0, 2) // limit to 2 decimals
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
        // Strip group separators (spaces, commas) and normalize
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
    // Removed old hint computations; formatting is now shown directly in the input

    if (initializing) {
        return <div className="p-5 text-center"><div className="spinner-border text-primary" role="status"></div></div>
    }

    return (
        <div className="container py-3">
            <h2 className="h5 mb-3">{t('transactions.add.title')}</h2>
            <form className="card" onSubmit={onSubmit} noValidate>
                <div className="card-body">
                    <div className="row g-3">
                        {canChooseMember && (
                            <div className="col-md-6 form-section">
                                <label className="form-label label-with-icon">
                                    <span className="label-icon" aria-hidden>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 2.239-7 5v2h14v-2c0-2.761-3.134-5-7-5z" /></svg>
                                    </span>
                                    {t('transactions.add.member')}
                                    <span className="help-dot" title={t('transactions.add.memberHelp', 'Choisissez le membre concerné')}>
                                        i
                                        <span className="help-tooltip">{t('transactions.add.memberHelp', 'Choisissez le membre concerné')}</span>
                                    </span>
                                </label>
                                <select className="form-select" value={users_id} onChange={e => setUsersId(e.target.value ? Number(e.target.value) : '')}>
                                    <option value="">{t('transactions.add.selectMember')}</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.firstname} {u.lastname} ({u.username})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {/* Amount first */}
                        <div className="col-md-6 form-section">
                            <label className="form-label label-with-icon label-split">
                                <span className="label-left">
                                    <span className="label-icon" aria-hidden>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm.5 5a.5.5 0 0 1 .5.5V8h1.5a.5.5 0 0 1 0 1H13v3h1.5a.5.5 0 0 1 0 1H13v1.5a.5.5 0 0 1-1 0V13h-1.5a.5.5 0 0 1 0-1H12V9h-1.5a.5.5 0 0 1 0-1H12V6.5a.5.5 0 0 1 .5-.5z" /></svg>
                                    </span>
                                    {t('transactions.add.amount')}
                                    <span className="help-dot" title={t('transactions.add.amountHelp', 'Saisissez le montant en GNF. Le rang indique la grandeur (Centaines, Milliers, etc.).')}>
                                        i
                                        <span className="help-tooltip">{t('transactions.add.amountHelp', 'Saisissez le montant en GNF. Le rang indique la grandeur (Centaines, Milliers, etc.).')}</span>
                                    </span>
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
                                onChange={e => handleAmountChange(e.target.value)}
                                onKeyDown={handleAmountKeyDown}
                            />
                            <div className="form-text">{t('transactions.add.currency', 'Devise: Franc Guinéen (GNF)')}</div>
                            {/* Inline formatted hint removed; formatting shown directly in input */}
                            {/* Inline rank pill moved into label; removed below display */}
                        </div>
                        {/* Type next to amount */}
                        <div className="col-md-6 form-section">
                            <label className="form-label label-with-icon">
                                <span className="label-icon" aria-hidden>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M21 7l-8-5-8 5v10l8 5 8-5V7zm-8 12l-6-3.75V8.5L13 5l6 3.5v6.75L13 19z" /></svg>
                                </span>
                                {t('transactions.add.type')}
                                <span className="help-dot" title={t('transactions.add.typeHelp', 'Choisissez le type de transaction (Cotisation, Dépense, etc.).')}>
                                    i
                                    <span className="help-tooltip">{t('transactions.add.typeHelp', 'Choisissez le type de transaction (Cotisation, Dépense, etc.).')}</span>
                                </span>
                            </label>
                            <select className="form-select" value={kind} onChange={e => setKind(e.target.value as TransactionKind)}>
                                {kindOptions.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-6 form-section">
                            <label className="form-label label-with-icon">
                                <span className="label-icon" aria-hidden>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4H4V6h16v2zm0 10H4v-8h16v8z" /></svg>
                                </span>
                                {t('transactions.add.paymentMethod')}
                                <span className="help-dot" title={t('transactions.add.methodHelp', 'Sélectionnez la méthode de paiement (ex: Orange Money)')}>
                                    i
                                    <span className="help-tooltip">{t('transactions.add.methodHelp', 'Sélectionnez la méthode de paiement (ex: Orange Money)')}</span>
                                </span>
                            </label>
                            <select className="form-select" value={payment_methods_id} onChange={e => setPaymentMethodId(e.target.value ? Number(e.target.value) : '')}>
                                <option value="">{t('transactions.add.selectMethod')}</option>
                                {pmOptions.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        {(() => {
                            const selectedPm = methods.find(m => m.id === Number(payment_methods_id))
                            const pmType = (selectedPm?.type_of_proof || 'TRANSACTIONNUMBER') as 'TRANSACTIONNUMBER' | 'LINK' | 'BOTH'
                            if (pmType === 'BOTH') {
                                return (
                                    <div className="col-md-6 form-section">
                                        <label className="form-label label-with-icon">
                                            <span className="label-icon" aria-hidden>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M21 7l-8-5-8 5v10l8 5 8-5V7zm-8 12l-6-3.75V8.5L13 5l6 3.5v6.75L13 19z" /></svg>
                                            </span>
                                            {t('transactions.add.proofType', 'Type de preuve')}
                                        </label>
                                        <div className="form-check form-check-inline">
                                            <input className="form-check-input" type="radio" id="proof-type-number-top" name="proof-type" value="TRANSACTIONNUMBER" checked={proofType === 'TRANSACTIONNUMBER'} onChange={e => setProofType(e.target.value as any)} />
                                            <label className="form-check-label" htmlFor="proof-type-number-top">{t('transactions.add.proofTransactionNumber', 'Numéro de transaction')}</label>
                                        </div>
                                        <div className="form-check form-check-inline">
                                            <input className="form-check-input" type="radio" id="proof-type-link-top" name="proof-type" value="LINK" checked={proofType === 'LINK'} onChange={e => setProofType(e.target.value as any)} />
                                            <label className="form-check-label" htmlFor="proof-type-link-top">{t('transactions.add.proofLink', 'Lien (image)')}</label>
                                        </div>
                                    </div>
                                )
                            }
                            return null
                        })()}
                        <div className="col-12 form-section proof-card">
                            {(() => {
                                const selectedPm = methods.find(m => m.id === Number(payment_methods_id))
                                const pmType = (selectedPm?.type_of_proof || 'TRANSACTIONNUMBER') as 'TRANSACTIONNUMBER' | 'LINK' | 'BOTH'
                                if (pmType === 'BOTH') {
                                    return (
                                        <div>
                                            {proofType === 'LINK' ? (
                                                <div>
                                                    <label className="form-label">{t('transactions.add.proofReference')}</label>
                                                    <input type="file" accept="image/*" className="form-control" onChange={e => setProofFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
                                                </div>
                                            ) : (
                                                <div>
                                                    <label className="form-label">{t('transactions.add.proofReference')}</label>
                                                    <input type="text" className="form-control" value={proof_reference} onChange={e => setProofReference(e.target.value)} />
                                                </div>
                                            )}
                                        </div>
                                    )
                                } else if (pmType === 'LINK') {
                                    return (
                                        <div>
                                            <label className="form-label">{t('transactions.add.proofReference')}</label>
                                            <input type="file" accept="image/*" className="form-control" onChange={e => setProofFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
                                        </div>
                                    )
                                }
                                return (
                                    <div>
                                        <label className="form-label">{t('transactions.add.proofReference')}</label>
                                        <input type="text" className="form-control" value={proof_reference} onChange={e => setProofReference(e.target.value)} />
                                    </div>
                                )
                            })()}
                        </div>
                    </div>
                </div>
                <div className="card-footer d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => onCancel ? onCancel() : navigate('/transactions')}>{t('transactions.add.cancel')}</button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>{t('transactions.add.create')}</button>
                    <button type="button" className="btn btn-success" disabled={loading} onClick={() => submit(true)}>{t('transactions.add.createAndSend')}</button>
                </div>
            </form>
        </div>
    )
}
