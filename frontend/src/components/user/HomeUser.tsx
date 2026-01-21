import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { getCurrentUser, type User } from '../../services/users'
import { listTransactions, type Transaction } from '../../services/transactions'

export default function HomeUser() {
	const { t } = useTranslation()
	const [me, setMe] = useState<User | null>(null)
	const [txs, setTxs] = useState<Transaction[]>([])

	useEffect(() => {
		let mounted = true
		;(async () => {
			try {
				const [u, transactions] = await Promise.all([
					getCurrentUser(),
					listTransactions({})
				])
				if (mounted) { setMe(u); setTxs(transactions) }
			} catch {
			}
		})()
		return () => { mounted = false }
	}, [])

	const balance = useMemo(() => {
		return txs
			.filter(t => t.status === 'VALIDATED')
			.reduce((acc, t) => acc + (t.transaction_type === 'EXPENSE' ? -Number(t.amount || 0) : Number(t.amount || 0)), 0)
	}, [txs])

	function toCamelCaseName(s: string): string {
		return s
			.split(/\s+/)
			.filter(Boolean)
			.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
			.join(' ')
	}

	function Avatar({ user }: { user: User | null }) {
		const size = 64
		const style: React.CSSProperties = { width: size, height: size }
		const first = (user?.firstname || '').trim()
		const last = (user?.lastname || '').trim()
		const initials = `${first ? first[0] : ''}${last ? last[0] : ''}`.toUpperCase() || '?'
		return (
			<div className="rounded-circle d-flex align-items-center justify-content-center" style={{ ...style, background: 'linear-gradient(135deg,#e6f7ff,#ffe0f0)' }}>
				<span className="fw-bold" style={{ fontSize: '1.25rem' }}>{initials}</span>
			</div>
		)
	}

	function FeatureCard(props: {
		to: string
		title: string
		description: string
		icon: string
		highlight?: string
		bg?: string
	}) {
		const { to, title, description, icon, highlight, bg } = props
		return (
			<div className="col-12 col-md-6 col-lg-4">
				<div className="card border-0 shadow-sm rounded-4 h-100">
					<div className="card-body p-4">
						<div className="d-flex align-items-center gap-3 mb-3">
							<div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, background: bg || 'linear-gradient(135deg,#eef2ff,#e0f2fe)' }}>
								<i className={`bi ${icon}`} aria-hidden="true"></i>
							</div>
							<h5 className="mb-0 fw-bold">{title}</h5>
						</div>
						<p className="text-muted mb-3">{description}</p>
						{typeof highlight !== 'undefined' && (
							<div className="d-flex align-items-center gap-2 mb-3">
								<span className="badge bg-light text-dark rounded-pill px-3 py-2">{highlight}</span>
							</div>
						)}
						<div className="d-flex">
							<Link to={to} className="btn btn-primary fw-semibold rounded-pill">{t('homeuser.cta')}</Link>
						</div>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="container py-4">
			{/* Localized dictionary for this component */}
			{(() => {
				const resources = {
					fr: {
						homeuser: {
							welcome: 'Bienvenue',
							subtitle: 'Espace membre — retrouvez les rubriques clés et accédez rapidement aux pages principales.',
							cta: 'Voir plus',
							cards: {
								caisse: { title: 'Caisse', description: 'Consultez le solde actuel et suivez les entrées/sorties.', current_balance: 'Solde actuel' },
								transactions: { title: 'Transactions', description: 'Parcourez vos transactions et leur statut de validation.' },
								tree: { title: 'Arbre généalogique', description: 'Explorez les liens familiaux et visualisez votre arbre.' },
								chartes: { title: 'Chartes', description: 'Consultez les règles, chartes et informations utiles.' },
								profile: { title: 'Profil', description: 'Voir et mettre à jour vos informations personnelles.' },
							}
						}
					},
					en: {
						homeuser: {
							welcome: 'Welcome',
							subtitle: 'Member space — quickly access key sections and pages.',
							cta: 'See more',
							cards: {
								caisse: { title: 'Cash', description: 'Check the current balance and track incomes/expenses.', current_balance: 'Current balance' },
								transactions: { title: 'Transactions', description: 'Browse your transactions and validation status.' },
								tree: { title: 'Family Tree', description: 'Explore family links and view your tree.' },
								chartes: { title: 'Charter', description: 'Read rules, charters, and useful information.' },
								profile: { title: 'Profile', description: 'View and update your personal information.' },
							}
						}
					},
					ar: {
						homeuser: {
							welcome: 'مرحبًا',
							subtitle: 'مساحة العضو — الوصول السريع إلى الصفحات والأقسام الرئيسية.',
							cta: 'عرض المزيد',
							cards: {
								caisse: { title: 'الصندوق', description: 'تحقق من الرصيد الحالي وتتبع المداخيل والمصاريف.', current_balance: 'الرصيد الحالي' },
								transactions: { title: 'المعاملات', description: 'تصفح معاملاتك وحالة التصديق.' },
								tree: { title: 'الشجرة العائلية', description: 'استكشف الروابط العائلية واعرض شجرتك.' },
								chartes: { title: 'الميثاق', description: 'اطلع على القواعد والمواثيق والمعلومات المفيدة.' },
								profile: { title: 'الملف الشخصي', description: 'عرض وتحديث معلوماتك الشخصية.' },
							}
						}
					}
				}
				for (const [lng, res] of Object.entries(resources)) {
					i18n.addResourceBundle(lng, 'translation', res as any, true, false)
				}
				return null
			})()}
			{/* Hero / Welcome */}
			<div className="card border-0 shadow-sm rounded-4 mb-4">
				<div className="card-body">
					<div className="d-flex flex-column flex-sm-row align-items-sm-center gap-3">
						<Avatar user={me} />
						<div>
							<h3 className="mb-1">{t('homeuser.welcome')}{me ? `, ${toCamelCaseName(`${me.firstname} ${me.lastname}`)}` : ''}</h3>
							<p className="text-muted mb-0">{t('homeuser.subtitle')}</p>
						</div>
					</div>
				</div>
			</div>

			{/* Feature Grid */}
			<div className="row g-4 justify-content-center">
				<FeatureCard
					to="/caisse"
					title={t('homeuser.cards.caisse.title')}
					description={t('homeuser.cards.caisse.description')}
					icon="bi-cash-coin"
					highlight={`${t('homeuser.cards.caisse.current_balance')}: ${balance.toLocaleString('fr-FR')}`}
					bg="linear-gradient(135deg,#e0f7fa,#e8f5e9)"
				/>

				<FeatureCard
					to="/transactions"
					title={t('homeuser.cards.transactions.title')}
					description={t('homeuser.cards.transactions.description')}
					icon="bi-list-ul"
					bg="linear-gradient(135deg,#fff7ed,#f3e8ff)"
				/>

				<FeatureCard
					to="/tree"
					title={t('homeuser.cards.tree.title')}
					description={t('homeuser.cards.tree.description')}
					icon="bi-people"
					bg="linear-gradient(135deg,#e0e7ff,#dbeafe)"
				/>

				<FeatureCard
					to="/chartes"
					title={t('homeuser.cards.chartes.title')}
					description={t('homeuser.cards.chartes.description')}
					icon="bi-file-earmark-text"
					bg="linear-gradient(135deg,#fef3c7,#e0f2fe)"
				/>

				<FeatureCard
					to="/profil"
					title={t('homeuser.cards.profile.title')}
					description={t('homeuser.cards.profile.description')}
					icon="bi-person"
					bg="linear-gradient(135deg,#f5f3ff,#ecfeff)"
				/>
			</div>
		</div>
	)
}
