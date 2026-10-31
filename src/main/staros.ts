import type { Probe } from '@shared/api'

export type StarOsKind = 'sberbox-original' | 'unknown-staros' | 'other'

/** A model string alone is not evidence: Salute TV televisions also report Sber branding. */
export function classify(probe: Pick<Probe, 'device' | 'model' | 'manufacturer' | 'product' | 'release'>): StarOsKind {
  const device = probe.device.trim().toLowerCase()
  const maker = probe.manufacturer.trim().toLowerCase()
  const model = probe.model.trim().toLowerCase()
  const product = probe.product.trim().toLowerCase()
  if (device === 'sberbox' && maker.includes('sber') && model === 'sberbox' && probe.release === '13') return 'sberbox-original'
  if (maker.includes('sber') || device.startsWith('sber') || product.includes('staros')) return 'unknown-staros'
  return 'other'
}

/** Never disable the platform services, including through the manual package picker or IPC. */
export const CRITICAL_PACKAGES = new Set([
  'android', 'com.android.systemui', 'com.android.bluetooth',
  'ru.sberdevices.starlauncher', 'ru.sberdevices.services', 'ru.sberdevices.services.core',
  'ru.sberdevices.SberDevicesServiceSystem', 'ru.sberdevices.settings',
  'ru.sberdevices.rcfupdater', 'ru.sberdevices.app.setup'
].map((s) => s.toLowerCase()))

export function isProtectedPackage(pkg: string, probe?: Probe): boolean {
  const name = pkg.toLowerCase()
  if (CRITICAL_PACKAGES.has(name)) return true
  // StarOS internals are not documented well enough to disable safely. This also covers
  // remote, network, account, playback, HDMI-CEC and update services we have not identified.
  return !!probe && classify(probe) !== 'other' &&
    (name.startsWith('ru.sberdevices.') || name.startsWith('com.android.') || name.startsWith('com.google.android.')) &&
    !SBER_CANDIDATES.some((c) => c.pkg === name)
}

export interface SberCandidate {
  pkg: string
  name: string
  purpose: string
  consequence: string
  risk: 'medium' | 'high'
  group: 'Third-party apps' | 'SberBox components'
}

// Names describe likely functions, not verified dependencies. All candidates require explicit selection.
export const SBER_CANDIDATES: SberCandidate[] = [
  { pkg: 'com.estrongs.android.pop', name: 'ES File Explorer', purpose: 'Third-party file manager', consequence: 'File browsing through this app will stop.', risk: 'medium', group: 'Third-party apps' },
  { pkg: 'com.apkpure.aegon', name: 'APKPure', purpose: 'Third-party app store', consequence: 'Its app store and update notifications will stop.', risk: 'medium', group: 'Third-party apps' },
  { pkg: 'ru.sberdevices.survey', name: 'Sber survey', purpose: 'Likely survey component; dependencies unverified', consequence: 'Surveys or feedback prompts may stop.', risk: 'high', group: 'SberBox components' },
  { pkg: 'ru.sberdevices.openbeta', name: 'Sber open beta', purpose: 'Likely beta programme; dependencies unverified', consequence: 'Beta features or enrolment may stop.', risk: 'high', group: 'SberBox components' },
  { pkg: 'ru.sberdevices.smarthome.promo', name: 'Smart home promotion', purpose: 'Likely smart-home promotion; dependencies unverified', consequence: 'Smart-home recommendations may disappear.', risk: 'high', group: 'SberBox components' },
  { pkg: 'ru.sberdevices.starkidsroom.prod', name: 'Kids room', purpose: 'Likely child-oriented experience; dependencies unverified', consequence: 'Children’s content or controls may stop.', risk: 'high', group: 'SberBox components' },
  { pkg: 'ru.sberdevices.sberplay', name: 'SberPlay', purpose: 'Likely game streaming; dependencies unverified', consequence: 'SberPlay games may stop.', risk: 'high', group: 'SberBox components' },
  { pkg: 'ru.sberdevices.starbrowser', name: 'Star browser', purpose: 'Likely built-in web browser; dependencies unverified', consequence: 'Web links may no longer open in this browser.', risk: 'high', group: 'SberBox components' },
  { pkg: 'ru.sberdevices.music', name: 'Sber music', purpose: 'Likely music player; dependencies unverified', consequence: 'Music playback through Sber may stop.', risk: 'high', group: 'SberBox components' }
]
