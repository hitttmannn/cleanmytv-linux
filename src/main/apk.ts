import { openSync, closeSync, fstatSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import * as T from './tv'
import type { ApplyResult } from '@shared/api'

export function readApk(path: string): Buffer {
  const fd = openSync(path, 'r')
  try {
    const st = fstatSync(fd)
    if (!st.isFile() || st.size < 4 || st.size > 512 * 1024 * 1024) throw new Error('Choose an APK file smaller than 512 MiB.')
    const apk = readFileSync(fd)
    if (apk.readUInt32LE(0) !== 0x04034b50) throw new Error('The selected file is not an APK/ZIP archive.')
    return apk
  } finally { closeSync(fd) }
}

/** Deliberately no launcher activation, permission grants, downgrade or uninstall. */
export async function installApk(apk: Buffer): Promise<ApplyResult> {
  const tmp = `/data/local/tmp/cmtv-${randomUUID()}.apk`
  try {
    await T.pushB64('install', apk, tmp)
    const out = await T.sh('install', `pm install -r ${tmp}`, { timeoutMs: 300000 })
    const ok = /^Success\s*$/m.test(out)
    return { ok, summary: ok ? 'APK installed. The stock launcher and default Home app were left unchanged.' : 'APK installation failed.', warnings: ok ? [] : [out.trim()] }
  } finally {
    try { await T.sh('install', `rm -f ${tmp}`) } catch { /* disconnected: only a temporary APK remains */ }
  }
}
