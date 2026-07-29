# Qomara Mazn

A dice game for two to four players, built with Expo and React Native. Play
pass-and-play on one device, or against a bot.

- **AI opponent** — exact one-ply expectimax, averaging around 215 a game
- **2–4 players**, any mix of people and bots
- **Undo**, so a mis-tapped category is recoverable
- Games **survive being closed**, and stats persist across them
- 197 tests over the rules engine, the AI, persistence and the UI

---

## Play it

### iPhone

Install **[Expo Go](https://apps.apple.com/app/expo-go/id982107779)** from the
App Store, then scan:

<img src="docs/qr-iphone-expo-go.png" width="240" alt="Expo Go QR code" />

Expo Go must be **SDK 54**. It normally is, since the App Store ships the
latest — but a mismatch is the one thing that will stop this opening.

### Android

Scan to download the app directly. No Expo Go needed.

<img src="docs/qr-android-apk.png" width="240" alt="Android APK QR code" />

Android will warn about installing from an unknown source, which is expected
for anything outside the Play Store.

> The Android code points at one specific build. Rebuilding produces a new URL,
> so regenerate the code afterwards — see below.

---

## Developing

```bash
npm install
npm start          # Metro, then open in Expo Go
npm run web        # or run it in a browser
```

Checks, all of which CI also runs on every push:

```bash
npm run verify     # typecheck, lint, and the full test suite
npm test
npm run typecheck
npm run lint
```

### Shipping changes to testers

JavaScript-only changes reach everyone in seconds, on both platforms, with no
rebuild and no reinstall:

```bash
npx eas update --branch preview --message "what changed"
```

Native changes — a new package, an SDK bump — need a fresh build:

```bash
npx eas build --platform android --profile preview
node scripts/make-qr.js --apk <the new Application Archive URL>
```

On Windows PowerShell, use `npx.cmd` rather than `npx`.

---

## How it is put together

```
src/logic/       pure TypeScript: rules, scoring, AI, persistence, stats
src/hooks/       the single seam between that and React
src/components/  presentation only
```

`src/logic` imports nothing from React or React Native, which is why the rules
engine and the AI can be tested headlessly and why the AI could be built and
measured before any of it was wired to a screen.

### Two knobs worth knowing about

**`src/layout.ts`** holds the board's one real tension. Thirteen score rows plus
dice, a roll button and totals do not fit a phone at a comfortable finger size,
so row height and the auto-fit scale floor move together as a single choice:

| | rows | scale floor | result |
|---|---|---|---|
| `compact` | ~30px | 0.72 | fits iPhone 14 and up, no scrolling |
| `roomy` | ~38px | 0.85 | scrolls on phones, easier to tap |

**`src/theme.ts`** is the whole visual system — palette, seat colours, spacing,
type. The casino table look lives here and nowhere else.
