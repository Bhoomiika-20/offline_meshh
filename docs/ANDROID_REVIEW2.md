# Android Review 2 — Windows build and phone tests

## Prerequisites

- The complete ZIP extracted and opened in VS Code.
- Node.js 22.12+ (Node 24 works).
- Android Studio with Android SDK/platform tools and the platform/build tools
  required by the generated Gradle project. Install any version Gradle requests.
- JDK 17 baseline; follow generated Gradle requirements if it asks for another JDK.
  Set JAVA_HOME to your installed JDK.
- ANDROID_HOME pointing to your Android SDK (Android Studio shows the SDK location).
  Add its platform-tools directory to PATH, then reopen VS Code.
- Two Android phones initially; three to demonstrate A–B–C relay.
  Phones must have compatible Google Play services.
- Enable Developer options > USB debugging on the phones. Use a data-capable USB
  cable and accept the computer authorization prompt on the phone.

Downloads during npm/Gradle setup need internet. The later alert demo does not.
An emulator can help inspect UI, but does not establish the physical relay result.

## Build

In the extracted project root:

```powershell
npm ci
cd apps/mobile
npm ci
npx expo prebuild --platform android
adb devices
npx expo run:android --variant release --device
```

Choose your connected physical phone when prompted. The release variant embeds
JavaScript so the installed app can run without a laptop/Metro connection.
This is a local review APK, not a Play Store release.

The usual output is:
`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
Locate the actual Gradle output if the name differs.

Install the same APK on the other phones. From apps/mobile:

```powershell
adb devices
adb -s YOUR_DEVICE_SERIAL install -r android/app/build/outputs/apk/release/app-release.apk
```

Replace YOUR_DEVICE_SERIAL with the serial shown by adb devices. Alternatively,
repeat expo run:android and select each phone. Native module changes require a
new APK; reloading JavaScript or Expo Go is not sufficient.

## Test 1 — two-phone direct delivery

1. Open MeshAid on A and B. Switch mobile data off; keep Wi-Fi and Bluetooth on.
2. Start discovery on BOTH phones and grant nearby-device/location permissions.
   On older Android versions location services may also need to be enabled.
3. In Devices, connect A to B. Compare the pairing code on BOTH phones and accept.
4. In Create, keep the neighbour limit All. Create a fresh alert on A, hop limit 1.
5. B should show exactly one saved copy with 0 remaining hops.
6. Check A's sent event and B's received event for the same alert UUID.
   Transfer completion alone is not an application-level receipt acknowledgement.

## Test 2 — three-phone relay

1. Connect A–B and B–C. B must show two connected peers. Do NOT connect A–C.
2. Set every phone's neighbour limit to All (Create screen). Keep all apps open.
3. Create a NEW alert on A, hop limit 2.
4. B should receive with 1 remaining hop; C should receive with 0.
5. Create another NEW alert, hop limit 1. B receives; C should not receive that UUID.
6. On C use the local duplicate test. No extra feed row; duplicate_drop increases.
7. Close and reopen C after the completed relay. History and K setting should persist.
   This is a persistence test, not background delivery or recovery of an in-flight send.

## Test 3 — show the new K setting

For a separate experiment, connect A–B and A–C, but disconnect B–C.
Use hop limit 1 so a receiver cannot forward to another phone.
- A K=1: only ONE neighbour receives a fresh alert. Selection is by sorted endpoint
  ID, so do not promise which physical phone is selected.
- A All: both neighbours should receive the next fresh alert.
- Repeat A K=2: both eligible neighbours can receive.
The original chain test also works with K=1 on all nodes because B excludes A
and then selects C as its only remaining eligible peer.

## Export and inspect

- On each phone open Results or Logs > Export Android JSON.
- Save/share the file and transfer it to the laptop, for example by USB or local
  file transfer. Inspect exported files after restarting if the share sheet fails.
- On the laptop dashboard, Results > Import phone JSON files. Select the A, B and C
  files from the SAME experiment together. Repeated exports do not inflate counts.
- Source must read IMPORTED ANDROID LOGS. Select the relevant UUID.
- Results use retained logs and captured snapshots; they do not measure radio range,
  battery or cross-phone latency. Importing only two phone snapshots gives a
  denominator of two, even if the actual experiment involved three phones.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| adb not recognized | SDK platform-tools PATH; reopen terminal |
| adb device unauthorized | Unlock phone, accept USB authorization |
| No device listed | USB debugging, data cable, correct USB mode/driver |
| SDK/JDK build failure | Android Studio SDK Manager, JAVA_HOME, Gradle-requested versions |
| Custom module missing / getFanout not found | Install freshly rebuilt Review 2 APK; do not use Expo Go or an old APK |
| No peers found | Start discovery on both phones, permissions, Wi-Fi/Bluetooth, Play services, older Android location services |
| A reaches B but not C | B must have two connected peers, A hop limit 2, fresh UUID, app foreground |
| No send after reconnect | No automatic old-alert replay is implemented; create a NEW alert |
| APK install signature conflict | Export existing history first; install a build signed with the same key, or uninstall the old app (uninstall clears its local data) |

Nearby chooses the Bluetooth/BLE/Wi-Fi medium. The app does not force a specific
radio or claim a measured range. Pairing is still required; alert signatures are
not implemented in this review scope.

## Record actual observations — do not prefill Pass

| Test | Phone models / Android versions | Observed result | Evidence |
| --- | --- | --- | --- |
| Release APK starts without Metro | | Not tested | |
| Two-phone transfer, mobile data off | | Not tested | |
| A–B–C, hop limit 2 | | Not tested | |
| Hop limit 1 stops at B | | Not tested | |
| Duplicate suppression | | Not tested | |
| K=1 versus All, star topology | | Not tested | |
| Restart history and K persistence | | Not tested | |
| Share/export and laptop Results import | | Not tested | |
