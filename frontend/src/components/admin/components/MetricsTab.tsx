import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { axiosClient } from '../../../services/api'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
    AreaChart,
    Area,
} from 'recharts'
import Modal from '../../common/Modal'

const chartTexts = {
    fr: {
        memory: { title: 'Mémoire (MB)', info: 'Mémoire résidente du processus backend en mégaoctets.' },
        rps: { title: 'Requêtes/sec par statut', info: 'Taux de requêtes par seconde (deltas de compteurs).' },
        latencyAvg: { title: 'Latence moyenne par URL (ms)', info: "Moyenne sur l'intervalle (Δsum/Δcount) par chemin." },
        latencyP95: { title: 'Latence P95 par URL (ms)', info: '95e percentile estimé à partir des seaux (buckets) sur l’intervalle.' },
        network: { title: 'Trafic réseau (octets/sec)', info: 'Débit reçu/envoyé (somme de toutes les interfaces).' },
        errorRate: { title: 'Taux derreur par URL (%)', info: 'Part des réponses 4xx/5xx sur le total, par chemin.' },
        explain: 'Que montre ce graphe ?',
        raw: 'Métriques brutes',
        filterPlaceholder: 'requests_total | memory_bytes'
    },
    en: {
        memory: { title: 'Memory (MB)', info: 'Resident memory of the backend process in megabytes.' },
        rps: { title: 'Requests/sec by status', info: 'Requests per second derived from counter deltas.' },
        latencyAvg: { title: 'Average latency per URL (ms)', info: 'Average over the interval (Δsum/Δcount) per path.' },
        latencyP95: { title: 'P95 latency per URL (ms)', info: '95th percentile from histogram bucket deltas over the interval.' },
        network: { title: 'Network traffic (bytes/sec)', info: 'Received/sent throughput, summed across interfaces.' },
        errorRate: { title: 'Error rate per URL (%)', info: 'Share of 4xx/5xx responses in total per path.' },
        explain: 'What does this chart show?',
        raw: 'Raw metrics',
        filterPlaceholder: 'requests_total | memory_bytes'
    },
    ar: {
        memory: { title: 'الذاكرة (MB)', info: 'الذاكرة المقيمة لعملية الخلفية بالميغابايت.' },
        rps: { title: 'الطلبات/ثانية حسب الحالة', info: 'الطلبات في الثانية من فروق العدادات.' },
        latencyAvg: { title: 'متوسط الكمون لكل URL (مللي ثانية)', info: 'المتوسط خلال الفترة (Δsum/Δcount) لكل مسار.' },
        latencyP95: { title: 'كمون P95 لكل URL (مللي ثانية)', info: 'المئين 95 من دلاء المخطط خلال الفترة.' },
        network: { title: 'حركة الشبكة (بايت/ثانية)', info: 'معدل المُستقبَل/المُرسَل مع جمع كل الواجهات.' },
        errorRate: { title: 'معدل الأخطاء لكل URL (%)', info: 'نسبة 4xx/5xx من الإجمالي لكل مسار.' },
        explain: 'ماذا يظهر هذا الرسم؟',
        raw: 'القياسات الخام',
        filterPlaceholder: 'requests_total | memory_bytes'
    }
} as const

type ParsedMetric = {
    name: string
    labels: Record<string, string>
    value: number
}

function parsePrometheusText(text: string): ParsedMetric[] {
    const lines = text.split('\n')
    const result: ParsedMetric[] = []
    for (const raw of lines) {
        const line = raw.trim()
        if (!line || line.startsWith('#')) continue
        // pattern: name{label="value",label2="value2"} value
        const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s*(\{[^}]*\})?\s+(-?\d+(?:\.\d+)?)$/)
        if (!match) continue
        const [, name, labelBlock, valueStr] = match
        const labels: Record<string, string> = {}
        if (labelBlock) {
            const inside = labelBlock.slice(1, -1)
            const pairs = inside ? inside.split(',') : []
            for (const p of pairs) {
                const kv = p.split('=')
                if (kv.length === 2) {
                    const k = kv[0].trim()
                    const v = kv[1].trim().replace(/^"|"$/g, '')
                    labels[k] = v
                }
            }
        }
        const value = Number(valueStr)
        if (!Number.isNaN(value)) result.push({ name, labels, value })
    }
    return result
}

export default function MetricsTab() {
    const { t, i18n } = useTranslation()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState<string>('')
    const [samples, setSamples] = useState<Array<{ ts: number; metrics: ParsedMetric[] }>>([])
    const timerRef = useRef<number | null>(null)
    const [infoModal, setInfoModal] = useState<string | null>(null)
    const L = useMemo(() => (chartTexts as any)[i18n.language?.split('-')[0]] ?? chartTexts.en, [i18n.language])

    async function loadOnce() {
        setLoading(true)
        setError(null)
        try {
            const res = await axiosClient.get('/metrics', { headers: { Accept: 'text/plain' } })
            const text: string = typeof res.data === 'string' ? res.data : String(res.data)
            const parsed = parsePrometheusText(text)
            setSamples((prev) => [...prev.slice(-59), { ts: Date.now(), metrics: parsed }]) // keep last 60
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load metrics')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadOnce()
        timerRef.current = window.setInterval(loadOnce, 5000)
        return () => {
            if (timerRef.current) window.clearInterval(timerRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Build series for memory usage (bytes -> MB)
    const memorySeries = useMemo(() => {
        const points: Array<{ time: string; mb: number }> = []
        for (const s of samples) {
            const m = s.metrics.find((mm) => mm.name.includes('resident_memory_bytes') || mm.name.includes('process_resident_memory_bytes'))
            if (m) points.push({ time: new Date(s.ts).toLocaleTimeString(), mb: m.value / (1024 * 1024) })
        }
        return points
    }, [samples])

    // Build requests per second by status (delta of counters)
    const requestsPerSec = useMemo(() => {
        type GroupKey = string
        type SamplePoint = { time: string } & Record<GroupKey, number | string>
        const points: SamplePoint[] = []
        for (let i = 1; i < samples.length; i++) {
            const prev = samples[i - 1]
            const curr = samples[i]
            const dt = Math.max(1, (curr.ts - prev.ts) / 1000)
            const currReqs = curr.metrics.filter((m) => m.name.includes('requests_total'))
            const prevReqs = prev.metrics.filter((m) => m.name.includes('requests_total'))
            const mapPrev = new Map<string, number>()
            for (const m of prevReqs) {
                const key = `${m.name}|${m.labels.status ?? m.labels.status_code ?? ''}|${m.labels.method ?? ''}`
                mapPrev.set(key, m.value)
            }
            const point: SamplePoint = { time: new Date(curr.ts).toLocaleTimeString() }
            for (const m of currReqs) {
                const key = `${m.name}|${m.labels.status ?? m.labels.status_code ?? ''}|${m.labels.method ?? ''}`
                const prevVal = mapPrev.get(key) ?? m.value
                const rate = Math.max(0, (m.value - prevVal) / dt)
                point[key] = rate
            }
            points.push(point)
        }
        // Collect legend keys
        const keys = new Set<string>()
        points.forEach((p) => Object.keys(p).forEach((k) => k !== 'time' && keys.add(k)))
        return { points, keys: Array.from(keys) }
    }, [samples])

    // Average latency per URL (ms) using delta sum / delta count
    const latencyAvg = useMemo(() => {
        type SamplePoint = { time: string } & Record<string, number | string>
        const points: SamplePoint[] = []
        const pathsSet = new Set<string>()
        for (let i = 1; i < samples.length; i++) {
            const prev = samples[i - 1]
            const curr = samples[i]
            const sumCurr = curr.metrics.filter((m) => m.name.includes('http_request_duration_seconds') && m.name.endsWith('_sum'))
            const sumPrev = prev.metrics.filter((m) => m.name.includes('http_request_duration_seconds') && m.name.endsWith('_sum'))
            const cntCurr = curr.metrics.filter((m) => m.name.includes('http_request_duration_seconds') && m.name.endsWith('_count'))
            const cntPrev = prev.metrics.filter((m) => m.name.includes('http_request_duration_seconds') && m.name.endsWith('_count'))
            const sumMap = new Map<string, number>()
            for (const m of sumPrev) {
                const path = (m.labels.path || m.labels.handler || 'unknown') as string
                sumMap.set(path, m.value)
            }
            const cntMap = new Map<string, number>()
            for (const m of cntPrev) {
                const path = (m.labels.path || m.labels.handler || 'unknown') as string
                cntMap.set(path, m.value)
            }
            const point: SamplePoint = { time: new Date(curr.ts).toLocaleTimeString() }
            for (const m of sumCurr) {
                const path = (m.labels.path || m.labels.handler || 'unknown') as string
                const prevSum = sumMap.get(path) ?? m.value
                const prevCnt = cntMap.get(path) ?? 0
                const currCnt = cntCurr.find((x) => (x.labels.path || x.labels.handler || 'unknown') === path)?.value ?? prevCnt
                const dSum = Math.max(0, m.value - prevSum)
                const dCnt = Math.max(0, currCnt - prevCnt)
                if (dCnt > 0) {
                    const avgMs = (dSum / dCnt) * 1000
                    point[path] = avgMs
                    pathsSet.add(path)
                }
            }
            points.push(point)
        }
        const last = points[points.length - 1] ?? { time: '' }
        const paths = Array.from(pathsSet)
        const ranked = paths
            .map((p) => ({ p, v: (last as any)[p] ?? 0 }))
            .sort((a, b) => b.v - a.v)
            .slice(0, 5)
            .map((x) => x.p)
        const trimmed = points.map((pt) => {
            const out: any = { time: pt.time }
            for (const k of ranked) if ((pt as any)[k] != null) out[k] = (pt as any)[k]
            return out
        })
        return { points: trimmed, keys: ranked }
    }, [samples])

    // P95 latency per URL (ms) from bucket deltas
    const latencyP95 = useMemo(() => {
        type SamplePoint = { time: string } & Record<string, number | string>
        const points: SamplePoint[] = []
        const pathsSet = new Set<string>()
        for (let i = 1; i < samples.length; i++) {
            const prev = samples[i - 1]
            const curr = samples[i]
            const bPrev = prev.metrics.filter((m) => m.name.includes('http_request_duration_seconds') && m.name.endsWith('_bucket'))
            const bCurr = curr.metrics.filter((m) => m.name.includes('http_request_duration_seconds') && m.name.endsWith('_bucket'))
            const mapPrev = new Map<string, Map<number, number>>()
            for (const m of bPrev) {
                const path = (m.labels.path || m.labels.handler || 'unknown') as string
                const le = Number(m.labels.le)
                if (!mapPrev.has(path)) mapPrev.set(path, new Map())
                mapPrev.get(path)!.set(le, m.value)
            }
            const groupCurr = new Map<string, Map<number, number>>()
            for (const m of bCurr) {
                const path = (m.labels.path || m.labels.handler || 'unknown') as string
                const le = Number(m.labels.le)
                if (!groupCurr.has(path)) groupCurr.set(path, new Map())
                groupCurr.get(path)!.set(le, m.value)
            }
            const point: SamplePoint = { time: new Date(curr.ts).toLocaleTimeString() }
            for (const [path, bucketsCurr] of groupCurr.entries()) {
                const bucketsPrev = mapPrev.get(path) ?? new Map<number, number>()
                const entries = Array.from(bucketsCurr.entries()).sort((a, b) => a[0] - b[0])
                let total = 0
                const deltas: Array<[number, number]> = []
                for (const [le, val] of entries) {
                    const prevVal = bucketsPrev.get(le) ?? val
                    const d = Math.max(0, val - prevVal)
                    deltas.push([le, d])
                    total += d
                }
                if (total <= 0) continue
                const target = total * 0.95
                let acc = 0
                let p95 = deltas[deltas.length - 1][0]
                for (const [le, d] of deltas) {
                    acc += d
                    if (acc >= target) { p95 = le; break }
                }
                if (isFinite(p95)) {
                    point[path] = p95 * 1000
                    pathsSet.add(path)
                }
            }
            points.push(point)
        }
        const last = points[points.length - 1] ?? { time: '' }
        const paths = Array.from(pathsSet)
        const ranked = paths
            .map((p) => ({ p, v: (last as any)[p] ?? 0 }))
            .sort((a, b) => b.v - a.v)
            .slice(0, 5)
            .map((x) => x.p)
        const trimmed = points.map((pt) => {
            const out: any = { time: pt.time }
            for (const k of ranked) if ((pt as any)[k] != null) out[k] = (pt as any)[k]
            return out
        })
        return { points: trimmed, keys: ranked }
    }, [samples])

    // Network bytes/sec (sum across interfaces)
    const networkRates = useMemo(() => {
        const points: Array<{ time: string; recv: number; sent: number }> = []
        for (let i = 1; i < samples.length; i++) {
            const prev = samples[i - 1]
            const curr = samples[i]
            const dt = Math.max(1, (curr.ts - prev.ts) / 1000)
            const prevNet = prev.metrics.filter((m) => m.name === 'system_network_bytes')
            const currNet = curr.metrics.filter((m) => m.name === 'system_network_bytes')
            const sumByDir = (arr: ParsedMetric[], dir: string) => arr.filter((m) => m.labels.direction === dir).reduce((acc, m) => acc + m.value, 0)
            const prevRecv = sumByDir(prevNet, 'recv')
            const prevSent = sumByDir(prevNet, 'sent')
            const currRecv = sumByDir(currNet, 'recv')
            const currSent = sumByDir(currNet, 'sent')
            const dRecv = Math.max(0, currRecv - prevRecv) / dt
            const dSent = Math.max(0, currSent - prevSent) / dt
            points.push({ time: new Date(curr.ts).toLocaleTimeString(), recv: dRecv, sent: dSent })
        }
        return points
    }, [samples])

    // Error rate per URL (%) based on status codes
    const errorRate = useMemo(() => {
        type SamplePoint = { time: string } & Record<string, number | string>
        const points: SamplePoint[] = []
        const keysSet = new Set<string>()
        for (let i = 1; i < samples.length; i++) {
            const prev = samples[i - 1]
            const curr = samples[i]
            const grp = (arr: ParsedMetric[]) => {
                const map = new Map<string, Map<string, number>>()
                for (const m of arr) {
                    if (!m.name.includes('requests_total')) continue
                    const path = (m.labels.path || m.labels.handler || 'unknown') as string
                    const status = (m.labels.status || (m.labels as any).status_code || '') as string
                    if (!map.has(path)) map.set(path, new Map())
                    map.get(path)!.set(status, m.value)
                }
                return map
            }
            const prevMap = grp(prev.metrics)
            const currMap = grp(curr.metrics)
            const point: SamplePoint = { time: new Date(curr.ts).toLocaleTimeString() }
            for (const [path, currStatuses] of currMap.entries()) {
                let total = 0
                let err = 0
                for (const [status, val] of currStatuses.entries()) {
                    const prevVal = prevMap.get(path)?.get(status) ?? val
                    const d = Math.max(0, val - prevVal)
                    total += d
                    if (status.startsWith('4') || status.startsWith('5')) err += d
                }
                if (total > 0) {
                    const perc = (err / total) * 100
                    point[path] = perc
                    keysSet.add(path)
                }
            }
            points.push(point)
        }
        const last = points[points.length - 1] ?? { time: '' }
        const keys = Array.from(keysSet)
            .map((k) => ({ k, v: (last as any)[k] ?? 0 }))
            .sort((a, b) => b.v - a.v)
            .slice(0, 5)
            .map((x) => x.k)
        const trimmed = points.map((pt) => {
            const out: any = { time: pt.time }
            for (const k of keys) if ((pt as any)[k] != null) out[k] = (pt as any)[k]
            return out
        })
        return { points: trimmed, keys }
    }, [samples])

    return (
        <div className="p-2">
            <div className="d-flex align-items-center gap-2 mb-2">
                <h5 className="m-0">{t('admin.metrics.title')}</h5>
                <button className="btn btn-sm btn-outline-primary" onClick={loadOnce} disabled={loading}>
                    {t('admin.metrics.refresh')}
                </button>
                <div className="ms-auto d-flex align-items-center gap-2">
                    <label htmlFor="metrics-filter" className="form-label m-0">
                        {t('admin.metrics.filterLabel')}
                    </label>
                    <input
                        id="metrics-filter"
                        className="form-control form-control-sm"
                        placeholder={L.filterPlaceholder}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
            </div>

            {loading && <div className="text-muted">{t('admin.metrics.loading')}</div>}
            {error && <div className="text-danger">{t('admin.metrics.failed')}: {error}</div>}

            <div className="row g-3">
                <div className="col-12 col-lg-6">
                    <div className="card">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-2">
                                <h6 className="card-title m-0">{L.memory.title}</h6>
                                <button className="btn btn-sm btn-link" onClick={() => setInfoModal('memory')}>{L.explain}</button>
                            </div>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <LineChart data={memorySeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="time" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="mb" stroke="#0d6efd" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-lg-6">
                    <div className="card">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-2">
                                <h6 className="card-title m-0">{L.rps.title}</h6>
                                <button className="btn btn-sm btn-link" onClick={() => setInfoModal('rps')}>{L.explain}</button>
                            </div>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <LineChart data={requestsPerSec.points} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="time" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        {requestsPerSec.keys.map((k, idx) => (
                                            <Line key={k} type="monotone" dataKey={k} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={false} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Average latency per URL */}
                <div className="col-12 col-lg-6">
                    <div className="card">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-2">
                                <h6 className="card-title m-0">{L.latencyAvg.title}</h6>
                                <button className="btn btn-sm btn-link" onClick={() => setInfoModal('latencyAvg')}>{L.explain}</button>
                            </div>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <LineChart data={latencyAvg.points} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="time" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        {latencyAvg.keys.map((k, idx) => (
                                            <Line key={k} type="monotone" dataKey={k} stroke={COLORS[(idx + 1) % COLORS.length]} strokeWidth={2} dot={false} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>

                {/* P95 latency per URL */}
                <div className="col-12 col-lg-6">
                    <div className="card">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-2">
                                <h6 className="card-title m-0">{L.latencyP95.title}</h6>
                                <button className="btn btn-sm btn-link" onClick={() => setInfoModal('latencyP95')}>{L.explain}</button>
                            </div>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <LineChart data={latencyP95.points} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="time" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        {latencyP95.keys.map((k, idx) => (
                                            <Line key={k} type="monotone" dataKey={k} stroke={COLORS[(idx + 2) % COLORS.length]} strokeWidth={2} dot={false} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Network traffic area chart */}
                <div className="col-12">
                    <div className="card">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-2">
                                <h6 className="card-title m-0">{L.network.title}</h6>
                                <button className="btn btn-sm btn-link" onClick={() => setInfoModal('network')}>{L.explain}</button>
                            </div>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <AreaChart data={networkRates} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorRecv" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#0d6efd" stopOpacity={0.5} />
                                                <stop offset="95%" stopColor="#0d6efd" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#20c997" stopOpacity={0.5} />
                                                <stop offset="95%" stopColor="#20c997" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="time" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Area type="monotone" dataKey="recv" stroke="#0d6efd" fillOpacity={1} fill="url(#colorRecv)" />
                                        <Area type="monotone" dataKey="sent" stroke="#20c997" fillOpacity={1} fill="url(#colorSent)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error rate per URL */}
                <div className="col-12">
                    <div className="card">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-2">
                                <h6 className="card-title m-0">{L.errorRate.title}</h6>
                                <button className="btn btn-sm btn-link" onClick={() => setInfoModal('errorRate')}>{L.explain}</button>
                            </div>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <BarChart data={errorRate.points} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="time" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        {errorRate.keys.map((k, idx) => (
                                            <Bar key={k} dataKey={k} stackId="err" fill={COLORS[(idx + 3) % COLORS.length]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Modal isOpen={!!infoModal} onClose={() => setInfoModal(null)}>
                <div>
                    <h6 className="mb-2">
                        {infoModal === 'memory' ? L.memory.title : infoModal === 'rps' ? L.rps.title : infoModal === 'latencyAvg' ? L.latencyAvg.title : infoModal === 'latencyP95' ? L.latencyP95.title : infoModal === 'network' ? L.network.title : infoModal === 'errorRate' ? L.errorRate.title : ''}
                    </h6>
                    <p className="mb-0">
                        {infoModal === 'memory' ? L.memory.info : infoModal === 'rps' ? L.rps.info : infoModal === 'latencyAvg' ? L.latencyAvg.info : infoModal === 'latencyP95' ? L.latencyP95.info : infoModal === 'network' ? L.network.info : infoModal === 'errorRate' ? L.errorRate.info : ''}
                    </p>
                </div>
            </Modal>
        </div>
    )
}

const COLORS = [
    '#0d6efd', // primary
    '#198754', // success
    '#dc3545', // danger
    '#fd7e14', // warning
    '#6f42c1', // purple
    '#20c997', // teal
    '#6610f2', // indigo
    '#0dcaf0', // info
]
