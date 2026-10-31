import { useEffect, useState } from 'react'
import type { ApplyResult, DebloatPlan } from '@shared/api'
import type { ScreenProps } from '../App'
import { Busy, Confirm, ResultNotice, errorText } from '../components/ui'

export function SberBoxCleanup({ status, go }: ScreenProps): React.ReactElement {
  const [plan, setPlan] = useState<DebloatPlan | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<'apply' | 'restore' | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ApplyResult | null>(null)
  async function refresh(): Promise<void> { setPlan(await window.cytv.plan('sberbox-original')) }
  useEffect(() => { void refresh().catch((e) => setResult({ ok: false, summary: errorText(e), warnings: [] })) }, [status.host])
  const targets = plan?.entries.filter((e) => selected.has(e.pkg) && e.state === 'enabled') ?? []
  async function run(kind: 'apply' | 'restore'): Promise<void> {
    setConfirm(null); setBusy(true)
    try {
      setResult(kind === 'apply'
        ? await window.cytv.applyDebloat({ listId: 'sberbox-original', disable: targets.map((e) => e.pkg), enable: [] })
        : await window.cytv.restore('sberbox-original'))
      setSelected(new Set()); await refresh()
    } catch (e) { setResult({ ok: false, summary: errorText(e), warnings: [] }) } finally { setBusy(false) }
  }
  async function install(): Promise<void> {
    setBusy(true)
    try { setResult(await window.cytv.installLocalApk()) } catch (e) { setResult({ ok: false, summary: errorText(e), warnings: [] }) } finally { setBusy(false) }
  }
  return <>
    <h1>SberBox — StarOS / Android 13</h1>
    <p className="lede">Выберите только те приложения, которыми не пользуетесь. Все кандидаты выключены в списке по умолчанию. Системный лаунчер и основные службы защищены.</p>
    <div className="row"><button className="btn" onClick={() => go('diagnostics')}>Диагностика до/после</button><button className="btn" disabled={busy} onClick={install}>Установить локальный APK, например FLauncher</button></div>
    <p className="small muted">Установка APK не назначает его домашним экраном. Возможность запуска FLauncher и выбора HOME на вашей версии StarOS нужно проверить на самой приставке.</p>
    <ResultNotice result={result} onDismiss={() => setResult(null)} />
    {busy && <Busy text="Проверяем изменения на приставке" />}
    {!plan && !busy && <Busy text="Читаем приложения приставки" />}
    {plan && <div className="card white">
      <h2>Компоненты SberBox</h2>
      <p className="small muted">Назначение некоторых компонентов основано на названии пакета; зависимости не подтверждены. Их отключение может повлиять на функции StarOS.</p>
      {plan.record && <div className="notice">Снимок исходного состояния сохранён {new Date(plan.record.created).toLocaleString()}. Восстановление включает только пакеты, отключённые CleanMyTV.</div>}
      {(['Third-party apps', 'SberBox components'] as const).map((group) => <div key={group}>
        <h3>{group === 'Third-party apps' ? 'Сторонние приложения' : 'Компоненты SberBox'}</h3>
        {plan.entries.filter((e) => e.group === group).map((e) => <label key={e.pkg} className="card" style={{ display: 'flex', gap: 12, marginBottom: 8, cursor: e.state === 'enabled' ? 'pointer' : 'default', opacity: e.state === 'absent' ? 0.6 : 1 }}>
          <input type="checkbox" disabled={e.state !== 'enabled'} checked={selected.has(e.pkg)} onChange={(ev) => setSelected((old) => { const n = new Set(old); ev.target.checked ? n.add(e.pkg) : n.delete(e.pkg); return n })} />
          <span><b>{e.name}</b> <code>{e.pkg}</code><br /><span className="small">{e.purpose}. Возможные последствия: {e.consequence}</span><br /><span className="small muted">Состояние: {e.state === 'enabled' ? 'включено' : e.state === 'absent' ? 'не установлено' : 'уже отключено'} · Риск: {e.risk === 'high' ? 'высокий' : 'средний'} · Восстановление: {e.recorded === 'enabled' ? 'сохранено' : e.state === 'enabled' ? 'будет доступно после отключения' : 'не требуется'}</span></span>
        </label>)}
      </div>)}
      <div className="notice">Предпросмотр: будет отключено {targets.length} пакетов. Уже отключённые и отсутствующие пакеты не меняются.</div>
      <div className="row"><button className="btn primary" disabled={busy || !targets.length} onClick={() => setConfirm('apply')}>Отключить выбранные</button><button className="btn" disabled={busy || !plan.record} onClick={() => setConfirm('restore')}>Восстановить изменения</button></div>
    </div>}
    {confirm === 'apply' && <Confirm title="Отключить выбранные приложения?" confirmLabel="Отключить" onConfirm={() => void run('apply')} onCancel={() => setConfirm(null)}><p>{targets.map((e) => e.name || e.pkg).join(', ')}</p><p>Перед изменениями будет сохранено состояние всех установленных и уже отключённых пакетов.</p></Confirm>}
    {confirm === 'restore' && <Confirm title="Восстановить изменения CleanMyTV?" confirmLabel="Восстановить" onConfirm={() => void run('restore')} onCancel={() => setConfirm(null)}><p>Будут включены только пакеты, которые CleanMyTV отключил на этой приставке. Ранее отключённые вами пакеты останутся выключенными.</p></Confirm>}
  </>
}
