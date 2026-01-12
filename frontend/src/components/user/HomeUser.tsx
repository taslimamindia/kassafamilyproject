import { useEffect, useState } from 'react'
import { getCurrentUser, type User } from '../../services/users'

export default function HomeUser() {
	const [me, setMe] = useState<User | null>(null)

	useEffect(() => {
		let mounted = true
		getCurrentUser().then(u => { if (mounted) setMe(u) }).catch(() => {})
		return () => { mounted = false }
	}, [])

	return (
		<div className="container py-4">
			<div className="card border-0 shadow-sm rounded-4">
				<div className="card-body">
					<h3 className="mb-2">Bienvenue</h3>
					<p className="text-muted mb-3">Page d’accueil utilisateur</p>
					{me && (
						<div className="d-flex align-items-center gap-3">
							<div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 64, height: 64, background: 'linear-gradient(135deg,#e6f7ff,#ffe0f0)' }}>
								<span className="fw-bold" style={{ fontSize: '1.25rem' }}>{(me.firstname || '?').charAt(0).toUpperCase()}{(me.lastname || '').charAt(0).toUpperCase()}</span>
							</div>
							<div>
								<div className="fw-semibold">{me.firstname} {me.lastname}</div>
								<div className="text-muted small">@{me.username}</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
