import * as T from './tv'
import type { Diagnostics } from '@shared/api'

export function parseMemory(text: string): Diagnostics['memory'] {
  const value = (key: string): number | undefined => {
    const m = new RegExp(`^${key}:\\s+(\\d+)\\s+kB`, 'm').exec(text)
    return m ? Math.round(Number(m[1]) / 1024) : undefined
  }
  const totalMiB = value('MemTotal'), availableMiB = value('MemAvailable'), freeMiB = value('MemFree'), swapMiB = value('SwapTotal')
  return [totalMiB, availableMiB, freeMiB, swapMiB].every((n) => n !== undefined)
    ? { totalMiB: totalMiB!, availableMiB: availableMiB!, freeMiB: freeMiB!, swapMiB: swapMiB! } : undefined
}

export function parseLoad(text: string): Diagnostics['load'] {
  const m = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/.exec(text.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined
}

function cpuTimes(text: string): { busy: number; total: number } | undefined {
  const line = text.split('\n').find((x) => /^cpu\s/.test(x))
  if (!line) return
  const n = line.trim().split(/\s+/).slice(1).map(Number)
  if (n.length < 4 || n.some((x) => !Number.isFinite(x))) return
  const total = n.reduce((a, b) => a + b, 0)
  return { total, busy: total - n[3] - (n[4] ?? 0) }
}

export function cpuUsage(before: string, after: string): number | undefined {
  const a = cpuTimes(before), b = cpuTimes(after)
  if (!a || !b || b.total <= a.total) return
  return Math.max(0, Math.min(100, Math.round(1000 * (b.busy - a.busy) / (b.total - a.total)) / 10))
}

export async function measure(): Promise<Diagnostics> {
  const probe = T.getStatus().probe
  if (!probe) throw new Error('Connect to a device first.')
  const d: Diagnostics = { at: new Date().toISOString(), model: probe.model, android: probe.release, build: probe.build, platform: '', warnings: [] }
  const read = async (label: string, command: string): Promise<string> => {
    try {
      const out = await T.sh('diagnostics', command, { quiet: true, timeoutMs: 10000 })
      if (/permission denied|not permitted|no such file/i.test(out)) throw new Error(out.trim())
      return out
    } catch (e) { d.warnings.push(`${label} unavailable: ${(e as Error).message}`); return '' }
  }
  d.platform = (await read('hardware platform', 'getprop ro.hardware')).trim() || 'Unknown'
  const memory = await read('memory', 'cat /proc/meminfo')
  d.memory = parseMemory(memory)
  if (!d.memory && memory) d.warnings.push('Memory fields are incomplete.')
  const load = await read('load average', 'cat /proc/loadavg')
  d.load = parseLoad(load)
  if (!d.load && load) d.warnings.push('Load average could not be parsed.')
  const before = await read('CPU', 'cat /proc/stat')
  if (before) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const after = await read('CPU', 'cat /proc/stat')
    d.cpuPercent = cpuUsage(before, after)
    if (d.cpuPercent === undefined && after) d.warnings.push('CPU usage could not be calculated.')
  }
  const top = await read('active processes', 'top -b -n 1 -m 8')
  if (top) d.processes = top.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 16)
  d.data = (await read('/data storage', 'df -h /data')).trim() || undefined
  return d
}
