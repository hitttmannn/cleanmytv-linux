import { app, BrowserWindow, ipcMain, session, shell, dialog, nativeImage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { configurePaths, paths } from './paths'
import { setSinks } from './log'
import * as T from './tv'
import * as debloat from './debloat'
import * as launcher from './launcher'
import * as system from './system'
import * as tools from './toolchain'
import { localSubnets, scan } from './scan'
import { reconnect } from './reconnect'
import { bootCheck } from './bootcheck'
import { check as checkUpdate, type UpdateCache } from './updates'
import { autoConnect, forgetTv, listTvs, rememberTv, setThumb } from './tvlist'
import * as web from './web'
import * as home from './home'
import { installApk, readApk } from './apk'
import { measure as diagnostics } from './diagnostics'
import { classify } from './staros'
import { createHash } from 'node:crypto'
import type { CheckItem, ConnStatus, CytvApi, KnownTv } from '@shared/api'

let win: BrowserWindow | null = null

interface Settings {
  lastHost?: string
  /** The TV that answered there, to notice a different device at the same address. */
  lastDevice?: string
  lastModel?: string
  /** Every TV connected before. With more than one, the app waits for the user to pick. */
  tvs?: KnownTv[]
  update?: UpdateCache
}

function readSettings(): Settings {
  try { return JSON.parse(readFileSync(paths.settings, 'utf8')) } catch { return {} }
}

function writeSettings(s: Settings): void {
  mkdirSync(paths.data, { recursive: true })
  writeFileSync(paths.settings, JSON.stringify(s, null, 2))
}

const knownTvs = (): KnownTv[] => listTvs(readSettings())
const remember = (host: string, st: ConnStatus): void => writeSettings(rememberTv(readSettings(), host, st))

async function checks(): Promise<CheckItem[]> {
  const st = T.getStatus()
  const connected = st.state === 'connected'
  return [
    {
      id: 'network', label: 'Local network',
      ...(localSubnets().length
        ? { status: 'ok', detail: `This computer is on ${localSubnets().map((n) => n + '.x').join(', ')}.` }
        : { status: 'missing', detail: 'No home network found. Join the same Wi-Fi or Ethernet as the TV.' })
    },
    {
      id: 'tv', label: 'TV with network debugging on',
      ...(connected
        ? { status: 'ok', detail: `${st.probe?.manufacturer} ${st.probe?.model} at ${st.host}` }
        : { status: 'missing', detail: 'Turn on Developer options and USB debugging on the TV, then find it below.' })
    },
    {
      id: 'auth', label: 'This computer allowed on the TV',
      ...(connected
        ? { status: 'ok', detail: 'The TV accepted this computer.' }
        : st.state === 'waiting-auth'
          ? { status: 'checking', detail: 'Choose Allow on the TV.' }
          : { status: 'missing', detail: 'The TV asks once, the first time you connect.' })
    },
    {
      id: 'platform-tools', label: "Google's adb (only for Wireless debugging pairing)",
      ...(tools.platformToolsReady() ? { status: 'ok', detail: tools.adbPath() } : { status: 'optional', detail: 'About 15 MB. Some Google TVs need a one-time pairing code.', download: 'platform-tools' })
    }
  ] as CheckItem[]
}

type Handlers = { [K in keyof CytvApi as CytvApi[K] extends (...a: never[]) => Promise<unknown> ? K : never]: CytvApi[K] }

const handlers: Omit<Handlers, 'onLog' | 'onProgress' | 'onStatus'> = {
  installLocalApk: async () => {
    if (!win || T.getStatus().state !== 'connected') throw new Error('Connect to a TV first.')
    const target = T.getStatus().host
    const pick = await dialog.showOpenDialog(win, { title: 'Select a trusted APK (for example FLauncher)', properties: ['openFile'], filters: [{ name: 'Android APK', extensions: ['apk'] }] })
    if (pick.canceled || !pick.filePaths[0]) return { ok: false, summary: 'Installation cancelled.', warnings: [] }
    const apk = readApk(pick.filePaths[0])
    const sha = createHash('sha256').update(apk).digest('hex')
    const answer = await dialog.showMessageBox(win, {
      type: 'question', buttons: ['Cancel', 'Install APK'], defaultId: 0, cancelId: 0,
      title: 'Install APK only', message: `Install on ${target}?`,
      detail: `${pick.filePaths[0]}\nSHA-256: ${sha}\nOnly install APKs from a source you trust. Existing app data is kept on update. The stock launcher stays enabled; this does not change the default Home app.`
    })
    if (answer.response !== 1) return { ok: false, summary: 'Installation cancelled.', warnings: [] }
    if (T.getStatus().state !== 'connected' || T.getStatus().host !== target) throw new Error('The TV connection changed. Select the APK again.')
    return installApk(apk)
  },
  scan: () => scan(),
  connect: async (host) => {
    const s = await T.connect(host)
    if (s.state === 'connected') remember(host.trim(), s)
    return s
  },
  // Only the saved address; T.connect, not handlers.connect, so a wrong device is never saved. With more
  // than one TV known, nothing connects by itself: the user picks.
  reconnect: async () => {
    if (!autoConnect(readSettings())) return null
    const s = await reconnect(readSettings(), { connect: T.connect, disconnect: T.disconnect, report: T.report })
    if (s?.state === 'connected') remember(s.host ?? readSettings().lastHost!, s)
    return s
  },
  knownTvs: async () => knownTvs(),
  connectKnown: async (host) => {
    const tv = knownTvs().find((t) => t.host === host)
    if (!tv) throw new Error('That TV is not in the list.')
    const s = await reconnect({ lastHost: tv.host, lastDevice: tv.device, lastModel: tv.model }, { connect: T.connect, disconnect: T.disconnect, report: T.report })
    if (s?.state === 'connected') remember(tv.host, s)
    return s ?? T.getStatus()
  },
  forgetTv: async (host) => {
    writeSettings(forgetTv(readSettings(), host))
    return knownTvs()
  },
  saveTvThumb: async (host, dataUrl) => {
    writeSettings(setThumb(readSettings(), host, dataUrl))
    return knownTvs()
  },

  disconnect: async () => T.disconnect(),
  status: async () => T.getStatus(),
  lastHost: async () => readSettings().lastHost ?? null,
  checkAdbClosed: (host) => system.adbClosed(host),
  bootCheck: () => bootCheck(),
  checkUpdate: async () => {
    const s = readSettings()
    const { info, cache } = await checkUpdate(app.getVersion(), s.update ?? {})
    if (cache !== s.update) writeSettings({ ...readSettings(), update: cache })
    return info
  },
  pair: async (host, pairPort, code, connectPort) => {
    const r = await tools.pair(host, pairPort, code, connectPort)
    if (r.ok) await handlers.connect(host)
    return r
  },
  checks,
  download: (tool) => tools.get(tool),
  lists: async () => debloat.lists(T.getStatus().probe),
  plan: (id) => debloat.plan(id),
  tvPackages: () => debloat.tvPackages(),
  applyDebloat: (req) => debloat.apply(req),
  restore: (id) => debloat.restore(id),
  diagnostics,
  useStockLauncher: () => launcher.useStock(),
  removeOldLauncher: () => launcher.removeOld(),
  homeStatus: () => home.status(),
  installHome: (stock) => home.install(typeof stock === 'string' ? stock : undefined),
  installSberBoxHome: () => home.installOnly(),
  checkSberBoxHome: () => home.checkOnSberBox(),
  activateSberBoxHome: () => home.activateOnSberBox(),
  restoreSberBoxHome: () => home.restoreSberBoxHome(),
  useHome: async (stock) => {
    const st = await home.status()
    if (!st.installed) return { ok: false, summary: 'CleanMyTV Home is not installed yet.', warnings: [] }
    return launcher.switchTo(`${launcher.HOME_PKG}/.MainActivity`, typeof stock === 'string' ? stock : undefined)
  },
  homeApps: () => home.apps(),
  readHomeConfig: () => home.readConfig(),
  setRemoteButtons: (on) => home.setRemoteButtons(on === true),
  homeKeys: () => home.keys(),
  setHomeConfig: (change) => home.setConfig(change ?? {}),
  setHomeWallpaper: (jpeg) => home.setWallpaper(jpeg),
  screenshot: () => system.screenshot(),
  webGet: (url) => web.get(String(url)),
  systemState: () => system.state(),
  setPrivateDns: (host) => system.privateDns(host),
  setAnimationScale: (s) => system.animationScale(s),
  key: (code) => system.key(code),
  reboot: () => system.reboot()
}

function send(channel: string, value: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, value)
}

// The dev server URL is honoured only in a dev run; an installed app always loads its own files.
const devUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
const appPage = (): string => pathToFileURL(join(__dirname, '../renderer/index.html')).href

/** The bridge controls the TV, so only the app's own page may use it: never a navigated-to or framed page. */
function isAppUrl(url: string | undefined): boolean {
  if (!url) return false
  const bare = url.split('#')[0].split('?')[0]
  return devUrl ? new URL(url).origin === new URL(devUrl).origin : bare === appPage()
}

function createWindow(): void {
  const icon = nativeImage.createFromPath(app.isPackaged ? join(process.resourcesPath, 'window-icon.png') : join(app.getAppPath(), 'build/icons/256x256.png'))
  win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'CleanMyTV Linux — Ubuntu / Linux Mint',
    icon,
    backgroundColor: '#FFFFFF',
    show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false }
  })
  win.setIcon(icon)
  // Nothing in the app navigates; links open in the system browser instead (below).
  win.webContents.on('will-navigate', (e, url) => { if (!isAppUrl(url)) e.preventDefault() })
  win.webContents.on('will-redirect', (e, url) => { if (!isAppUrl(url)) e.preventDefault() })
  win.webContents.on('will-attach-webview', (e) => e.preventDefault())
  win.once('ready-to-show', () => win?.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  if (devUrl) win.loadURL(devUrl)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

// One copy at a time: two would race on the key file and on the same TV connection.
const primary = app.requestSingleInstanceLock()
app.setName('cleanmytv')
if (!primary) app.quit()
app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus() }
})

app.whenReady().then(() => {
  if (!primary) return
  // The app needs no camera, microphone, notifications or other web permissions.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
  // Packaged: lists and the APK sit in Contents/Resources (mac) or resources\ (Windows).
  configurePaths(app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources'), app.getPath('userData'))
  setSinks((line) => send('log', line), (p) => send('progress', p))
  T.init(paths.adbKey, (s: ConnStatus) => send('status', s))
  for (const [name, fn] of Object.entries(handlers)) {
    ipcMain.handle(name, async (e, ...args: unknown[]) => {
      if (!isAppUrl(e.senderFrame?.url)) throw new Error('blocked: this request did not come from the app window')
      try {
        const probe = T.getStatus().probe
        if (probe && classify(probe) !== 'other') {
          const safe = new Set(['scan', 'connect', 'disconnect', 'status', 'lastHost', 'reconnect', 'checkAdbClosed', 'checkUpdate', 'checks', 'knownTvs', 'connectKnown', 'forgetTv', 'diagnostics', 'lists', 'plan', 'tvPackages', 'applyDebloat', 'restore'])
          if (classify(probe) === 'sberbox-original') for (const action of ['installLocalApk', 'homeStatus', 'installSberBoxHome', 'checkSberBoxHome', 'activateSberBoxHome', 'restoreSberBoxHome', 'homeApps', 'readHomeConfig', 'setHomeConfig', 'setHomeWallpaper', 'homeKeys']) safe.add(action)
          if (!safe.has(name)) throw new Error('This StarOS device supports diagnostics and selective cleanup only.')
        }
        return await (fn as (...a: unknown[]) => Promise<unknown>)(...args)
      } catch (e) {
        send('log', { task: name, level: 'error', text: (e as Error).message, time: Date.now() })
        throw e
      }
    })
  }
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
  T.disconnect()
  if (process.platform !== 'darwin') app.quit()
})
