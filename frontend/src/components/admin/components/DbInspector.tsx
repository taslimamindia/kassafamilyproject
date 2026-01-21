import { useEffect, useMemo, useState } from 'react'
import { listTables, getDeletionOrder, listRows, deleteRows, type TableInfo, type DeletionOrderItem } from '../../../services/adminDb'

export default function DbInspector() {
    const [tables, setTables] = useState<TableInfo[]>([])
    const [order, setOrder] = useState<DeletionOrderItem[]>([])
    const [selectedTable, setSelectedTable] = useState<string | null>(null)
    const [rows, setRows] = useState<any[]>([])
    const [page, setPage] = useState(1)
    const [pageSize] = useState(50)
    const [total, setTotal] = useState(0)
    const [pk, setPk] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        refreshAll()
    }, [])

    async function refreshAll() {
        setError(null)
        try {
            setLoading(true)
            const [t, o] = await Promise.all([listTables(), getDeletionOrder()])
            setTables(t)
            setOrder(o)
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load database info')
        } finally {
            setLoading(false)
        }
    }

    async function openTable(table: string, p = 1) {
        setError(null)
        setSelectedTable(table)
        setPage(p)
        setSelectedIds(new Set())
        try {
            setLoading(true)
            const data = await listRows(table, p, pageSize)
            setRows(data.rows || [])
            setTotal(data.total || 0)
            setPk(data.pk ?? null)
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load rows')
        } finally {
            setLoading(false)
        }
    }

    function toggleSelect(id: any) {
        const s = new Set(selectedIds)
        if (s.has(id)) s.delete(id)
        else s.add(id)
        setSelectedIds(s)
    }

    async function confirmAndDelete() {
        if (!selectedTable || selectedIds.size === 0) return
        const msg = `Confirmer la suppression de ${selectedIds.size} ligne(s) dans la table ${selectedTable} ?\n\nAstuce: commencez par les tables listées en tête de l'ordre de suppression pour éviter les erreurs de clés étrangères.`
        if (!window.confirm(msg)) return
        try {
            setLoading(true)
            await deleteRows(selectedTable, Array.from(selectedIds))
            await openTable(selectedTable, page)
            await refreshAll()
        } catch (e: any) {
            const detail = e?.body?.detail || e?.message || 'Suppression échouée'
            alert(typeof detail === 'string' ? detail : JSON.stringify(detail))
        } finally {
            setLoading(false)
        }
    }

    function toggleSelectAllVisible() {
        if (!rows || rows.length === 0) return
        const allIds = rows.map((r, idx) => r.id ?? r[pk ?? 'id'] ?? idx)
        if (allIds.length === selectedIds.size && allIds.every(id => selectedIds.has(id))) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(allIds))
        }
    }

    const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / pageSize)), [total, pageSize])

    return (
        <div>
            <div className="d-flex align-items-center mb-3">
                <h4 className="me-3 mb-0">Database Inspector</h4>
                <button className="btn btn-sm btn-outline-secondary me-2" onClick={refreshAll} disabled={loading}>Actualiser</button>
            </div>

            {error && <div className="alert alert-danger py-2">{error}</div>}

            <div className="row">
                <div className="col-md-4">
                    <h6 className="mb-2">Tables (cliquer pour voir les lignes)</h6>
                    <ul className="list-group">
                        {tables.map(t => (
                            <li key={t.name} className={`list-group-item d-flex justify-content-between align-items-center ${selectedTable === t.name ? 'active' : ''}`} style={{ cursor: 'pointer' }} onClick={() => openTable(t.name)}>
                                <span>{t.name}</span>
                                <span className="badge bg-primary rounded-pill">{t.rowCount ?? '-'}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="col-md-8">
                    <h6 className="mb-2">Ordre de suppression suggéré</h6>
                    <ol className="small">
                        {order.map(o => (
                            <li key={o.table}><strong>{o.table}</strong>{o.dependsOn?.length ? <> — dépend de: {o.dependsOn.join(', ')}</> : null}</li>
                        ))}
                    </ol>

                    {selectedTable && (
                        <div className="mt-3">
                            <div className="d-flex align-items-center mb-2">
                                <h6 className="mb-0 me-3">{selectedTable}</h6>
                                <button className="btn btn-sm btn-outline-secondary me-2" disabled={loading || rows.length === 0} onClick={toggleSelectAllVisible} title="Sélectionner / désélectionner tout visible">
                                    {rows.length > 0 && selectedIds.size === rows.length ? 'Tout décocher' : 'Tout sélectionner'}
                                </button>
                                <button className="btn btn-sm btn-danger" disabled={selectedIds.size === 0 || loading} onClick={confirmAndDelete}>Supprimer la sélection</button>
                                <span className="ms-3 small text-muted">{selectedIds.size} sélectionnée(s)</span>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-sm table-striped align-middle">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '32px' }}></th>
                                            <th>ID{pk ? ` (${pk})` : ''}</th>
                                            <th>Contenu</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r, idx) => {
                                            const id = r.id ?? r[pk ?? 'id'] ?? idx
                                            return (
                                                <tr key={String(id)}>
                                                    <td><input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleSelect(id)} /></td>
                                                    <td>{String(id)}</td>
                                                    <td><pre className="m-0" style={{ whiteSpace: 'pre-wrap', maxHeight: 150, overflow: 'auto' }}>{JSON.stringify(r, null, 2)}</pre></td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="d-flex justify-content-between align-items-center">
                                <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1 || loading} onClick={() => openTable(selectedTable, page - 1)}>Précédent</button>
                                <div className="small">Page {page} / {totalPages} — Total: {total}</div>
                                <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages || loading} onClick={() => openTable(selectedTable, page + 1)}>Suivant</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
