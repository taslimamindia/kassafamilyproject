import { apiFetch, getJson } from './api'

export type TableInfo = { name: string; rowCount?: number }
export type DeletionOrderItem = { table: string; dependsOn: string[] }
export type PagedRows = { rows: any[]; total: number; pk: string | null }

const base = '/admin/db'

export async function listTables(): Promise<TableInfo[]> {
  return await getJson<TableInfo[]>(`${base}/tables`)
}

export async function getDeletionOrder(): Promise<DeletionOrderItem[]> {
  return await getJson<DeletionOrderItem[]>(`${base}/deletion-order`)
}

export async function listRows(table: string, page: number, size: number): Promise<PagedRows> {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  return await getJson<PagedRows>(`${base}/tables/${encodeURIComponent(table)}/rows?${params.toString()}`)
}

export async function deleteRows(table: string, ids: Array<string|number>): Promise<{deleted: number}> {
  const res = await apiFetch(`${base}/tables/${encodeURIComponent(table)}/rows`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  })
  if (!res.ok) {
    let payload: any = null
    try { payload = await res.json() } catch { try { payload = await res.text() } catch {}
    }
    const err: any = new Error(`DELETE ${table} failed: ${res.status}`)
    err.status = res.status
    err.body = payload
    throw err
  }
  return await res.json()
}
