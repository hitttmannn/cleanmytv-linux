import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Electron preload bridge', () => {
  it('exposes every SberBox Home action used by the renderer', () => {
    const preload = readFileSync(resolve('src/preload/index.ts'), 'utf8')
    const methods = preload.match(/const methods = \[([\s\S]*?)\] as const/)?.[1]
    expect(methods).toBeDefined()
    for (const action of ['installSberBoxHome', 'checkSberBoxHome', 'activateSberBoxHome', 'restoreSberBoxHome']) {
      expect(methods).toContain(`'${action}'`)
    }
  })
})
