# CleanMyTV Linux

A free desktop app **only for Ubuntu and Linux Mint, amd64** that manages Android TV, Google TV and supported SberBox devices over Wi-Fi. This Linux fork adds a `.deb` package, system ADB support for Wireless debugging pairing, and installation of trusted local APKs such as FLauncher without automatically disabling the stock launcher.

Based on [CleanMyTV by wingedpanther](https://github.com/wingedpanther/cleanmytv), under the MIT licence. The Android launcher remains CleanMyTV Home. Desktop builds for other operating systems are outside this fork's scope.

The per-TV cleanup lists come from [cleanyourtv](https://github.com/Gathin23/cleanyourtv) by
[@gathint](https://x.com/gathint). Thanks, Gathin.

New to this? The **[user guide](docs/USER-GUIDE.md)** walks every step at TV-owner pace, including
rollback and troubleshooting, and the **[known-devices table](docs/KNOWN-DEVICES.md)** shows what the
bundled lists cover per model. This README is the technical overview.

Questions, help and home-screen setups: join the **[CleanMyTV Discord](https://discord.gg/6hZeQkDYf9)**.
Bugs and feature requests go to [GitHub issues](https://github.com/hitttmannn/cleanmytv-linux/issues).



https://github.com/user-attachments/assets/4e3eb18a-d196-4a51-8d0e-93ce98e11913



## Download and install

Download the amd64 `.deb` from [this fork's Releases](https://github.com/hitttmannn/cleanmytv-linux/releases).

Targets: **Ubuntu 24.04 and Linux Mint 22.x (amd64)**. Locally tested on **Linux Mint 22.3**; Ubuntu is the packaging target and is not a separate completed hardware test.

```sh
sudo apt install ./CleanMyTV-0.3.2-mint.1-amd64.deb
```

Open **CleanMyTV Linux** from the applications menu, or run `cleanmytv`. APT installs the required libraries, `adb` and `unzip`; Node.js and the Android SDK are not needed to run the installed app. The app never requests `--no-sandbox`.

### Install FLauncher while keeping Google TV

1. Download a trusted APK from the [official FLauncher project](https://gitlab.com/flauncher/flauncher).
2. Connect to the TV in **Setup**, then open **Home screen → Install local APK…**.
3. Check the file, TV address and SHA-256 in the native confirmation dialog, then install.

This path uses ADB upload and `pm install -r` only. It does not disable the stock launcher, set the default Home app, grant permissions, uninstall an existing app or allow a downgrade. Android checks the APK and update signature. Split APK bundles are not supported. Choose a default Home app separately on the TV if desired; Android may show its own chooser after a new launcher is installed.

**Clean & launch** and the separate **CleanMyTV Home → Install and use** still follow upstream's handover procedure and can disable Google's launcher. Use **Install local APK…** for installation only. Review cleanup selections before applying them.

### SberBox / StarOS

Connect an original SberBox through **Setup** using the device address shown on your network; ADB must already be enabled on the box. The app recognizes `ro.product.device=sberbox`, model `SberBox`, manufacturer `SberDevices` and Android 13 together. Other Sber/StarOS models show a warning and offer diagnostics only. [Sber's ADB instructions](https://developers.sber.ru/docs/ru/va/native/testing/adb) describe enabling and connecting ADB on compatible firmware.

**Clean up → Компоненты SberBox** lists only the known profile candidates installed on this device. Nothing is selected by default. ES File Explorer and APKPure are third-party candidates; seven Sber components are optional and their dependencies are unverified. Check each app's role before selecting it. The preview and confirmation name every selected app. The backend protects the Sber launcher, settings, core services, Android System UI and Bluetooth, including against manual package input. Unknown StarOS system packages are protected as well.

Before the first `pm disable-user --user 0` command, CleanMyTV saves the installed and previously disabled package lists, device identity and timestamp in `~/.cleanyourtv/`. It records each successful change separately. **Restore** enables only packages CleanMyTV disabled while they were enabled immediately before that operation. Previously disabled apps stay disabled. Each ADB failure is shown beside its package. Existing Android TV / Google TV restore records continue to use their original format.

**Диагностика** is available on Android TV, Google TV and StarOS. It shows Android/build, hardware, RAM total, `MemAvailable`, `MemFree`, swap, CPU usage, 1/5/15-minute load averages, active processes and `/data` usage. Run it again after cleanup to compare. Load average is a task count, not a CPU percentage; `MemFree` is not the same as available memory. Unreadable `/proc` fields are reported while the rest remains visible.

For FLauncher on SberBox, choose **Установить локальный APK** in the SberBox cleanup screen. It uses the existing confirmed local APK installation path and leaves `ru.sberdevices.starlauncher` enabled. Whether FLauncher launches and whether your StarOS firmware allows choosing it as HOME still needs a check on the physical box. [Sber documents third-party APK installation](https://sberdevices.ru/press/detail/masstabnoe_obnovlenie_sberbox_ustanovka_storonnix_prilozenii_i_100_kanalov_besplatno/), but that does not establish FLauncher compatibility or HOME selection.

On the reported test device, ES File Explorer reached 108% of one CPU core before it was stopped; load average was 2.52 / 4.78 / 3.39, RAM 1991 MiB, swap 0 MiB, and MemAvailable around 749 MiB afterward. These are diagnostic examples, not promised speed gains. Automatic tests use a simulated device and do not change a real SberBox.

## Before you start: on the TV

1. Settings → Device Preferences → About (on some Google TVs: Settings → System → About).
2. Press OK on **Build** (or **Android TV OS build**) seven times, until the TV says you are a developer.
3. Back one screen → **Developer options** → turn on **USB debugging**. If you also see
   **Network debugging** or **ADB debugging**, turn that on too.
4. Keep the TV on and on the same Wi-Fi as your computer.

Open CleanMyTV, find the TV and choose **Allow** when the TV asks. Tick **Always allow from this
computer** to skip the question next time.

## What it does

| Step | What happens |
|---|---|
| **Clean & launch** | The guided path: applies the list that best matches your TV, then installs CleanMyTV Home. |
| **Setup** | Checks the network, finds TVs with port 5555 open, connects, and waits while you press Allow on the TV. Google TVs that only offer Wireless debugging get a pairing form. With more than one known TV, it shows them with snapshot thumbnails to pick from. |
| **Clean up** | Picks the upstream list that matches your TV's model, from 371 TVs and 100 brands. Every package shows its live state on the TV, and you choose what to disable. If your TV isn't listed, lists from its brand come first, and it offers the packages other TVs disable. You can add any package on the TV by name. |
| **Home screen** | Installs or updates CleanMyTV Home and hands Home over. If Home doesn't land on it, it rolls back. If the app can't tell which app is the TV's own launcher, it asks. Tabs for layout, apps, rows and folders, look and wallpaper, widgets, music bars and remote buttons. See below. |
| **TV extras** | Ad-blocking Private DNS, animation speed, an on-screen remote, reboot. |
| **Finish** | Restarts the TV and checks the home screen comes back; if it doesn't, puts the stock launcher back. Then walks through switching debugging off, and checks that port 5555 is closed. |

| | |
|---|---|
| ![Setup, connected to a TV](docs/setup.png) | ![Clean up: the list that matches the TV, with each package's state](docs/clean-up.png) |

Nothing is uninstalled. Packages are switched off for your user, and Restore puts every package back
the way it was before the first cleanup.

## CleanMyTV Home

No ads. Your apps, your layout, the weather and what's playing. You change everything from your
computer, and the TV shows it as you click.

| | |
|---|---|
| ![Shelf: the clock, weather and quick settings in the top corner, apps lower down](docs/home-shelf.jpg) | ![Split: the clock and quick settings on the left, apps on the right](docs/home-split.jpg) |
| **Shelf**, the default | **Split** |
| ![Rail: icons down the left edge that open with labels](docs/home-rail.jpg) | ![A folder open over the home screen](docs/home-folder.jpg) |
| **Rail**, opened | A folder |

![The Home screen step in the app, with a live preview of the TV](docs/home-editor.png)

The Home screen step has seven tabs. Every change shows on the TV straight away. The Layout and Apps
tabs have a live preview of the TV screen at the top.

| Tab | What you set |
|---|---|
| **Overview** | Install or update Home, and how to use it. Give Home back to the stock launcher. Remove the old CleanYourTV launcher in one click if it's still on the TV. Take a snapshot of the TV screen. |
| **Layout** | Three layouts: Shelf (the default), Split and Rail. Space above the apps. The now playing, dock, rows, folders and all apps sections, in any order, each one can be hidden. Quick-settings icons: Inputs, Wi-Fi, Bluetooth, Picture & sound, Apps, Screensaver, Search, Music bars and Settings. Icons the TV can't open are marked "not on this TV". Dock and row tile sizes, apps per row, app names, clock and greeting. |
| **Apps, rows & folders** | Dock size, drag to reorder, hide apps, named rows and folders. |
| **Look & wallpaper** | Accent colour, focus style (glow, outline or none), your own picture or Bing's picture of the day, darken, background colour. |
| **Widgets** | Now playing: what any music or video app plays, with play, pause and next. Weather next to the clock for a town you pick, in °C or °F. |
| **Music bars** | On or off; bars, mirrored or wave; accent, rainbow or white; peak dots, number of bars, height, opacity and sensitivity. |
| **Remote buttons** | Find what a remote button sends, then give it a job in every app: open Settings, Inputs, an app, Home, Back, and more. Off until you turn it on. Only the buttons you map are touched. Power, volume and the mic button are usually handled before Android sees them. On Xiaomi TVs, one click makes the Mi button go Home. |

Your settings and wallpaper stay through updates and reboots. The app also keeps a copy on your
computer: if CleanMyTV Home ever starts empty (after an uninstall or a factory reset), installing it
puts the copy back. What the launcher can access is under [Security and privacy](#security-and-privacy).

CleanMyTV Home needs Android 9 (API 28) or newer.

## Coming back to customise

Turn USB debugging on again and open the app. With one known TV, it reconnects to it. When CleanMyTV
Home is already Home it opens the Home screen step, loaded with what is on the TV now. Switch debugging
off again when you're done. If you didn't revoke the authorisations, there's no Allow prompt.

The app remembers each TV it has connected to. With more than one, it doesn't connect by itself: Setup
shows the TVs with snapshot thumbnails, and you pick one. The sidebar shows the connected TV's thumbnail.

If the router gave the TV a new address, or another device now answers at the old one, the app says so
and scans the network. You pick the TV from the list; the app does not log in to devices it found by
itself.

## Security and privacy

- **What it talks to.** The TV address you choose, over ADB on port 5555 of your local network. Over
  HTTPS, and nothing else:
  - api.github.com, at most twice a day, to see if a newer CleanMyTV is out. It downloads nothing.
  - dl.google.com for Google's platform-tools, only when you click it (Wireless debugging pairing).
  - www.bing.com, only when you choose Bing's picture of the day as the wallpaper.
  - geocoding-api.open-meteo.com, only when you search for a town for the weather.

  No analytics, no accounts, no server of its own.
- **What CleanMyTV Home can access.**
  - Its settings and wallpaper live in its own private storage. The app sends them over ADB through a
    ContentProvider (`content call`) that only the shell user and root may call. This is also what
    fixed the "Permission denied" on `Android/data` (#20, #27, #28) and the reset after a reboot (#21).
  - The music bars read the TV's sound output: the app grants `RECORD_AUDIO` over ADB at install. The
    bars only move while music or video plays.
  - Now playing reads other apps' media sessions. Android only allows that for a notification listener,
    so the app switches one on over ADB while the section is on, and off without it. It reads no
    notifications.
  - Remote buttons use an accessibility service. It sees key presses and which app is in front, and
    can't read what's on screen. It is off until you turn it on, and only acts on the buttons you map.
  - The only thing it fetches from the internet is the weather, from api.open-meteo.com, every 30
    minutes while the place is set.
- **Your keys.** The app makes its own ADB key in its data folder and signs only with that. It never
  uses `~/.android/adbkey`, which your phones may also trust, and it only logs in to an address you
  picked. Network ADB is plaintext by design, so use it on a network you trust.
- **Pinned upstream.** The debloat lists come from one upstream commit pinned in
  [`upstream.json`](upstream.json) with a content hash. A build refuses anything that doesn't match, so
  a change upstream reaches this app only after someone reviews it and moves the pin.
- **The launcher signing key ships inside the app, on purpose.** `resources/signing/cleanmytv.jks`
  (password `cleanyourtv`) signs CleanMyTV Home, so every build installs over the others. It gives no
  access to a TV: installing anything still needs ADB access the owner allowed.
- **Close debugging when you're done.** Some TVs (`ro.adb.secure=0`) accept any device on the network
  without the Allow prompt; the app warns you if yours is one. The Finish step checks that port 5555 is
  closed. The launcher keeps working without debugging.
- **Window lockdown.** The app window is sandboxed, cannot navigate away from its own page, and only
  that page may call into the part that talks to the TV.

Found a security problem? Please report it privately through the repository's
**Security → Report a vulnerability** page rather than in a public issue.

## Credits and upstream

The per-TV cleanup lists are [cleanyourtv](https://github.com/Gathin23/cleanyourtv)'s, by
[@gathint](https://x.com/gathint), shipped unchanged. CleanMyTV is an independent project, not part of
cleanyourtv. Versions 0.1.x installed the CleanYourTV launcher (`com.gathin.tvhome`); since 0.2.0 the
launcher is CleanMyTV Home, built from `home/` in this repository, and the app can remove the old one.

The debloat side is a TypeScript port of upstream's `tools/`, and the launcher handover follows
`launcher/build-and-install.sh`:

- `src/main/adb/` is an ADB-over-TCP client, the twin of `tools/tv.py`.
- `src/main/debloat.ts` has the same guards as `disable.sh`: it won't disable the app that owns Home while nothing else can take it, and it won't disable setupwraith while it owns the Wi-Fi network. It writes the same recovery record to `~/.cleanyourtv/`, plus the TV's device name so the record follows the TV to a new address. `tests/engine.test.ts` checks that the record names and the restore batch match upstream `recovery.py` exactly, so `tools/restore.sh ~/.cleanyourtv/lists/<tv>.txt` can also undo what the app did.
- `src/main/launcher.ts` follows the handover order of `build-and-install.sh`: install, start, switch off Google's launcher, set Home, check, roll back. Vendor launchers stay on, as upstream's `STOCK_LAUNCHER=none` does: lists say to keep them. The app knows the stock launchers the lists name, and remembers each TV's for Undo. It also removes the CleanYourTV launcher that 0.1.x installed.
- `src/main/home.ts` reads and writes CleanMyTV Home's settings through its ContentProvider.

Upstream's themes aren't bundled. They are for upstream's launcher.

### The launcher APK

CleanMyTV Home lives in `home/`: Kotlin and Jetpack Compose for TV, package
`io.github.wingedpanther.cleanmytv.home`. `npm run home` builds it into `resources/home.apk`, and
`resources/home.json` records its version. The script uses `JAVA_HOME` and `ANDROID_HOME` if they are
set. Otherwise it downloads JDK 17 and the Android SDK into `.cytv-build/`. Every build is signed with
`resources/signing/cleanmytv.jks`, so each one installs over the others.

## Develop

```bash
npm install
npm run sync                 # lists from the pinned upstream commit
npm run home                 # resources/home.apk (without JAVA_HOME/ANDROID_HOME, first run downloads the build tools)
npm run dev                  # the app, with hot reload
npx tsx scripts/fake-tv.ts   # a pretend TV on 127.0.0.1:5556 to try the app without one
UPSTREAM_DIR=<clone at the pinned commit> npm test
npm run dist:linux           # dist/*-amd64.deb (Ubuntu / Linux Mint)
```

To move to a newer upstream: review its changes, then `node scripts/pin-upstream.mjs <commit sha>`,
`npm run sync`, and test on a TV. `UPSTREAM_UNPINNED=1` lets `sync` use other content for a local
trial.

`.github/workflows/build.yml` runs type checks and tests, builds CleanMyTV Home and packages an amd64 `.deb` on Ubuntu 24.04. Pull requests have read-only permissions. Version tags can create a draft Linux release; existing releases are never overwritten.

### Releasing

Set `version` in `package.json` and `package-lock.json`, commit, then push a matching `v<version>` tag. Download the `.deb` and checksums from the workflow artifacts or review the draft release and publish it. Manual releases may upload a package built and verified locally from the tagged source.

## Help and community

- **Chat and how-to questions:** the [CleanMyTV Discord](https://discord.gg/6hZeQkDYf9). Share your
  home screen in `#show-your-setup`.
- **Bugs and feature requests:** [open a GitHub issue](https://github.com/hitttmannn/cleanmytv-linux/issues/new)
  with your TV model, Android version and what happened. Issues are where fixes get tracked, so please
  don't report bugs only in Discord.

## Known limits

- Linux Mint 22.3 amd64: type check, 71 tests, dependency resolution and startup of the packaged application passed. No physical TV was modified during verification.
- Ubuntu 24.04 amd64 is the compatible packaging target; older releases and other architectures are not supported by this package.
- CleanMyTV Home requires Android 9 or newer. Installing FLauncher needs a compatible trusted APK; no FLauncher APK is bundled or downloaded automatically.
- Standard network ADB uses the built-in TypeScript client. Wireless-debugging pairing prefers `/usr/bin/adb` from APT; the existing on-demand platform-tools fallback remains available.

## Licence

MIT, see [LICENSE](LICENSE). The bundled debloat lists are from
[cleanyourtv](https://github.com/Gathin23/cleanyourtv) by Gathin23, also MIT; its licence ships in
`resources/upstream/LICENSE`.
