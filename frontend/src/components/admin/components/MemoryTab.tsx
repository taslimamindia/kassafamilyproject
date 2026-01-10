import { useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE_URL } from '../../../services/api'
import { getToken } from '../../../services/auth'
import Modal from '../../common/Modal'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'

function formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    const val = bytes / Math.pow(1024, i)
    return `${val.toFixed(1)} ${sizes[i]}`
}

type MemoryPayload = {
    total: number
    available: number
    used: number
    percent: number
    rss: number
    proc_percent?: number
    ts: string
}

function Sparkline({ data, width = 240, height = 60, color = '#0d6efd', min = 0, max = 100 }: {
    data: number[]
    width?: number
    height?: number
    color?: string
    min?: number
    max?: number
}) {
    const n = data.length
    if (n < 2) {
        return (
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                <line x1={0} y1={height} x2={width} y2={height} stroke="#e9ecef" strokeWidth={1} />
            </svg>
        )
    }
    const clamp = (v: number) => Math.max(min, Math.min(max, v))
    const scaleY = (v: number) => {
        const t = (clamp(v) - min) / (max - min || 1)
        return height - t * height
    }
    const stepX = width / (n - 1)
    const d = data
        .map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${scaleY(v)}`)
        .join(' ')
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={d} fill="none" stroke={color} strokeWidth={2} />
            {/* Fill under curve */}
            <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill="url(#sparkGrad)" />
        </svg>
    )
}

export default function MemoryTab() {
    // Localized dictionary for this component
    const memoryResources = {
        en: {
            memory: {
                ws: 'WS',
                updated: 'Updated',
                metrics: {
                    total: { label: 'Total', desc: 'Total physical memory installed on the system.' },
                    used: { label: 'Used', desc: 'Estimated memory currently used by the system. Includes cached/buffered memory depending on the OS.' },
                    rss: { label: 'Process RSS', desc: 'Resident Set Size: memory pages of the backend process that currently reside in RAM (excludes swapped-out memory).' },
                    systemPercent: { label: 'System Memory %', desc: 'Overall system memory utilization percentage across all processes.' },
                    procPercent: { label: 'Backend Process %', desc: 'Share of total system memory consumed by the backend process.' },
                },
            },
        },
        fr: {
            memory: {
                ws: 'WS',
                updated: 'Mis à jour',
                metrics: {
                    total: { label: 'Total', desc: 'Mémoire physique totale installée sur le système.' },
                    used: { label: 'Utilisée', desc: 'Mémoire estimée actuellement utilisée par le système. Selon l’OS, inclut la mémoire en cache/tampon.' },
                    rss: { label: 'RSS du processus', desc: 'Resident Set Size : pages mémoire du processus backend résidant en RAM (hors mémoire swappée).' },
                    systemPercent: { label: 'Mémoire système %', desc: 'Pourcentage global d’utilisation de la mémoire système, tous processus confondus.' },
                    procPercent: { label: 'Processus backend %', desc: 'Part de la mémoire système totale consommée par le processus backend.' },
                },
            },
        },
    }
    for (const [lng, res] of Object.entries(memoryResources)) {
        i18n.addResourceBundle(lng, 'translation', res as any, true, false)
    }
    const { t } = useTranslation()
    const [data, setData] = useState<MemoryPayload | null>(null)
    const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting')
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectTimer = useRef<number | null>(null)
    const [sysSeries, setSysSeries] = useState<number[]>([])
    const [procSeries, setProcSeries] = useState<number[]>([])
    const [infoKey, setInfoKey] = useState<null | 'total' | 'used' | 'rss' | 'systemPercent' | 'procPercent'>(null)

    const wsUrl = useMemo(() => {
        const token = getToken()
        const base = API_BASE_URL.startsWith('https')
            ? API_BASE_URL.replace('https', 'wss')
            : API_BASE_URL.replace('http', 'ws')
        const qp = token ? `?token=${encodeURIComponent(token)}` : ''
        return `${base}/ws/memory${qp}`
    }, [])

    useEffect(() => {
        function connect() {
            try {
                setStatus('connecting')
                const ws = new WebSocket(wsUrl)
                wsRef.current = ws
                ws.onopen = () => setStatus('open')
                ws.onmessage = (ev) => {
                    try {
                        const payload = JSON.parse(ev.data) as MemoryPayload
                        setData(payload)
                        // Append to history (keep last N points)
                        const HISTORY = 120 // ~2 minutes at 1s interval
                        setSysSeries((prev) => {
                            const next = [...prev, payload.percent]
                            if (next.length > HISTORY) next.shift()
                            return next
                        })
                        if (typeof payload.proc_percent === 'number') {
                            setProcSeries((prev) => {
                                const next = [...prev, payload.proc_percent as number]
                                if (next.length > HISTORY) next.shift()
                                return next
                            })
                        }
                    } catch {
                        // ignore bad payloads
                    }
                }
                ws.onclose = () => {
                    setStatus('closed')
                    // Attempt reconnect after short delay
                    if (!reconnectTimer.current) {
                        reconnectTimer.current = window.setTimeout(() => {
                            reconnectTimer.current = null
                            connect()
                        }, 2000)
                    }
                }
                ws.onerror = () => setStatus('error')
            } catch {
                setStatus('error')
            }
        }
        connect()
        return () => {
            if (reconnectTimer.current) {
                window.clearTimeout(reconnectTimer.current)
                reconnectTimer.current = null
            }
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                try { wsRef.current.close() } catch {}
            }
            wsRef.current = null
        }
    }, [wsUrl])

    const percent = data?.percent ?? 0

    return (
        <div className="p-3">
            <div className="d-flex align-items-center gap-2 mb-3">
                <span className="badge text-bg-secondary">{t('memory.ws')}: {status}</span>
                {data && <span className="badge text-bg-info">{t('memory.updated')}: {new Date(data.ts).toLocaleTimeString()}</span>}
                {data && typeof data.rss === 'number' && typeof data.proc_percent === 'number' && (
                    <span className="badge text-bg-primary">
                        {t('memory.metrics.procPercent.label')}: {formatBytes(data.rss)} ({data.proc_percent.toFixed(2)}%)
                    </span>
                )}
            </div>

            <div className="mb-3">
                <div className="d-flex justify-content-between">
                    <strong>{t('memory.metrics.systemPercent.label')}</strong>
                    <i className="bi bi-info-circle ms-2" role="button" aria-label="info" onClick={() => setInfoKey('systemPercent')}></i>
                    <span>{percent.toFixed(1)}%</span>
                </div>
                <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                    <div className="progress-bar" style={{ width: `${percent}%` }} />
                </div>
            </div>

            {data && (
                <div className="row g-3">
                    <div className="col-md-6 col-lg-4">
                        <div className="card">
                            <div className="card-body">
                                <div className="fw-bold d-flex align-items-center">
                                    <span>{t('memory.metrics.total.label')}</span>
                                    <i className="bi bi-info-circle ms-2" role="button" aria-label="info" onClick={() => setInfoKey('total')}></i>
                                </div>
                                <div>{formatBytes(data.total)}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6 col-lg-4">
                        <div className="card">
                            <div className="card-body">
                                <div className="fw-bold d-flex align-items-center">
                                    <span>{t('memory.metrics.used.label')}</span>
                                    <i className="bi bi-info-circle ms-2" role="button" aria-label="info" onClick={() => setInfoKey('used')}></i>
                                </div>
                                <div>{formatBytes(data.used)}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6 col-lg-4">
                        <div className="card">
                            <div className="card-body">
                                <div className="fw-bold d-flex align-items-center">
                                    <span>{t('memory.metrics.rss.label')}</span>
                                    <i className="bi bi-info-circle ms-2" role="button" aria-label="info" onClick={() => setInfoKey('rss')}></i>
                                </div>
                                <div>{formatBytes(data.rss)}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-lg-6">
                        <div className="card">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <div className="fw-bold d-flex align-items-center">
                                        <span>{t('memory.metrics.systemPercent.label')}</span>
                                        <i className="bi bi-info-circle ms-2" role="button" aria-label="info" onClick={() => setInfoKey('systemPercent')}></i>
                                    </div>
                                    <div>{(sysSeries.at(-1) ?? data.percent).toFixed(1)}%</div>
                                </div>
                                <Sparkline data={sysSeries.length ? sysSeries : [data.percent]} width={360} height={80} color="#0d6efd" />
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-lg-6">
                        <div className="card">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <div className="fw-bold d-flex align-items-center">
                                        <span>{t('memory.metrics.procPercent.label')}</span>
                                        <i className="bi bi-info-circle ms-2" role="button" aria-label="info" onClick={() => setInfoKey('procPercent')}></i>
                                    </div>
                                    <div>{(procSeries.at(-1) ?? (data.proc_percent ?? 0)).toFixed(2)}%</div>
                                </div>
                                <Sparkline data={procSeries.length ? procSeries : [data.proc_percent ?? 0]} width={360} height={80} color="#20c997" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Modal
                isOpen={infoKey !== null}
                onClose={() => setInfoKey(null)}
                title={infoKey ? t(`memory.metrics.${infoKey}.label`) : ''}
            >
                <p className="mb-0">{infoKey ? t(`memory.metrics.${infoKey}.desc`) : ''}</p>
            </Modal>
        </div>
    )
}
