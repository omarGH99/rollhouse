#!/usr/bin/env node
/**
 * Regenerates the tester QR codes in docs/.
 *
 * Both targets change over time — the APK link is tied to one specific build,
 * and the update link carries the SDK's runtime version — so this reads the
 * current values rather than hard-coding them:
 *
 *   node scripts/make-qr.js --apk <url>
 *
 * The Expo Go link is derived from app.json, so it stays correct on its own.
 * Pass --apk after any new Android build to refresh that one; the value is
 * printed by `eas build:list` as "Application Archive URL".
 */
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs');

const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
const projectId = app.extra?.eas?.projectId;
if (!projectId) {
  console.error('No EAS project id in app.json — run `eas init` first.');
  process.exit(1);
}

/** Expo Go opens an update over the exp:// scheme, not https. */
const CHANNEL = 'preview';
const runtime = `exposdk:${app.sdkVersion ?? require(path.join(ROOT, 'node_modules/expo/package.json')).version.split('.')[0] + '.0.0'}`;
const expoGoUrl =
  `exp://u.expo.dev/${projectId}` +
  `?channel-name=${CHANNEL}&runtime-version=${encodeURIComponent(runtime)}`;

const apkFlag = process.argv.indexOf('--apk');
const apkUrl = apkFlag > -1 ? process.argv[apkFlag + 1] : null;

/** Plain black on white: brand colours here only cost scan reliability. */
const options = { width: 512, margin: 2, errorCorrectionLevel: 'M' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  await QRCode.toFile(path.join(OUT, 'qr-iphone-expo-go.png'), expoGoUrl, options);
  console.log('docs/qr-iphone-expo-go.png ->', expoGoUrl);

  if (apkUrl) {
    await QRCode.toFile(path.join(OUT, 'qr-android-apk.png'), apkUrl, options);
    console.log('docs/qr-android-apk.png    ->', apkUrl);
  } else {
    console.log('(no --apk url given, skipped the Android code)');
  }
})().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
