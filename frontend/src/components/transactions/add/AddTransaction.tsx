import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import i18n from '../../../i18n'
import { createTransaction, listPaymentMethods, type PaymentMethod, uploadTransactionProof } from '../../../services/transactions'
import { getUsers, getCurrentUser, type User } from '../../../services/users'
import { getRolesForUser } from '../../../services/roleAttributions'
import { useTranslation } from 'react-i18next'
import { paymentMethodOptions, transactionKindOptions, mapKindToBackend, type TransactionKind } from '../../../constants/transactionOptions'
import './AddTransaction.css'

const addTransactionResources = {
    fr: {
        transactions: {
            add: {
                title: 'Nouvelle transaction',
                member: 'Membre',
                meBadge: 'Moi',
                memberHelp: 'Choisissez le membre concerné',
                membersLabel: 'Membres concernés',
                selectMember: 'Sélectionner un membre',
                amount: 'Montant',
                amountHelp: 'Saisissez le montant en GNF. Le rang indique la grandeur (Centaines, Milliers, etc.).',
                amountPlaceholder: 'Ex: 50 000',
                amountPerMemberPlaceholder: 'Montant pour ce membre',
                currency: 'Devise: Franc Guinéen (GNF)',
                type: 'Type',
                typeHelp: 'Choisissez le type de transaction (Cotisation, Dépense, etc.).',
                selectType: 'Sélectionnez le type',
                requiredFields: 'Tous les champs sont requis',
                createFailed: 'Erreur lors de la création',
                createdSuccess: 'Transaction créée avec succès',
                paymentMethod: 'Méthode de paiement',
                methodHelp: 'Sélectionnez la méthode de paiement (ex: Orange Money)',
                selectMethod: 'Sélectionner une méthode',
                proofType: 'Type de preuve',
                proofTransactionNumber: 'Numéro de transaction',
                proofLink: 'Lien (image)',
                proofReference: 'Preuve (Référence ou Fichier)',
                cancel: 'Annuler',
                create: 'Créer (Brouillon)',
                createAndSend: 'Créer et Envoyer'
            }
        }
    },
    en: {
        transactions: {
            add: {
                title: 'New Transaction',
                member: 'Member',
                meBadge: 'Me',
                memberHelp: 'Choose the concerned member',
                membersLabel: 'Members',
                selectMember: 'Select a member',
                amount: 'Amount',
                amountHelp: 'Enter amount in GNF.',
                amountPlaceholder: 'Ex: 50,000',
                amountPerMemberPlaceholder: 'Amount for this member',
                currency: 'Currency: Guinean Franc (GNF)',
                type: 'Type',
                typeHelp: 'Choose transaction type',
                selectType: 'Select type',
                requiredFields: 'All fields are required',
                createFailed: 'Error creating transaction',
                createdSuccess: 'Transaction created successfully',
                paymentMethod: 'Payment method',
                methodHelp: 'Select payment method',
                selectMethod: 'Select a method',
                proofType: 'Proof type',
                proofTransactionNumber: 'Transaction Number',
                proofLink: 'Link (image)',
                proofReference: 'Proof (Reference or File)',
                cancel: 'Cancel',
                create: 'Create (Draft)',
                createAndSend: 'Create and Send'
            }
        }
    },
    ar: {
        transactions: {
            add: {
                title: 'معاملة جديدة',
                member: 'العضو',
                meBadge: 'أنا',
                memberHelp: 'اختر العضو المعني',
                membersLabel: 'الأعضاء',
                selectMember: 'اختر عضواً',
                amount: 'المبلغ',
                amountHelp: 'أدخل المبلغ بـ GNF.',
                amountPlaceholder: 'مثال: 50,000',
                amountPerMemberPlaceholder: 'المبلغ لهذا العضو',
                currency: 'العملة: فرنك غيني (GNF)',
                type: 'النوع',
                typeHelp: 'اختر نوع المعاملة',
                selectType: 'اختر النوع',
                requiredFields: 'جميع الحقول مطلوبة',
                createFailed: 'خطأ في إنشاء المعاملة',
                createdSuccess: 'تم إنشاء المعاملة بنجاح',
                paymentMethod: 'طريقة الدفع',
                methodHelp: 'اختر طريقة الدفع',
                selectMethod: 'اختر طريقة',
                proofType: 'نوع الإثبات',
                proofTransactionNumber: 'رقم المعاملة',
                proofLink: 'رابط (صورة)',
                proofReference: 'الإثبات (مرجع أو ملف)',
                cancel: 'إلغاء',
                create: 'إنشاء (مسودة)',
                createAndSend: 'إنشاء وإرسال'
            }
        }
    }
}

for (const [lng, res] of Object.entries(addTransactionResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function AddTransaction({ onSuccess, onCancel }: { onSuccess?: () => void; onCancel?: () => void }) {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [initializing, setInitializing] = useState(true)
    const { t, i18n } = useTranslation()

    const [users, setUsers] = useState<User[]>([])
    const [allUsers, setAllUsers] = useState<User[]>([])
    const [methods, setMethods] = useState<PaymentMethod[]>([])

    const [users_id, setUsersId] = useState<number | ''>('')
    const [selectedMembers, setSelectedMembers] = useState<{ userId: number; amount: string }[]>([])
    const [membersOpen, setMembersOpen] = useState(false)
    const [payment_methods_id, setPaymentMethodId] = useState<number | ''>('')
    const [amount, setAmount] = useState<string>('')
    const [kind, setKind] = useState<TransactionKind | ''>('') // force explicit selection
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
                    if (canChooseMember) {
                        // Load active members for selection and all users for parent lookup
                        getUsers({ status: 'active', roles: 'member' })
                            .then(list => {
                                setUsers(list)
                                return getUsers({ status: 'all' })
                            })
                            .then(all => { setAllUsers(all) })
                            .catch((err) => { console.error('[AddTransaction] users load failed', err) })
                    } else {
                        // Single-member mode: current user only
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
        const selectedPm = methods.find(m => m.id === Number(payment_methods_id))
        const pmType = (selectedPm?.type_of_proof || 'TRANSACTIONNUMBER') as 'TRANSACTIONNUMBER' | 'LINK' | 'BOTH'
        
        // Validate proof according to method's type_of_proof and chosen proofType when BOTH
        const isLinkType = pmType === 'LINK' || (pmType === 'BOTH' && proofType === 'LINK')
        const proofOk = isLinkType ? !!proof_file : !!proof_reference

        if (!payment_methods_id || !kind || !proofOk) {
            toast.error(t('transactions.add.requiredFields'))
            return
        }

        const { transaction_type } = mapKindToBackend(kind as TransactionKind)
        const isMultiMemberMode = (() => {
            const roles = (me?.roles || []).map(r => (r.role || '').toLowerCase())
            return roles.includes('admingroup') || roles.includes('treasury')
        })()

        if (isMultiMemberMode) {
            if (selectedMembers.length === 0) {
                toast.error(t('transactions.add.requiredFields'))
                return
            }
            const invalid = selectedMembers.filter(m => !m.amount || !isFinite(Number(m.amount)) || Number(m.amount) <= 0)
            if (invalid.length > 0) {
                toast.error(t('transactions.add.requiredFields'))
                return
            }
        } else {
            if (!users_id || !amount || !isFinite(Number(amount)) || Number(amount) <= 0) {
                toast.error(t('transactions.add.requiredFields'))
                return
            }
        }

        setLoading(true)
        try {
            let uploadedUrl: string | null = null
            if (isLinkType && proof_file) {
                // Upload image first to get deterministic URL
                const uploaded = await uploadTransactionProof(proof_file)
                uploadedUrl = uploaded.url
            }

            const basePayload = {
                payment_methods_id: Number(payment_methods_id),
                transaction_type,
                issubmitted: sendToTreasury ? 1 : 0,
            }

            if (isMultiMemberMode) {
                for (const member of selectedMembers) {
                    await createTransaction({
                        ...basePayload,
                        amount: Number(member.amount),
                        users_id: member.userId,
                        proof_reference: isLinkType ? (uploadedUrl as string) : proof_reference,
                    })
                }
            } else {
                await createTransaction({
                    ...basePayload,
                    amount: Number(amount),
                    users_id: Number(users_id),
                    proof_reference: isLinkType ? (uploadedUrl as string) : proof_reference,
                })
            }
            toast.success(t('transactions.add.createdSuccess'))
            if (onSuccess) {
                onSuccess()
                navigate('/transactions')
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
            selectedMembers: selectedMembers.map(m => ({ userId: m.userId, amount: m.amount })),
            paymentMethodId: payment_methods_id || null,
        })
    }, [me, users, canChooseMember, users_id, payment_methods_id, selectedMembers])

    useEffect(() => {
        if (!allowExpense && kind === 'DEPENSE') {
            setKind('')
        }
    }, [allowExpense, kind])

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

    // Multi-member helpers
    function toggleMemberSelection(userId: number) {
        setSelectedMembers(prev => {
            const exists = prev.find(m => m.userId === userId)
            if (exists) {
                return prev.filter(m => m.userId !== userId)
            }
            return [...prev, { userId, amount: '' }]
        })
    }

    function updateMemberAmount(userId: number, rawInput: string) {
        const cleaned = rawInput.replace(/[\s,]/g, '')
        const normalized = normalizeAmountInput(cleaned)
        setSelectedMembers(prev => prev.map(m => m.userId === userId ? { ...m, amount: normalized } : m))
    }

    function handleSelectMeAsMember() {
        if (!me) return
        setSelectedMembers(prev => {
            const exists = prev.find(m => m.userId === me.id)
            if (exists) return prev
            return [...prev, { userId: me.id, amount: '' }]
        })
        setMembersOpen(true)
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
                            <div className="col-12 form-section member-select-section">
                                <label className="form-label label-with-icon">
                                    <span className="label-icon" aria-hidden>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 2.239-7 5v2h14v-2c0-2.761-3.134-5-7-5z" /></svg>
                                    </span>
                                    {t('transactions.add.membersLabel')}
                                    {me && (
                                        <span
                                            className="badge bg-secondary ms-2" role="button"
                                            title={t('transactions.add.meBadge', 'Moi')}
                                            onClick={handleSelectMeAsMember}
                                        >{t('transactions.add.meBadge', 'Moi')}</span>
                                    )}
                                    <span className="help-dot" title={t('transactions.add.memberHelp', 'Choisissez le membre concerné')}>
                                        i
                                        <span className="help-tooltip">{t('transactions.add.memberHelp', 'Choisissez le membre concerné')}</span>
                                    </span>
                                </label>
                                <div className="member-select-dropdown">
                                    <div className="member-select-header">
                                        <button
                                            type="button"
                                            className={`member-select-trigger ${membersOpen ? 'member-select-trigger-open' : ''}`}
                                            onClick={() => setMembersOpen(o => !o)}
                                        >
                                            <span className="member-select-placeholder">
                                                {selectedMembers.length === 0
                                                    ? t('transactions.add.selectMember')
                                                    : `${selectedMembers.length} sélectionné(s)`}
                                            </span>
                                            <span className="member-select-arrow" aria-hidden>
                                                ▾
                                            </span>
                                        </button>
                                        {membersOpen && (
                                            <button
                                                type="button"
                                                className="member-select-close-inline"
                                                onClick={() => setMembersOpen(false)}
                                                aria-label={t('transactions.add.cancel')}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="member-list-mobile">
                                    {users
                                        .filter(u => membersOpen || selectedMembers.some(m => m.userId === u.id))
                                        .map(u => {
                                            const selectedEntry = selectedMembers.find(m => m.userId === u.id)
                                            const isSelected = !!selectedEntry
                                            const father = allUsers.find(x => x.id === (u.id_father ?? -1))
                                            const mother = allUsers.find(x => x.id === (u.id_mother ?? -1))
                                            const initials = `${(u.firstname || '').charAt(0)}${(u.lastname || '').charAt(0)}`.toUpperCase()
                                            return (
                                                <div
                                                    key={u.id}
                                                    className={`member-card ${isSelected ? 'member-card-selected' : ''}`}
                                                    onClick={() => {
                                                        if (!membersOpen && isSelected) return
                                                        toggleMemberSelection(u.id)
                                                    }}
                                                >
                                                    <div className="member-avatar">
                                                        {u.image_url ? (
                                                            <img src={u.image_url} alt={`${u.firstname} ${u.lastname}`} />
                                                        ) : (
                                                            <span className="member-avatar-initials">{initials || '?'}</span>
                                                        )}
                                                    </div>
                                                    <div className="member-info">
                                                        <div className="member-main-line">
                                                            <span className="member-name">{u.firstname} {u.lastname}</span>
                                                            <span className="member-username">@{u.username}</span>
                                                        </div>
                                                        <div className="member-parents">
                                                            {father && (
                                                                <span className="me-2">👨 {father.firstname} {father.lastname}</span>
                                                            )}
                                                            {mother && (
                                                                <span>👩 {mother.firstname} {mother.lastname}</span>
                                                            )}
                                                            {!father && !mother && (
                                                                <span className="text-muted">—</span>
                                                            )}
                                                        </div>
                                                        {isSelected && (
                                                            <div className="member-amount mt-2" onClick={e => e.stopPropagation()}>
                                                                <input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    className="form-control form-control-sm"
                                                                    placeholder={t('transactions.add.amountPerMemberPlaceholder')}
                                                                    value={selectedEntry?.amount || ''}
                                                                    onChange={e => updateMemberAmount(u.id, e.target.value)}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="member-check" aria-hidden>
                                                        {isSelected && <span>✓</span>}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>
                        )}
                        {/* Amount first */}
                        {!canChooseMember && (
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
                                required
                            />
                            <div className="form-text">{t('transactions.add.currency', 'Devise: Franc Guinéen (GNF)')}</div>
                            {/* Inline formatted hint removed; formatting shown directement dans le champ */}
                            {/* Inline rank pill moved into label; removed below display */}
                        </div>
                        )}
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
                            <select className="form-select" value={kind} onChange={e => setKind((e.target.value || '') as any)} required>
                                <option value="">{t('transactions.add.selectType', 'Sélectionnez le type')}</option>
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
                            <select className="form-select" value={payment_methods_id} onChange={e => setPaymentMethodId(e.target.value ? Number(e.target.value) : '')} required>
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
                                                    <input type="file" accept="image/*" className="form-control" onChange={e => setProofFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} required={proofType === 'LINK'} />
                                                </div>
                                            ) : (
                                                <div>
                                                    <label className="form-label">{t('transactions.add.proofReference')}</label>
                                                    <input type="text" className="form-control" value={proof_reference} onChange={e => setProofReference(e.target.value)} required={proofType === 'TRANSACTIONNUMBER'} />
                                                </div>
                                            )}
                                        </div>
                                    )
                                } else if (pmType === 'LINK') {
                                    return (
                                        <div>
                                            <label className="form-label">{t('transactions.add.proofReference')}</label>
                                            <input type="file" accept="image/*" className="form-control" onChange={e => setProofFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} required />
                                        </div>
                                    )
                                }
                                return (
                                    <div>
                                        <label className="form-label">{t('transactions.add.proofReference')}</label>
                                        <input type="text" className="form-control" value={proof_reference} onChange={e => setProofReference(e.target.value)} required />
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
