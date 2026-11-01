import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { configurePaths } from '../src/main/paths'
import { classify, isProtectedPackage } from '../src/main/staros'
import * as D from '../src/main/debloat'
import * as T from '../src/main/tv'
import * as H from '../src/main/home'
import { measure, parseMemory, cpuUsage } from '../src/main/diagnostics'
import { newTv, startFakeAdbd, type FakeTv } from './fake-adbd'
import type { Server } from 'node:net'
import type { Probe } from '../src/shared/api'

const home = mkdtempSync(join(tmpdir(), 'cytv-sber-'))
process.env.HOME = home
configurePaths(resolve('resources'), join(home, 'data'))
const probe: Probe = { host: '127.0.0.1', model: 'SberBox', device: 'sberbox', product: 'sberbox', manufacturer: 'SberDevices', release: '13', sdk: 33, build: 'TQ3A.230901.001.C3', adbSecure: '1' }

describe('StarOS detection and guards', () => {
  it('recognizes original SberBox using several properties', () => {
    expect(classify(probe)).toBe('sberbox-original')
    expect(D.lists(probe).map((x) => x.id)).toEqual(['sberbox-original'])
  })
  it('does not mistake Sber Salute televisions or unknown StarOS for SberBox', () => {
    expect(classify({ ...probe, device: 'salutetv', model: 'Sber Salute TV 43' })).toBe('unknown-staros')
    expect(classify({ ...probe, manufacturer: 'Other' })).toBe('unknown-staros')
    expect(D.lists({ ...probe, device: 'unknown' })).toEqual([])
  })
  it('protects launcher and core services, including manual input', () => {
    for (const p of ['ru.sberdevices.starlauncher', 'ru.sberdevices.services.core', 'ru.sberdevices.SberDevicesServiceSystem', 'com.android.systemui', 'android', 'ru.sberdevices.remote.service'])
      expect(isProtectedPackage(p, probe)).toBe(true)
  })
  it('parses available and free memory separately; CPU from two samples', () => {
    expect(parseMemory('MemTotal: 2048000 kB\nMemAvailable: 768000 kB\nMemFree: 102400 kB\nSwapTotal: 0 kB\n')).toEqual({ totalMiB: 2000, availableMiB: 750, freeMiB: 100, swapMiB: 0 })
    expect(cpuUsage('cpu  100 0 100 800 0\n', 'cpu  130 0 120 850 0\n')).toBe(50)
  })
})

describe('SberBox with fake ADB', () => {
  let tv: FakeTv, server: Server, port: number
  beforeAll(async () => {
    tv = newTv(); tv.maxData = 256 * 1024; tv.model = probe.model; tv.device = probe.device; tv.manufacturer = probe.manufacturer; tv.release = '13'; tv.build = probe.build; tv.sdk = '33'
    for (const p of ['com.estrongs.android.pop', 'com.apkpure.aegon', 'ru.sberdevices.survey', 'ru.sberdevices.starlauncher']) tv.packages.set(p, 'enabled')
    tv.packages.set('android', 'enabled')
    tv.packages.set('ru.sberdevices.music', 'disabled')
    ;({ server, port } = await startFakeAdbd(tv))
    T.init(join(home, 'data', 'adbkey'), () => {})
    expect((await T.connect(`127.0.0.1:${port}`)).state).toBe('connected')
  })
  afterAll(() => { T.disconnect(); server.close() })
  it('shows absent optional packages and no default selections', async () => {
    const p = await D.plan('sberbox-original')
    expect(p.entries.find((x) => x.pkg === 'ru.sberdevices.openbeta')?.state).toBe('absent')
    expect(p.entries.every((x) => !x.suggested)).toBe(true)
    await expect(D.apply({ listId: 'sberbox-original', disable: ['ru.sberdevices.starlauncher'], enable: [] })).rejects.toThrow(/protected|candidates/)
    await expect(D.apply({ listId: 'custom', disable: ['com.estrongs.android.pop'], enable: [] })).rejects.toThrow()
  })
  it('saves a full snapshot before disabling, and restores only changed packages', async () => {
    const r = await D.apply({ listId: 'sberbox-original', disable: ['com.estrongs.android.pop', 'ru.sberdevices.music', 'ru.sberdevices.openbeta'], enable: [] })
    expect(r.warnings.join(' ')).toMatch(/not installed/)
    expect(tv.packages.get('com.estrongs.android.pop')).toBe('disabled')
    const p = await D.plan('sberbox-original')
    const j = JSON.parse(readFileSync(p.record!.path, 'utf8'))
    expect(j.operations[0].installed).toContain('com.estrongs.android.pop')
    expect(j.operations[0].disabled).toContain('ru.sberdevices.music')
    expect(j.operations[0].changed).toEqual(['com.estrongs.android.pop'])
    const restored = await D.restore('sberbox-original')
    expect(restored.ok).toBe(true)
    expect(tv.packages.get('com.estrongs.android.pop')).toBe('enabled')
    expect(tv.packages.get('ru.sberdevices.music')).toBe('disabled')
  })
  it('reports ADB operation failures for individual packages', async () => {
    tv.disableFails = ['com.apkpure.aegon']
    const r = await D.apply({ listId: 'sberbox-original', disable: ['com.apkpure.aegon'], enable: [] })
    expect(r.ok).toBe(false); expect(r.warnings[0]).toMatch(/com.apkpure.aegon/)
    expect(tv.packages.get('com.apkpure.aegon')).toBe('enabled')
  })
  it('installs and launches Home without changing the Sber launcher or HOME choice', async () => {
    tv.home = 'ru.sberdevices.starlauncher/.MainActivity'
    tv.homeClaims = [tv.home]
    const before = tv.commands.length
    expect((await H.installOnly()).ok).toBe(true)
    expect(tv.home).toBe('ru.sberdevices.starlauncher/.MainActivity')
    expect(tv.packages.get('ru.sberdevices.starlauncher')).toBe('enabled')
    expect(tv.commands.slice(before).some((c) => c.includes('disable-user') || c.includes('set-home-activity'))).toBe(false)
    expect((await H.checkOnSberBox()).ok).toBe(true)
  })
  it('reports a rejected HOME change and keeps the saved stock choice', async () => {
    tv.homeStuck = true
    const failed = await H.activateOnSberBox()
    expect(failed.ok).toBe(false)
    expect(tv.home).toBe('ru.sberdevices.starlauncher/.MainActivity')
    expect(tv.packages.get('ru.sberdevices.starlauncher')).toBe('enabled')
    tv.homeStuck = false
    expect((await H.activateOnSberBox()).ok).toBe(true)
    expect((await H.restoreSberBoxHome()).ok).toBe(true)
    expect(tv.home).toBe('ru.sberdevices.starlauncher/.MainActivity')
  })
  it('keeps partial diagnostics when /proc is inaccessible', async () => {
    tv.procDenied = true
    const d = await measure()
    expect(d.memory).toBeUndefined(); expect(d.load).toBeUndefined()
    expect(d.data).toContain('/data'); expect(d.warnings.join(' ')).toMatch(/unavailable/)
  })
  it('refuses a damaged restore record before sending a package command', async () => {
    const file = (await D.plan('sberbox-original')).record!.path
    const original = readFileSync(file, 'utf8')
    const j = JSON.parse(original)
    j.operations[0].changed.push('ru.sberdevices.starlauncher')
    writeFileSync(file, JSON.stringify(j))
    const before = tv.commands.length
    await expect(D.restore('sberbox-original')).rejects.toThrow(/damaged/)
    expect(tv.commands.length).toBe(before)
    writeFileSync(file, original)
  })
})
