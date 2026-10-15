# Celio Pocket — iPhone-only offline PWA
Source: `liru55/mgba-celio-web` published gh-pages commit `8d4b304080d768ea32aaa5f155fc3aa81f6300f9`.
License: MPL-2.0; original attribution, credits and source are preserved through the pinned emulator program and linked repository. No ROM, SAV, quicksave, or personal data is distributed.

## User setup (no ZIP, no PC)
1. Open the published GitHub Pages URL in **Safari on iPhone**.
2. Share → Add to Home Screen → Open as Web App.
3. Open the new home-screen icon, press **このiPhoneにアプリを保存**. The app downloads a fixed set of static upstream emulator files (about 2.7 MiB), verifying byte lengths and Git object SHA-1 hashes. This first step requires network access. The installer never reads ROM/SAV.
4. Press **ゲームを起動する**, select your locally stored `.gba` ROM and/or `.sav` save.
5. Save within the game, then regularly export a `.sav` backup to Files → On My iPhone.
6. Turn Airplane Mode on, turn Wi-Fi off, relaunch from the home screen, and confirm ROM + save access offline.

The original third-party `mgba-celio-local.astralpike7.chatgpt.site` could not be retrieved. This rebuild uses the verifiable upstream mGBA Celio Web and is not a pixel-exact clone of that site.

## Security controls
- Before installation completes, the page and service worker only request explicitly pinned static JS/CSS/WASM/image/license assets from GitHub over HTTPS (GET).
- After installation is sealed, game requests are **CacheStorage-only**, with no network fallback. Service Worker refuses external GET and all non-GET methods, including uploads.
- The online-link implementation is replaced at install time by an inert adapter: online trading and USB transfer are not available.
- Game HTML has strict CSP that prohibits external `fetch`, WebSocket connections, and external scripts. The app does not implement any ROM or SAV upload.
- Browser updates, service worker update checks, and OS network activity are outside the application's control; *Airplane Mode + Wi-Fi off is the practical guarantee of zero network traffic*.
- iOS may evict local cache / IndexedDB; the user must export backups.
- This remains **unverified on a physical iPhone**; old 3DS compatibility and iPhone 64MiB ROM performance are unrelated.

## Publish on GitHub Pages — one-time admin setup
Repository: `Shota-Zaki/PokemonStart`.
The website files live in the `work` branch, `/docs`. Publishing is **not** triggered by merely writing these files.
Open repository **Settings → Pages → Build and deployment → Deploy from a branch → work → /docs → Save**.
Once GitHub Pages reports a live site, use its displayed HTTPS URL. Do not invent/assume a URL before confirming publication.
Keep development changes on `work`; do not directly edit `main`.

