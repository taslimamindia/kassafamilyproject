function normalize(val: unknown): string {
    if (val === null || val === undefined) return ''
    const s = String(val)
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip diacritics
}

export function filterRows<T>(rows: T[], query: string, selectors: Array<(row: T) => unknown>): T[] {
    const q = (query || '').trim()
    if (!q) return rows
    const tokens = q.split(/\s+/).map(t => normalize(t)).filter(Boolean)
    if (!tokens.length) return rows

    return rows.filter(row => {
        // Each token must match at least one selector value (AND across tokens, OR across selectors)
        return tokens.every(token => {
            for (const sel of selectors) {
                let val: unknown
                try { val = sel(row) } catch { val = undefined }
                if (val === null || val === undefined) continue
                if (Array.isArray(val)) {
                    const anyMatch = val.some(v => normalize(v).includes(token))
                    if (anyMatch) return true
                } else {
                    const s = normalize(val)
                    if (s.includes(token)) return true
                }
            }
            return false
        })
    })
}
