# Rollhouse

A five-dice, three-roll classic for one to four players, built with Expo and
React Native. Play alone for a high score, pass-and-play on one device, or
against bots.

- **Three game types** — Quick (upper section, 6 rounds), Classic (the full
  card, 13 rounds) and Marathon (three columns worth x1, x2 and x3, 39 rounds)
- **Shake to throw** — each turn opens on a page of nothing but the dice;
  shake the phone (or tap) to roll, then head to the table to score
- **Full standard rules**, including the 100-point bonus for every extra
  Rollhouse (five alike) and the Joker rule that goes with it
- **Bots at three levels** — Easy, Normal and Hard, averaging roughly 195, 225
  and 240 in a Classic game
- **1–4 players**, any mix of people and bots, with your own names
- **High scores** per game type, a running record and achievements
- **Hints** on request, from the Hard bot; a hinted game is marked as one
- **Sound, vibration, bot speed** and the rest, in Settings
- **Undo**, so a mis-tapped category is recoverable
- Games **survive being closed**, and the menu offers to continue them
- Tests over the rules engine, the bots, persistence and the UI

| Menu | New game | Throw | Marathon |
|---|---|---|---|
| <img src="docs/screenshots/07-menu-continue.png" width="180" alt="The main menu, offering to continue a Marathon game" /> | <img src="docs/screenshots/02-new-game.png" width="180" alt="New game setup: game type, players, and a Hard bot" /> | <img src="docs/screenshots/03-dice-page-with-hint.png" width="180" alt="The dice page, with a hint marking two dice to keep" /> | <img src="docs/screenshots/05-marathon-table.png" width="180" alt="A Marathon scorecard with three columns" /> |

More in [docs/screenshots](docs/screenshots).

---

## Play it

One image with both codes, ready to send on:
**[docs/qr-share.png](docs/qr-share.png)**

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

**`src/logic/modes.ts`** is the one table that says what differs between game
types: which boxes are in play and how many columns the card has. Adding a
game type is a row there.

**`scripts/make-sounds.js`** synthesises the sound effects into
`assets/sounds/`. They are generated rather than sourced, so retuning one is a
matter of editing numbers and re-running `node scripts/make-sounds.js`.
