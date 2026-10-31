## 0.3.3-mint.1 — Ubuntu / Linux Mint amd64

- Restores CleanMyTV Home on original SberBox: separate APK installation, launch check, confirmed Android HOME selection and rollback. The StarOS launcher stays enabled.
- Fixes false SberBox restore-record damage when the normal `android` package appears in the snapshot.
- Packages nine icon sizes and a dedicated window icon for Cinnamon X11; adds a `.deb` contents check. Real Cinnamon window properties are verified separately.
- Hides unverified remote remapping, widgets and music bars on StarOS while keeping layout, apps and wallpaper editing.

The firmware may refuse a third-party default HOME app. Physical remote buttons and HOME behavior require a real SberBox check.

CleanMyTV Linux 0.3.1-mint.1 targets **Ubuntu 24.04 and Linux Mint 22.x, amd64 only**. Based on wingedpanther/cleanmytv at a764cdc0c399e97ae2dcaba13f4b52c565074b71 (MIT).

- Added an Electron `.deb` build with Mint / Ubuntu dependencies and desktop-menu integration. Linux renderer sandboxing stays enabled.
- Wireless debugging pairing prefers system `/usr/bin/adb`; standard network ADB uses the existing built-in client.
- Added **Home screen → Install local APK…** for trusted single APKs, including FLauncher. A native dialog shows the TV address and SHA-256 before installation. Updates use `pm install -r`; no downgrade, permission grants, launcher disabling or Home handover is requested. Temporary APKs are cleaned up after success or failure.
- Changed app, package, documentation and update links to this Linux-only fork; update checks understand `-mint.N` versions.
- Bundles CleanMyTV Home 1.1.1 and the hash-verified upstream lists (371 TVs).

For FLauncher, obtain an APK from https://gitlab.com/flauncher/flauncher, connect to the TV in Setup, then choose **Install local APK…**. No FLauncher binary is bundled. Android may display its own Home chooser after installation. The separate **Clean & launch** / **CleanMyTV Home → Install and use** workflows retain upstream's launcher handover and can disable Google's launcher.

Validation: type check, all 71 automated tests, Home APK build, Electron build, `.deb` integrity and dependency-resolution checks, and sandbox-enabled startup of the extracted package on **Linux Mint 22.3 amd64**. A physical TV installation and a separate Ubuntu desktop run have not been tested.

Install the downloaded package:

```sh
sudo apt install ./CleanMyTV-0.3.1-mint.1-amd64.deb
```

Verify the download with `sha256sum -c SHA256SUMS.txt` from the download directory. Launch **CleanMyTV Linux** from the menu or run `cleanmytv`.
CleanMyTV Linux 0.3.2-mint.1 adds original SberBox / StarOS support on Ubuntu and Linux Mint amd64.

- Detects the original Android 13 SberBox from device, model and manufacturer properties; unrecognized StarOS models have read-only diagnostics.
- Adds a selective SberBox cleanup profile, with every candidate unchecked by default and a backend denylist for launchers and system services.
- Saves a per-operation package snapshot and restores only apps changed by CleanMyTV. Existing TV profiles and restore records retain their behavior.
- Adds Android TV / Google TV / StarOS diagnostics for RAM, CPU, load, processes and `/data`, with partial results when `/proc` is unavailable.
- Keeps local APK installation for SberBox without changing HOME. FLauncher behavior and HOME selection require a physical device check.
- Supplies the app icon to the Electron window so Linux Mint shows the CleanMyTV icon instead of the default gear.

This release is based on a local Linux Mint 22.3 amd64 build with passing TypeScript checks and 80 automated tests. Installation, FLauncher launch and HOME behavior still need a physical SberBox check.
