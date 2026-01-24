import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { listTransactions, type Transaction } from '../../services/transactions'
import { getCurrentUser, type User } from '../../services/users'
import Modal from '../common/Modal'
import AddTransaction from './add/AddTransaction'
import './HomeCaisse.css'

// Translation Resources
const homeCaisseResources = {
    fr: {
        homecaisse: {
            title: 'Tableau de bord',
            subtitle: "Vue d'ensemble de la trésorerie familiale",
            filters: {
                this_month: 'Ce mois',
                last_month: 'Mois dernier',
                this_year: 'Cette année',
                all: 'Tout'
            },
            buttons: {
                validation: 'Validation',
                new: 'Nouveau',
                see_all: 'Voir tout',
                see_transactions: 'Voir transactions'
            },
            kpi: {
                global_balance: 'Solde Global',
                available_total: 'Total disponible en caisse',
                incomes: 'Entrées',
                expenses: 'Sorties',
                period_sub: 'Sur la période sélectionnée',
                net_result: 'Résultat Période',
                net_sub: 'Différence entrées - sorties'
            },
            charts: {
                activity_title: 'Activité Financière',
                activity_sub: 'Evolution Entrées / Sorties',
                distribution_title: 'Répartition Entrées',
                legend_income: 'Entrées',
                legend_expense: 'Sorties',
                legend_cotisation: 'Cotisations',
                legend_don: 'Dons',
                no_data: 'Pas de données sur cette période'
            },
            table: {
                title: 'Dernières transactions',
                th_transaction: 'Transaction',
                th_amount: 'Montant',
                th_status: 'Status',
                th_validations: 'Validations',
                th_date: 'Date',
                no_transactions: 'Aucune transaction',
                loading: 'Chargement...'
            },
            modal_title: 'Nouvelle transaction'
        }
    },
    en: {
        homecaisse: {
            title: 'Dashboard',
            subtitle: "Family treasury overview",
            filters: {
                this_month: 'This month',
                last_month: 'Last month',
                this_year: 'This year',
                all: 'All'
            },
            buttons: {
                validation: 'Validation',
                new: 'New',
                see_all: 'See all',
                see_transactions: 'See transactions'
            },
            kpi: {
                global_balance: 'Global Balance',
                available_total: 'Total available in cash',
                incomes: 'Incomes',
                expenses: 'Expenses',
                period_sub: 'For selected period',
                net_result: 'Net Result',
                net_sub: 'Difference incomes - expenses'
            },
            charts: {
                activity_title: 'Financial Activity',
                activity_sub: 'Incomes / Expenses Evolution',
                distribution_title: 'Income Distribution',
                legend_income: 'Incomes',
                legend_expense: 'Expenses',
                legend_cotisation: 'Contributions',
                legend_don: 'Donations',
                no_data: 'No data for this period'
            },
            table: {
                title: 'Latest transactions',
                th_transaction: 'Transaction',
                th_amount: 'Amount',
                th_status: 'Status',
                th_validations: 'Validations',
                th_date: 'Date',
                no_transactions: 'No transactions',
                loading: 'Loading...'
            },
            modal_title: 'New Transaction'
        }
    },
    ar: {
        homecaisse: {
            title: 'لوحة القيادة',
            subtitle: "نظرة عامة على الخزانة العائلية",
            filters: {
                this_month: 'هذا الشهر',
                last_month: 'الشهر الماضي',
                this_year: 'هذه السنة',
                all: 'الكل'
            },
            buttons: {
                validation: 'التصديق',
                new: 'جديد',
                see_all: 'عرض الكل',
                see_transactions: 'عرض المعاملات'
            },
            kpi: {
                global_balance: 'الرصيد العام',
                available_total: 'إجمالي المتوفر في الصندوق',
                incomes: 'المداخيل',
                expenses: 'المصاريف',
                period_sub: 'للفترة المحددة',
                net_result: 'الصافي',
                net_sub: 'الفرق بين المداخيل والمصاريف'
            },
            charts: {
                activity_title: 'النشاط المالي',
                activity_sub: 'تطور المداخيل / المصاريف',
                distribution_title: 'توزيع المداخيل',
                legend_income: 'مداخيل',
                legend_expense: 'مصاريف',
                legend_cotisation: 'اشتراكات',
                legend_don: 'تبرعات',
                no_data: 'لا توجد بيانات لهذه الفترة'
            },
            table: {
                title: 'أحدث المعاملات',
                th_transaction: 'المعاملة',
                th_amount: 'المبلغ',
                th_status: 'الحالة',
                th_validations: 'التصديقات',
                th_date: 'التاريخ',
                no_transactions: 'لا توجد معاملات',
                loading: 'جار التحميل...'
            },
            modal_title: 'معاملة جديدة'
        }
    }
}

for (const [lng, res] of Object.entries(homeCaisseResources)) {
    i18n.addResourceBundle(lng, 'translation', res, true, false)
}

type TimeFilter = 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'ALL'

export default function HomeCaisse() {
    const { t } = useTranslation()
    const [txs, setTxs] = useState<Transaction[]>([])
    const [user, setUser] = useState<User | null>(null)
    const [filter, setFilter] = useState<TimeFilter>('THIS_YEAR')

    useEffect(() => {
        let mounted = true
            ; (async () => {
                try {
                    // Fetch ALL transactions initially for client-side filtering
                    // In a larger app, we would fetch based on filter
                    const [transactions, currentUser] = await Promise.all([
                        listTransactions({}),
                        getCurrentUser(),
                    ])
                    if (mounted) { setTxs(transactions); setUser(currentUser) }
                } finally {
                }
            })()
        return () => { mounted = false }
    }, [])

    const {
        balance,
        filteredIncome,
        filteredExpense,
        netChange,
        chartData,
        distributionData,
        paymentMethodData,
        lastTx
    } = useMemo(() => {
        const now = new Date()

        // 1. Filter logic
        const filteredTxs = txs.filter(t => {
            if (t.status !== 'VALIDATED') return false // Only validated for stats

            const d = new Date(t.validated_at || t.created_at)

            if (filter === 'THIS_MONTH') {
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }
            if (filter === 'LAST_MONTH') {
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear()
            }
            if (filter === 'THIS_YEAR') {
                return d.getFullYear() === now.getFullYear()
            }
            return true // ALL
        })

        // 2. Aggregate Stats
        let income = 0
        let expense = 0

        filteredTxs.forEach(t => {
            const amt = Number(t.amount || 0)
            if (t.transaction_type === 'EXPENSE') expense += amt
            else income += amt
        })

        const netChange = income - expense

        // Global Balance (All time, strictly validated)
        const globalBalance = txs
            .filter(t => t.status === 'VALIDATED')
            .reduce((acc, t) => {
                const amt = Number(t.amount || 0)
                return acc + (t.transaction_type === 'EXPENSE' ? -amt : amt)
            }, 0)

        // 3. Chart Data Preparation
        // Group by Month (if Year/All) or Day (if Month)
        const isMonthView = filter === 'THIS_MONTH' || filter === 'LAST_MONTH'
        const groupedData: Record<string, { name: string, income: number, expense: number }> = {}

        // Init chart keys to ensure continuity? 
        // For simplicity, we just aggregate what we have. 
        // Ideally we fill empty days/months with 0.

        filteredTxs.forEach(t => {
            const d = new Date(t.validated_at || t.created_at)
            let key = ''
            let name = '' // Display name

            if (isMonthView) {
                // Day
                key = d.getDate().toString()
                name = `${d.getDate()}` // e.g. "1", "25"
            } else {
                // Month
                key = `${d.getFullYear()}-${d.getMonth()}`
                name = d.toLocaleDateString('fr-FR', { month: 'short' })
            }

            if (!groupedData[key]) groupedData[key] = { name, income: 0, expense: 0 }

            const amt = Number(t.amount || 0)
            if (t.transaction_type === 'EXPENSE') groupedData[key].expense += amt
            else groupedData[key].income += amt
        })

        // Sort by date (approximated by key logic or resorting)
        const sortedKeys = Object.keys(groupedData).sort((a, b) => {
            if (isMonthView) return Number(a) - Number(b)
            // Year-Month sort
            const [y1, m1] = a.split('-').map(Number);
            const [y2, m2] = b.split('-').map(Number);
            return (y1 * 12 + m1) - (y2 * 12 + m2)
        })

        const chartData = sortedKeys.map(k => groupedData[k])

        // 4. Distribution Data (Donut)
        let totalCotisation = 0
        let totalDon = 0

        filteredTxs.forEach(t => {
            if (t.transaction_type === 'CONTRIBUTION') totalCotisation += Number(t.amount)
            else if (t.transaction_type === 'DONATIONS') totalDon += Number(t.amount)
            // expense ignored for this income distribution chart
        })

        const distributionData = [
            { name: t('homecaisse.charts.legend_cotisation'), value: totalCotisation, color: '#4f46e5' }, // Indigo
            { name: t('homecaisse.charts.legend_don'), value: totalDon, color: '#06b6d4' }, // Cyan
        ].filter(d => d.value > 0)

        // 5. Payment Method Distribution (Count)
        const paymentStats: Record<string, number> = {}
        filteredTxs.forEach(t => {
            const method = t.payment_method_name || 'Autre'
            paymentStats[method] = (paymentStats[method] || 0) + 1
        })

        const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
        const paymentMethodData = Object.entries(paymentStats).map(([name, value], i) => ({
            name,
            value,
            color: COLORS[i % COLORS.length]
        }))

        // 6. Last transactions
        const lastTx = txs
            .filter(t => t.status === 'VALIDATED')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5)

        return {
            balance: globalBalance,
            filteredIncome: income,
            filteredExpense: expense,
            netChange,
            chartData,
            distributionData,
            paymentMethodData,
            lastTx
        }
    }, [txs, filter, t])

    const [showAdd, setShowAdd] = useState(false)
    const canAdd = !!user?.roles?.some(r => ['admin', 'admingroup', 'treasury', 'member'].includes((r.role || '').toLowerCase()))

    return (
        <>
            <div className="container py-4">
                {/* Header with Filters */}
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-5 gap-3">
                    <div>
                        <h1 className="h3 fw-bold text-dark mb-1">{t('homecaisse.title')} 🚀</h1>
                        <p className="text-muted mb-0">{t('homecaisse.subtitle')}</p>
                    </div>

                    <div className="d-flex bg-white p-1 rounded-pill shadow-sm border border-light">
                        {[
                            { k: 'THIS_MONTH', l: t('homecaisse.filters.this_month') },
                            { k: 'LAST_MONTH', l: t('homecaisse.filters.last_month') },
                            { k: 'THIS_YEAR', l: t('homecaisse.filters.this_year') },
                            { k: 'ALL', l: t('homecaisse.filters.all') }
                        ].map(opt => (
                            <div
                                key={opt.k}
                                className={`filter-pill ${filter === opt.k ? 'active' : ''}`}
                                onClick={() => setFilter(opt.k as TimeFilter)}
                            >
                                {opt.l}
                            </div>
                        ))}
                    </div>

                    <div className="d-flex gap-2">
                        {user?.roles?.some(r => ['board', 'treasury'].includes((r.role || '').toLowerCase())) && (
                            <Link to="/approvals" className="btn btn-warning btn-sm text-dark d-flex align-items-center px-3 rounded-pill fw-bold">
                                {t('homecaisse.buttons.validation')} ({txs.filter(t => t.status === 'PENDING' || t.status === 'PARTIALLY_APPROVED').length})
                            </Link>
                        )}
                        {canAdd && (
                            <div className="d-flex gap-2">
                                <Link to="/transactions" className="btn btn-outline-primary btn-sm d-flex align-items-center px-3 rounded-pill fw-bold shadow-sm">
                                    <i className="bi bi-list-ul me-2"></i> {t('homecaisse.buttons.see_transactions')}
                                </Link>
                                <button className="btn btn-primary btn-sm d-flex align-items-center px-3 rounded-pill fw-bold shadow-sm" onClick={() => setShowAdd(true)}>
                                    <i className="bi bi-plus-lg me-2"></i> {t('homecaisse.buttons.new')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="row g-4 mb-5">
                    {/* Solde Card - Always Global */}
                    <div className="col-12 col-md-3">
                        <div className="kpi-card h-100">
                            <div className="kpi-icon-wrapper bg-gradient-blue">
                                <i className="bi bi-wallet2"></i>
                            </div>
                            <div className="kpi-title">{t('homecaisse.kpi.global_balance')}</div>
                            <div className="kpi-metric">{balance.toLocaleString('fr-FR')}</div>
                            <div className="kpi-sub">{t('homecaisse.kpi.available_total')}</div>
                        </div>
                    </div>

                    {/* Filtered Income */}
                    <div className="col-12 col-md-3">
                        <div className="kpi-card h-100">
                            <div className="kpi-icon-wrapper bg-gradient-green">
                                <i className="bi bi-graph-up-arrow"></i>
                            </div>
                            <div className="kpi-title">{t('homecaisse.kpi.incomes')}</div>
                            <div className="kpi-metric text-success">+{filteredIncome.toLocaleString('fr-FR')}</div>
                            <div className="kpi-sub">{t('homecaisse.kpi.period_sub')}</div>
                        </div>
                    </div>

                    {/* Filtered Expense */}
                    <div className="col-12 col-md-3">
                        <div className="kpi-card h-100">
                            <div className="kpi-icon-wrapper bg-gradient-red">
                                <i className="bi bi-graph-down-arrow"></i>
                            </div>
                            <div className="kpi-title">{t('homecaisse.kpi.expenses')}</div>
                            <div className="kpi-metric text-danger">-{filteredExpense.toLocaleString('fr-FR')}</div>
                            <div className="kpi-sub">{t('homecaisse.kpi.period_sub')}</div>
                        </div>
                    </div>

                    {/* Net Change */}
                    <div className="col-12 col-md-3">
                        <div className="kpi-card h-100">
                            <div className="kpi-icon-wrapper bg-gradient-orange">
                                <i className="bi bi-activity"></i>
                            </div>
                            <div className="kpi-title">{t('homecaisse.kpi.net_result')}</div>
                            <div className={`kpi-metric ${netChange >= 0 ? 'text-success' : 'text-danger'}`}>
                                {netChange > 0 ? '+' : ''}{netChange.toLocaleString('fr-FR')}
                            </div>
                            <div className="kpi-sub">{t('homecaisse.kpi.net_sub')}</div>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="row g-4 mb-5">
                    <div className="col-12">
                        <div className="chart-card">
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <div className="chart-title mb-0">📊 {t('homecaisse.charts.activity_title')}</div>
                                <div className="small text-muted">{t('homecaisse.charts.activity_sub')}</div>
                            </div>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                        />
                                        <RechartsTooltip
                                            cursor={{ fill: '#f1f5f9' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                        <Legend iconType="circle" />
                                        <Bar dataKey="income" name={t('homecaisse.charts.legend_income')} fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={20} />
                                        <Bar dataKey="expense" name={t('homecaisse.charts.legend_expense')} fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-md-6">
                        <div className="chart-card">
                            <div className="chart-title text-center">🍩 {t('homecaisse.charts.distribution_title')}</div>
                            <div style={{ width: '100%', height: 300 }}>
                                {distributionData.length > 0 ? (
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie
                                                data={distributionData}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {distributionData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="d-flex align-items-center justify-content-center h-100 text-muted small">
                                        {t('homecaisse.charts.no_data')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-md-6">
                        <div className="chart-card">
                            <div className="chart-title text-center">💳 Transactions par mode</div>
                            <div style={{ width: '100%', height: 300 }}>
                                {paymentMethodData.length > 0 ? (
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie
                                                data={paymentMethodData}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {paymentMethodData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="d-flex align-items-center justify-content-center h-100 text-muted small">
                                        {t('homecaisse.charts.no_data')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Transactions List */}
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-5">
                    <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center border-bottom-0">
                        <span className="fw-bold h5 mb-0">{t('homecaisse.table.title')}</span>
                        <Link to="/transactions" className="btn btn-link text-decoration-none small">{t('homecaisse.buttons.see_all')}</Link>
                    </div>
                    <div className="d-block d-md-none p-3 bg-light">
                        {lastTx.map(t => (
                            <div key={t.id} className="card border-0 shadow-sm mb-3 rounded-4">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span className={`badge rounded-pill fw-normal text-uppercase px-3 py-2 ${t.status === 'VALIDATED' ? 'bg-success-subtle text-success' :
                                            t.status === 'PENDING' ? 'bg-warning-subtle text-warning' : 'bg-secondary-subtle text-secondary'
                                            }`} style={{ fontSize: '0.7rem' }}>
                                            {t.status}
                                        </span>
                                        <span className="text-muted small">{new Date(t.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="d-flex align-items-center mb-3">
                                        <div className="d-flex align-items-center justify-content-center rounded-circle bg-light me-3" style={{ width: 40, height: 40 }}>
                                            {t.transaction_type === 'EXPENSE' ? '💸' : '💰'}
                                        </div>
                                        <div>
                                            <div className="fw-bold text-dark">{t.user_firstname} {t.user_lastname}</div>
                                            <div className="small text-muted text-uppercase">{t.transaction_type}</div>
                                        </div>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <span className="text-muted small">Montant</span>
                                        <span className={`fw-bold ${t.transaction_type === 'EXPENSE' ? 'text-danger' : 'text-success'}`}>
                                            {t.transaction_type === 'EXPENSE' ? '-' : '+'}{Number(t.amount).toLocaleString('fr-FR')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {lastTx.length === 0 && <div className="text-center text-muted py-5">Aucune transaction</div>}
                    </div>
                    <div className="table-responsive d-none d-md-block">
                        <table className="table m-0">
                            <thead className="bg-light">
                                <tr>
                                    <th className="ps-4">{t('homecaisse.table.th_transaction')}</th>
                                    <th>{t('homecaisse.table.th_amount')}</th>
                                    <th>{t('homecaisse.table.th_status')}</th>
                                    <th>{t('homecaisse.table.th_validations')}</th>
                                    <th className="text-end pe-4">{t('homecaisse.table.th_date')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lastTx.map(tx => (
                                    <tr key={tx.id} className="transaction-hover">
                                        <td className="ps-4">
                                            <div className="d-flex align-items-center py-1">
                                                <div className="d-flex align-items-center justify-content-center rounded-circle bg-light me-3" style={{ width: 40, height: 40 }}>
                                                    {tx.transaction_type === 'EXPENSE' ? '💸' : '💰'}
                                                </div>
                                                <div>
                                                    <div className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>{tx.user_firstname} {tx.user_lastname}</div>
                                                    <div className="small text-muted text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>{tx.transaction_type}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`fw-bold ${tx.transaction_type === 'EXPENSE' ? 'text-danger' : 'text-success'}`}>
                                                {tx.transaction_type === 'EXPENSE' ? '-' : '+'}{Number(tx.amount).toLocaleString('fr-FR')}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge rounded-pill fw-normal text-uppercase px-3 py-2 ${tx.status === 'VALIDATED' ? 'bg-success-subtle text-success' :
                                                tx.status === 'PENDING' ? 'bg-warning-subtle text-warning' : 'bg-secondary-subtle text-secondary'
                                                }`} style={{ fontSize: '0.7rem' }}>
                                                {tx.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="avatar-stack">
                                                {(tx.approvals || []).map((app, i) => (
                                                    <div key={i} className="avatar-circle" title={app.approved_by_username}>
                                                        {(app.approved_by_username || '?').substring(0, 2).toUpperCase()}
                                                    </div>
                                                ))}
                                                {(!tx.approvals || tx.approvals.length === 0) && <span className="text-muted small">-</span>}
                                            </div>
                                        </td>
                                        <td className="text-end pe-4 text-muted small">
                                            {new Date(tx.created_at).toLocaleDateString()}
                                            {(tx.payment_method_name && ['Orange money', 'Virement bancaire'].includes(tx.payment_method_name)) && tx.account_number ? (
                                                <span className="ms-2 text-muted" style={{fontSize: '0.95em'}}>
                                                    {t('transactions.home.accountNumber', 'N° compte')}: {tx.account_number}
                                                </span>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title={t('homecaisse.modal_title')} size="lg">
                    <AddTransaction
                        onSuccess={async () => {
                            setShowAdd(false)
                            try {
                                const transactions = await listTransactions({})
                                setTxs(transactions)
                            } catch { }
                        }}
                        onCancel={() => setShowAdd(false)}
                    />
                </Modal>
            </div>
        </>
    )
}
