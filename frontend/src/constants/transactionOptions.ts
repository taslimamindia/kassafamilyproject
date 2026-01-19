import i18n from '../i18n'
import type { PaymentMethod, Transaction } from '../services/transactions'

// i18n resources: centralized labels for transaction forms and options
const TX_OPTIONS_RESOURCES = {
    fr: {
        transactions: {
            add: {
                title: 'Ajouter une transaction',
                member: 'Membre',
                paymentMethod: 'Méthode de paiement',
                amount: 'Montant',
                type: 'Type',
                category: 'Catégorie',
                proofReference: 'Référence du justificatif',
                proofType: 'Type de preuve',
                proofTransactionNumber: 'Numéro de transaction',
                proofLink: 'Lien (image)',
                selectMember: 'Sélectionner un membre',
                selectMethod: 'Sélectionner une méthode',
                create: 'Créer',
                createAndSend: 'Créer et envoyer',
                cancel: 'Annuler',
                requiredFields: 'Veuillez remplir tous les champs obligatoires',
                createdSuccess: 'Transaction créée',
                createFailed: 'Échec de la création',
                kindCotisation: 'Cotisation',
                kindDepense: 'Dépense',
                kindDons: 'Dons',
            },
            home: {
                title: 'Transactions',
                new: 'Nouvelle transaction',
                filters: 'Filtres',
                status: 'Statut',
                type: 'Type',
                paymentMethod: 'Méthode de paiement',
                from: 'De',
                to: 'À',
                all: 'Tous',
                loading: 'Chargement...',
                empty: 'Aucune transaction',
                thId: 'ID', thAmount: 'Montant', thStatus: 'Statut', thType: 'Type', thCategory: 'Catégorie', thUser: 'Utilisateur', thRecordedBy: 'Enregistré par', thPayment: 'Paiement', thCreated: 'Créé', thActions: 'Actions',
                edit: 'Modifier',
                onlyPending: 'Seules les transactions en attente peuvent être modifiées',
                addTitle: 'Ajouter une transaction',
                updateTitle: 'Modifier la transaction',
                delete: 'Supprimer',
                confirmDelete: 'Confirmer la suppression ?',
                deleteFailed: 'Suppression échouée',
                onlyPendingOrSaved: 'Seules les transactions Enregistré ou En attente peuvent être supprimées',
                searchPlaceholder: 'Rechercher...',
                resetFilters: 'Réinitialiser',
            },
            update: {
                title: 'Modifier la transaction',
                status: 'Statut',
                amount: 'Montant',
                type: 'Type',
                category: 'Catégorie',
                member: 'Membre',
                paymentMethod: 'Méthode de paiement',
                save: 'Enregistrer',
                cancel: 'Annuler',
                onlyPending: 'Seules les transactions en attente peuvent être modifiées.'
            }
        },
        transactionTypes: {
            CONTRIBUTION: 'Cotisation',
            DONATIONS: 'Dons',
            EXPENSE: 'Dépense',
        },
        transactionStatus: {
            PENDING: 'En attente',
            PARTIALLY_APPROVED: 'Approuvé partiellement',
            VALIDATED: 'Validé',
            REJECTED: 'Rejeté',
            SAVED: 'Enregistré',
        },
    },
    en: {
        transactions: {
            add: {
                title: 'Add Transaction',
                member: 'Member',
                paymentMethod: 'Payment Method',
                amount: 'Amount',
                type: 'Type',
                category: 'Category',
                proofReference: 'Proof Reference',
                proofType: 'Proof Type',
                proofTransactionNumber: 'Transaction Number',
                proofLink: 'Link (image)',
                selectMember: 'Select member',
                selectMethod: 'Select method',
                create: 'Create',
                createAndSend: 'Create and send',
                cancel: 'Cancel',
                requiredFields: 'Please fill all required fields',
                createdSuccess: 'Transaction created',
                createFailed: 'Failed to create',
                kindCotisation: 'Contribution',
                kindDepense: 'Expense',
                kindDons: 'Donation',
            },
            home: {
                title: 'Transactions',
                new: 'New Transaction',
                filters: 'Filters',
                status: 'Status',
                type: 'Type',
                paymentMethod: 'Payment Method',
                from: 'From',
                to: 'To',
                all: 'All',
                loading: 'Loading...',
                empty: 'No transactions',
                thId: 'ID', thAmount: 'Amount', thStatus: 'Status', thType: 'Type', thCategory: 'Category', thUser: 'User', thRecordedBy: 'Recorded By', thPayment: 'Payment', thCreated: 'Created', thActions: 'Actions',
                edit: 'Edit',
                onlyPending: 'Only pending transactions can be modified',
                addTitle: 'Add Transaction',
                updateTitle: 'Update Transaction',
                delete: 'Delete',
                confirmDelete: 'Confirm deletion?',
                deleteFailed: 'Delete failed',
                onlyPendingOrSaved: 'Only Pending or Saved transactions can be deleted',
            },
            update: {
                title: 'Update Transaction',
                status: 'Status',
                amount: 'Amount',
                type: 'Type',
                category: 'Category',
                member: 'Member',
                paymentMethod: 'Payment Method',
                save: 'Save',
                cancel: 'Cancel',
                onlyPending: 'Only pending transactions can be modified.'
            }
        },
        transactionTypes: {
            CONTRIBUTION: 'Contribution',
            DONATIONS: 'Donation',
            EXPENSE: 'Expense',
        },
        transactionStatus: {
            PENDING: 'Pending',
            PARTIALLY_APPROVED: 'Partially Approved',
            VALIDATED: 'Validated',
            REJECTED: 'Rejected',
            SAVED: 'Saved',
        },
    },
    ar: {
        transactions: {
            add: {
                title: 'إضافة عملية',
                member: 'عضو',
                paymentMethod: 'طريقة الدفع',
                amount: 'المبلغ',
                type: 'النوع',
                category: 'الفئة',
                proofReference: 'مرجع الإثبات',
                proofType: 'نوع الإثبات',
                proofTransactionNumber: 'رقم العملية',
                proofLink: 'رابط (صورة)',
                selectMember: 'اختر العضو',
                selectMethod: 'اختر الطريقة',
                create: 'إنشاء',
                createAndSend: 'إنشاء وإرسال',
                cancel: 'إلغاء',
                requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
                createdSuccess: 'تم إنشاء العملية',
                createFailed: 'فشل في الإنشاء',
                kindCotisation: 'اشتراك',
                kindDepense: 'مصروف',
                kindDons: 'تبرعات',
            },
            home: {
                title: 'العمليات',
                new: 'عملية جديدة',
                filters: 'مرشحات',
                status: 'الحالة',
                type: 'النوع',
                paymentMethod: 'طريقة الدفع',
                from: 'من',
                to: 'إلى',
                all: 'الكل',
                loading: 'جارٍ التحميل...',
                empty: 'لا توجد عمليات',
                thId: 'المعرف', thAmount: 'المبلغ', thStatus: 'الحالة', thType: 'النوع', thCategory: 'الفئة', thUser: 'المستخدم', thRecordedBy: 'مسجل بواسطة', thPayment: 'الدفع', thCreated: 'تاريخ الإنشاء', thActions: 'الإجراءات',
                edit: 'تعديل',
                onlyPending: 'يمكن تعديل العمليات قيد الانتظار فقط',
                addTitle: 'إضافة عملية',
                updateTitle: 'تعديل العملية',
                delete: 'حذف',
                confirmDelete: 'تأكيد الحذف؟',
                deleteFailed: 'فشل الحذف',
                onlyPendingOrSaved: 'يمكن حذف العمليات المحفوظة أو قيد الانتظار فقط',
            },
            update: {
                title: 'تعديل العملية',
                status: 'الحالة',
                amount: 'المبلغ',
                type: 'النوع',
                category: 'الفئة',
                member: 'العضو',
                paymentMethod: 'طريقة الدفع',
                save: 'حفظ',
                cancel: 'إلغاء',
                onlyPending: 'يمكن تعديل العمليات قيد الانتظار فقط.'
            }
        },
        transactionTypes: {
            CONTRIBUTION: 'اشتراك',
            DONATIONS: 'تبرعات',
            EXPENSE: 'مصروف',
        },
        transactionStatus: {
            PENDING: 'قيد الانتظار',
            PARTIALLY_APPROVED: 'موافق عليه جزئيًا',
            VALIDATED: 'تم التحقق',
            REJECTED: 'مرفوض',
            SAVED: 'محفوظ',
        },
    },
}

for (const [lng, res] of Object.entries(TX_OPTIONS_RESOURCES)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export type SelectOption<T extends string | number = string | number> = { value: T; label: string }

export function transactionTypeOptions(opts: { includeExpense?: boolean } = {}): Array<SelectOption<Transaction['transaction_type']>> {
    const includeExpense = opts.includeExpense ?? true
    const all: Array<SelectOption<Transaction['transaction_type']>> = [
        { value: 'CONTRIBUTION', label: i18n.t('transactionTypes.CONTRIBUTION') },
        { value: 'DONATIONS', label: i18n.t('transactionTypes.DONATIONS') },
        { value: 'EXPENSE', label: i18n.t('transactionTypes.EXPENSE') },
    ]
    return includeExpense ? all : all.filter(o => o.value !== 'EXPENSE')
}

export function transactionStatusOptions(): Array<SelectOption<Transaction['status']>> {
    return [
        { value: 'PENDING', label: i18n.t('transactionStatus.PENDING') },
        { value: 'PARTIALLY_APPROVED', label: i18n.t('transactionStatus.PARTIALLY_APPROVED') },
        { value: 'VALIDATED', label: i18n.t('transactionStatus.VALIDATED') },
        { value: 'REJECTED', label: i18n.t('transactionStatus.REJECTED') },
        { value: 'SAVED', label: i18n.t('transactionStatus.SAVED') },
    ]
}

export function paymentMethodOptions(methods: PaymentMethod[]): Array<SelectOption<number>> {
    // Source options directly from the database response
    return methods.map(m => ({ value: m.id, label: m.name }))
}

// Three-choice kind displayed in the UI: Cotisation, Dépense, Dons
export type TransactionKind = 'COTISATION' | 'DEPENSE' | 'DONS'

export function transactionKindOptions(opts: { allowExpense?: boolean } = {}): Array<SelectOption<TransactionKind>> {
    const allowExpense = opts.allowExpense ?? false
    const base: Array<SelectOption<TransactionKind>> = [
        { value: 'COTISATION', label: i18n.t('transactions.add.kindCotisation', 'Cotisation') },
        { value: 'DONS', label: i18n.t('transactions.add.kindDons', 'Dons') },
    ]
    if (allowExpense) base.splice(1, 0, { value: 'DEPENSE', label: i18n.t('transactions.add.kindDepense', 'Dépense') })
    return base
}

// Removed hardcoded allowed names from frontend. The backend is the source of truth
// and may enforce allowed names; the UI lists whatever the database returns.

export function mapKindToBackend(kind: TransactionKind): { transaction_type: Transaction['transaction_type'] } {
    switch (kind) {
        case 'COTISATION':
            return { transaction_type: 'CONTRIBUTION' }
        case 'DONS':
            return { transaction_type: 'DONATIONS' }
        case 'DEPENSE':
        default:
            return { transaction_type: 'EXPENSE' }
    }
}
