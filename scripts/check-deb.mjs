import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const deb = process.argv[2] || join('dist', readdirSync('dist').filter((n) => n.endsWith('-amd64.deb')).sort().at(-1))
const root = mkdtempSync(join(tmpdir(), 'cleanmytv-deb-'))
try {
  assert.equal(execFileSync('dpkg-deb', ['-f', deb, 'Architecture'], { encoding: 'utf8' }).trim(), 'amd64')
  execFileSync('dpkg-deb', ['-x', deb, root])
  const desktop = readFileSync(join(root, 'usr/share/applications/cleanmytv.desktop'), 'utf8')
  assert.match(desktop, /^Icon=cleanmytv$/m)
  assert.match(desktop, /^StartupWMClass=cleanmytv$/m)
  assert.match(desktop, /^Exec="\/opt\/CleanMyTV Linux\/cleanmytv" %U$/m)
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) {
    const png = readFileSync(join(root, `usr/share/icons/hicolor/${size}x${size}/apps/cleanmytv.png`))
    assert.equal(png.subarray(1, 4).toString(), 'PNG')
    assert.equal(png.readUInt32BE(16), size)
    assert.equal(png.readUInt32BE(20), size)
  }
  const windowIcon = readFileSync(join(root, 'opt/CleanMyTV Linux/resources/window-icon.png'))
  assert.equal(windowIcon.readUInt32BE(16), 256)
  assert.ok(statSync(join(root, 'opt/CleanMyTV Linux/resources/home.apk')).size > 100_000)
  console.log(`Verified ${deb}: desktop launcher, nine icon sizes, window icon and bundled Home APK`)
} finally { rmSync(root, { recursive: true, force: true }) }
