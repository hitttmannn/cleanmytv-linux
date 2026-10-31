import { useEffect, useState } from 'react'
import type { Diagnostics as Report } from '@shared/api'
import type { ScreenProps } from '../App'
import { Busy, errorText } from '../components/ui'

export function Diagnostics({ status }: ScreenProps): React.ReactElement {
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function refresh(): Promise<void> {
    setBusy(true); setError('')
    try { setReport(await window.cytv.diagnostics()) } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  useEffect(() => { void refresh() }, [status.host])
  const m = report?.memory
  return <>
    <h1>Диагностика</h1>
    <p className="lede">Измерения устройства через ADB. Load average — среднее число задач за 1, 5 и 15 минут, а не процент загрузки CPU.</p>
    <button className="btn primary" disabled={busy} onClick={refresh}>{report ? 'Измерить повторно после очистки' : 'Измерить'}</button>
    {busy && <Busy text="Считываем состояние устройства" />}
    {error && <div className="notice warn">{error}</div>}
    {report && <div className="card white" style={{ marginTop: 16 }}>
      <h2>{report.model} · Android {report.android}</h2>
      <p className="muted small">Снято {new Date(report.at).toLocaleString()} · Сборка {report.build} · Платформа {report.platform}</p>
      <div className="stat-row">
        <div className="stat"><b>{m ? `${m.totalMiB} МиБ` : '—'}</b><span>Всего RAM</span></div>
        <div className="stat"><b>{m ? `${m.availableMiB} МиБ` : '—'}</b><span>Доступно (MemAvailable)</span></div>
        <div className="stat"><b>{m ? `${m.freeMiB} МиБ` : '—'}</b><span>Свободно (MemFree)</span></div>
        <div className="stat"><b>{m ? `${m.swapMiB} МиБ` : '—'}</b><span>Swap</span></div>
      </div>
      <p><b>CPU:</b> {report.cpuPercent === undefined ? 'Недоступно' : `${report.cpuPercent}% за 0,5 с`} · <b>Load average:</b> {report.load?.join(' / ') ?? 'Недоступно'}</p>
      <h3>Активные процессы</h3><pre className="mono small" style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{report.processes?.join('\n') || 'Недоступно'}</pre>
      <h3>Раздел /data</h3><pre className="mono small" style={{ whiteSpace: 'pre-wrap' }}>{report.data || 'Недоступно'}</pre>
      {report.warnings.map((w, i) => <div key={i} className="notice warn">{w}</div>)}
    </div>}
  </>
}
