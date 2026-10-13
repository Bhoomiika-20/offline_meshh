# MeshAid — Offline Mesh Emergency Alert Propagation System

Review 2 update to the Review 1 source project for a four-member ISE team. Guide: **Dr. S. Kuzhalvaimozhi, COE & Professor, Dept. of ISE**.

This repository implements a limited Review 2 extension of the Review 1 scope, not the full research proposal. Start with [START_HERE_REVIEW2.md](START_HERE_REVIEW2.md); Android steps are in [ANDROID_REVIEW2.md](docs/ANDROID_REVIEW2.md). It is newly written code; no code from `Disaster_Platform` is included.

## What you get

| Part | Stack | Purpose |
|---|---|---|
| Review dashboard | React, Redux Toolkit, Vite | Three-node simulation; per-node K control; event log; local results/import; manual archive |
| Optional archive | Node.js, Express, MongoDB | Validate and save exported review runs; preserve simulator/Android source labels |
| Android app | React Native, Redux Toolkit, Expo custom build | Alert composer, feed, discovery/pairing, saved K setting, relay, local results, history and export |
| Native Android adapter | Kotlin, Google Nearby Connections, SQLiteOpenHelper | Actual radio API calls, pair/accept/reject, payload transfer and local persistence |
| Shared engine | Plain JavaScript | UUID validation, hop TTL, bounded K relay, atomic duplicate suppression, event logging |

**MERN alone cannot implement an Android Wi-Fi Direct/BLE mesh in a web page.** The mobile client is necessary; MongoDB and Express are an optional review archive, never the phone-to-phone delivery path. The browser simulator does not use radio hardware. Android code is included, but the native APK build and multi-phone behaviour must be validated on your Windows/Android setup. See [VALIDATION.md](docs/VALIDATION.md).

## Quick start: MERN dashboard (Windows / VS Code)

Install Node.js 22.12+ (Node 24 works). Extract this project and open its folder in VS Code.

```powershell
npm ci
npm run dev:web
```

Open **http://localhost:5173**. No MongoDB is required for the browser simulation. Keep only A–B and B–C checked, use hop limit 2, and send from Phone A. Select Phone C to inspect its received alert. Inject a duplicate, inspect Event log, and reload to verify persistence.

For MongoDB archiving, start Docker Desktop, then use separate terminals:

```powershell
docker compose up -d mongo
```

```powershell
Copy-Item apps/server/.env.example apps/server/.env
npm run dev
```

`npm run dev` starts the Express API (4000) and React dashboard (5173). Stop a separately running dashboard first. Alternatively, use a local MongoDB installation and set `MONGO_URI`. The API binds to localhost; it is a local review tool, not a public authenticated service. If MongoDB is unavailable the archive returns 503, never pretending data was saved. After starting MongoDB, restart the API.

In **Review archive**, save the simulation or import JSON exported by a phone. Records keep their `source` (`simulator` or `android`). Re-importing the exact same run is idempotent; a reused run ID with different data is rejected.

## Android setup and an internet-free demo build

Install Android Studio, its SDK/platform tools, and the JDK required by the generated Expo Android project (JDK 17 is the baseline). Set `ANDROID_HOME`, add `platform-tools` to PATH, and enable USB debugging on at least three Android phones with Google Play services. The Expo SDK 55 / React Native 0.83 project targets Android; no iOS implementation is included.

```powershell
cd apps/mobile
npm ci
npx expo install --check
npx expo prebuild --platform android
npx expo run:android --variant release
```

The final command builds, embeds the JS bundle, and installs a release-variant APK on the selected device. Repeat installation for all three phones. A debug Metro session requires the laptop; use the bundled release variant for the **internet-off demo**. This is a local review build, not a Play Store release.

If an SDK component is missing, install the version requested by the generated Android Gradle project through Android Studio. Gradle/npm dependency downloads require internet during setup, not during the alert demo. Native changes require a rebuild. **Expo Go cannot run the custom native module.**

1. Open the app on all phones. Enable Bluetooth and Wi-Fi, then disable cellular data. A router is not required for the intended Nearby demo.
2. Start discovery. Grant the requested nearby-device/location permissions. On older Android versions enable location services if discovery needs them.
3. Connect **A–B** and **B–C** only. Compare and accept the pairing code on both devices. Do not connect A–C. Endpoint names show persistent node-ID prefixes.
4. Optionally pause scanning after pairing to reduce discovery interference; existing connections remain.
5. Create a fresh alert on A with hop limit 2. B should receive/relay; C should receive with 0 remaining hops. Verify on the actual phones before your review.
6. Export JSON from each phone using the Android share sheet; transfer by USB/local file transfer and import into the laptop dashboard later.

Google Nearby Connections uses `P2P_CLUSTER` and chooses its underlying Bluetooth/Wi-Fi medium. This project does **not** claim to force BLE-only or Wi-Fi-Direct-only transport, implement Bluetooth Mesh Profile, or guarantee 200 m range. Strict manual selection of two independent radio adapters remains later work. Pairing codes authenticate the local connection; they are **not** the proposal’s Ed25519/TOFU alert security.

## Project layout

```text
apps/web/                         React review dashboard + browser simulation
apps/server/                      Express API + MongoDB archive
apps/mobile/src/                  React Native screens, Redux store, adapters
apps/mobile/modules/mesh-native/  Kotlin Nearby + SQLite local module
packages/core/                    Shared relay state machine and validation
tests/                            Protocol and API contract tests
scripts/analyze.py                Descriptive exported-log analysis
docs/                            Architecture, team split, demo and validation
```

## Protocol semantics (Review 1 format, Review 2 K selection)

- An alert contains `version`, `alertId` (UUIDv4), `senderId` (persistent UUIDv4), `type`, `message`, `createdAt`, `maxHops`, `remainingHops`, and `security: unsigned-review1`.
- `maxHops` is 1–16. Each **transmission** decrements `remainingHops`. A receiver displays a valid zero-hop alert but does not forward it. Thus A with 2 → B with 1 → C with 0.
- Every node claims an alert UUID durably **before** forwarding; Android uses the SQLite alert primary key as its exact seen registry. Duplicates never create a second alert row or trigger another relay. Node identity persists in preferences.
- Relay excludes the ingress peer and duplicate endpoints, sorts eligible peer IDs, then chooses at most K (1–16); All (0) preserves all-peer forwarding. Each node saves its own setting. This is simple deterministic bounded fanout, not randomized gossip. Reducing K can reduce coverage. There is no implicit background delivery, store-carry-forward, automatic catch-up, retry queue or end-to-end acknowledgement in this milestone.
- A new connection does not automatically replay old alerts. Create a fresh UUID after pairing for each test.
- `sent`/`relayed` on Android means Nearby reported transfer completion. It does not prove application-level receipt; correlate the remote `received` event by UUID. The simulator only records acceptance by its simulated transport.
- Alerts are unsigned and not trusted-authority verified. Protobuf, Ed25519/libsodium/TOFU, Bloom filter, Room migration/LRU eviction, the second transport and advanced metrics are later work. Local Results shows retained-event counts and stored-copy reach across captured nodes; Android files can be imported without MongoDB.
- Android continues to use SQLite directly. Web uses localStorage for the simulation; MongoDB stores optional run archives. These are explicitly separate persistence roles.
- Foreground demo only: keep the Android app open. Background service support, process-kill recovery of an in-flight relay and sustained churn experiments are not implemented.
- Store limit: 1,000 unique alerts per node; logs retain the latest 5,000 events. Export before extended testing. Full storage refuses new alerts rather than silently evicting the deduplication registry. Clear only between experiments.

## Tests and builds

```powershell
npm test
npm run build
```

The automated tests exercise meaningful protocol behaviour and API validation, not physical radio performance. Read `docs/VALIDATION.md` for the actual checks performed and remaining gates.

```powershell
python scripts/analyze.py phone-a.json phone-b.json phone-c.json --expected-nodes 3
```

This reports retained-event counts and observed coverage. Latency is omitted unless you explicitly assert independently synchronized clocks using `--clocks-synchronized`. Never subtract monotonic clocks from different phones or sessions. No generated numbers should be presented as physical paper results. Grafana/InfluxDB, NetworkX/ns-3, battery profiling and signature benchmarks are not part of this milestone.

## Primary integration references

- [Google Nearby setup and permissions](https://developers.google.com/nearby/connections/android/get-started)
- [Nearby discovery](https://developers.google.com/nearby/connections/android/discover-devices)
- [Pairing and connection management](https://developers.google.com/nearby/connections/android/manage-connections)
- [Nearby strategies](https://developers.google.com/nearby/connections/strategies)
- [Expo native module API](https://docs.expo.dev/modules/module-api/)

Architecture is an on-device modular design. There is no claim that the phone launches independent server microservices.
