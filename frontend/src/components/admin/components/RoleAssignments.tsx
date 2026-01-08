import { useMemo } from 'react'
import type { RoleAttribution } from '../../../services/roleAttributions'

export default function RoleAssignments({ attributions }: { attributions: RoleAttribution[] }) {
    const grouped = useMemo(() => {
        const groups: Record<string, RoleAttribution[]> = {}
        for (const attr of attributions) {
            const roleName = attr.role || 'Sans nom'
            if (!groups[roleName]) {
                groups[roleName] = []
            }
            groups[roleName].push(attr)
        }
        return groups
    }, [attributions])

    // Sort roles alphabetically
    const sortedRoles = Object.keys(grouped).sort()

    return (
        <div className="mt-5">
            <h4 className="mb-3 border-bottom pb-2">Utilisateurs par Rôle</h4>
            <div className="row g-4">
                {sortedRoles.map(role => (
                    <div key={role} className="col-12 col-md-6 col-lg-4">
                        <div className="card h-100 border-0 shadow-sm">
                            <div className="card-header bg-primary text-white py-2">
                                <div className="d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0 fs-6 fw-bold">{role}</h5>
                                    <span className="badge bg-white text-primary rounded-pill">
                                        {grouped[role].length}
                                    </span>
                                </div>
                            </div>
                            <div className="list-group list-group-flush overflow-auto" style={{ maxHeight: '300px' }}>
                                {grouped[role].map(attr => (
                                    <div key={attr.id} className="list-group-item d-flex align-items-center px-3 py-2">
                                        <div 
                                            className="rounded-circle bg-light d-flex align-items-center justify-content-center me-3 text-secondary overflow-hidden"
                                            style={{ width: '32px', height: '32px', flexShrink: 0 }}
                                        >
                                            {attr.image_url ? (
                                                <img src={attr.image_url} alt="" className="w-100 h-100" style={{ objectFit: 'cover' }} />
                                            ) : (
                                                <i className="bi bi-person-fill"></i>
                                            )}
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className="fw-medium text-truncate" title={`${attr.firstname} ${attr.lastname}`}>
                                                {attr.firstname} {attr.lastname}
                                            </div>
                                            <div className="small text-muted text-truncate">
                                                @{attr.username}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
                {sortedRoles.length === 0 && (
                    <div className="col-12">
                        <div className="text-center text-muted py-4">
                            Aucune attribution de rôle trouvée.
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
