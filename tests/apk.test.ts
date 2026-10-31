import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
vi.mock('../src/main/tv', () => ({ pushB64: vi.fn(), sh: vi.fn() }))
import * as T from '../src/main/tv'
import { installApk, readApk } from '../src/main/apk'

beforeEach(() => vi.resetAllMocks())
describe('APK install without launcher handover', () => {
  it('only uploads, installs without downgrade/grants, and removes its temp file', async () => {
    vi.mocked(T.sh).mockResolvedValue('Success\n')
    expect((await installApk(Buffer.from('PK\x03\x04'))).ok).toBe(true)
    const path = vi.mocked(T.pushB64).mock.calls[0][2]
    expect(vi.mocked(T.sh).mock.calls.map(c => c[1])).toEqual([`pm install -r ${path}`, `rm -f ${path}`])
  })
  it('reports package manager failures and still cleans up', async () => {
    vi.mocked(T.sh).mockResolvedValue('Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE]')
    expect((await installApk(Buffer.alloc(4))).ok).toBe(false)
    expect(vi.mocked(T.sh).mock.calls.at(-1)?.[1]).toMatch(/^rm -f /)
  })
  it('cleans up after upload failure', async () => {
    vi.mocked(T.pushB64).mockRejectedValue(new Error('lost connection'))
    await expect(installApk(Buffer.alloc(4))).rejects.toThrow('lost connection')
    expect(vi.mocked(T.sh).mock.calls[0][1]).toMatch(/^rm -f /)
  })
  it('rejects non-APK content before uploading', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'apk-test-')), 'bad.apk')
    writeFileSync(path, 'not an apk')
    expect(() => readApk(path)).toThrow('not an APK')
  })
})
