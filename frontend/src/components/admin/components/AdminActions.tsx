export default function AdminActions({ onCreate, onRefresh, loading }: {
    onCreate: () => void
    onRefresh: () => void
    loading?: boolean
}) {
    return (
        <div className="d-flex admin-actions mb-3">
            <button className="btn btn-primary" onClick={onCreate}>
                <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
                Ajouter un utilisateur
            </button>
            <button className="btn btn-outline-secondary" onClick={onRefresh} disabled={loading}>
                <i className="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>
                Actualiser
            </button>
        </div>
    )
}
