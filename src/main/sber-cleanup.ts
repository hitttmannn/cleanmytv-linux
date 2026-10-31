import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as T from './tv'
import { classify, isProtectedPackage, SBER_CANDIDATES } from './staros'
import type { ApplyResult, DebloatPlan, PackageState, Probe } from '@shared/api'

interface Operation {
  at: string
  installed: string[]
  disabled: string[]
  requested: string[]
  changed: string[]
}
interface Journal { version: 1; identity: string; host: string; operations: Operation[] }

function identity(p: Probe): string { return `${p.serial || p.host}|${p.manufacturer}|${p.device}|${p.model}|${p.build}` }
function path(p: Probe): string {
  const hash = createHash('sha256').update(identity(p) + '|' + p.host).digest('hex').slice(0, 20)
  return join(homedir(), '.cleanyourtv', `sberbox-${hash}.json`)
}
function read(p: Probe): Journal | null {
  const file = path(p)
  if (!existsSync(file)) return null
  const j = JSON.parse(readFileSync(file, 'utf8')) as Journal
  if (j.version !== 1 || j.identity !== identity(p) || j.host !== p.host || !Array.isArray(j.operations))
    throw new Error('SberBox restore record does not match this device. No changes made.')
  return j
}
function save(p: Probe, j: Journal): void {
  const file = path(p)
  mkdirSync(join(file, '..'), { recursive: true, mode: 0o700 })
  writeFileSync(file + '.tmp', JSON.stringify(j, null, 2) + '\n', { mode: 0o600 })
  renameSync(file + '.tmp', file)
}
function connected(): Probe {
  const p = T.getStatus().probe
  if (!p || classify(p) !== 'sberbox-original') throw new Error('SberBox cleanup is available only for a recognized original SberBox.')
  return p
}
function state(pkg: string, installed: Set<string>, disabled: Set<string>): PackageState {
  return !installed.has(pkg) ? 'absent' : disabled.has(pkg) ? 'disabled' : 'enabled'
}

export async function plan(): Promise<DebloatPlan> {
  const p = connected()
  const sets = await T.packageSets()
  const journal = read(p)
  return {
    listId: 'sberbox-original', title: 'SberBox — StarOS / Android 13',
    header: ['All candidates need your explicit selection. Sber components have unverified dependencies. The stock launcher and core services are protected.'],
    entries: SBER_CANDIDATES.map((c) => ({
      pkg: c.pkg, note: `${c.name}: ${c.purpose}. Risk: ${c.risk}. ${c.consequence} Restore can switch it back on.`,
      suggested: false, state: state(c.pkg, sets.installed, sets.disabled),
      recorded: journal?.operations.some((o) => o.changed.includes(c.pkg)) ? 'enabled' : undefined,
      common: 0, choice: c.consequence, name: c.name, purpose: c.purpose, consequence: c.consequence,
      risk: c.risk, group: c.group
    })),
    record: journal?.operations.length ? { path: path(p), created: journal.operations[0].at } : undefined,
    homePackage: null
  }
}

export async function apply(packages: string[]): Promise<ApplyResult> {
  const p = connected()
  const allowed = new Set(SBER_CANDIDATES.map((c) => c.pkg))
  if (!Array.isArray(packages) || !packages.length || packages.some((pkg) => !allowed.has(pkg) || isProtectedPackage(pkg, p)))
    throw new Error('Select installed SberBox profile candidates only. Core packages are protected.')
  const { installed, disabled } = await T.packageSets()
  const requested = [...new Set(packages)]
  const absent = requested.filter((pkg) => !installed.has(pkg))
  const already = requested.filter((pkg) => disabled.has(pkg))
  const targets = requested.filter((pkg) => installed.has(pkg) && !disabled.has(pkg))
  const journal = read(p) ?? { version: 1 as const, identity: identity(p), host: p.host, operations: [] }
  const op: Operation = { at: new Date().toISOString(), installed: [...installed].sort(), disabled: [...disabled].sort(), requested, changed: [] }
  journal.operations.push(op)
  save(p, journal) // A full snapshot exists before the first change.
  const warnings = [...absent.map((pkg) => `${pkg}: not installed`), ...already.map((pkg) => `${pkg}: already disabled; left unchanged`)]
  for (const pkg of targets) {
    try {
      const out = await T.sh('sberbox', `pm disable-user --user 0 ${pkg}`)
      const after = await T.packageSets()
      if (!/disabled/i.test(out) || !after.disabled.has(pkg)) { warnings.push(`${pkg}: disable failed: ${out.trim() || 'no confirmation'}`); continue }
      op.changed.push(pkg)
      save(p, journal)
    } catch (e) { warnings.push(`${pkg}: ${(e as Error).message}`) }
  }
  return { ok: warnings.length === 0, summary: `Disabled ${op.changed.length} of ${requested.length} selected packages.`, warnings }
}

export async function restore(): Promise<ApplyResult> {
  const p = connected()
  const journal = read(p)
  if (!journal?.operations.length) return { ok: false, summary: 'No SberBox restore record exists.', warnings: [] }
  const warnings: string[] = []
  let count = 0
  for (const op of [...journal.operations].reverse()) {
    for (const pkg of [...op.changed]) {
      if (!op.installed.includes(pkg) || op.disabled.includes(pkg)) continue
      try {
        const before = await T.packageSets()
        if (!before.installed.has(pkg)) { warnings.push(`${pkg}: no longer installed`); continue }
        if (!before.disabled.has(pkg)) { op.changed = op.changed.filter((x) => x !== pkg); save(p, journal); continue }
        const out = await T.sh('restore', `pm enable ${pkg}`)
        const after = await T.packageSets()
        if (!/enabled/i.test(out) || after.disabled.has(pkg)) { warnings.push(`${pkg}: restore failed: ${out.trim() || 'no confirmation'}`); continue }
        op.changed = op.changed.filter((x) => x !== pkg)
        save(p, journal)
        count++
      } catch (e) { warnings.push(`${pkg}: ${(e as Error).message}`) }
    }
  }
  return { ok: warnings.length === 0, summary: `Restored ${count} packages changed by CleanMyTV.`, warnings }
}
