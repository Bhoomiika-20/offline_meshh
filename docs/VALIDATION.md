# Review 2 validation report

Source baseline: Bhoomiika-20/offline-mesh commit a506fac.
Update checked on 2026-10-13. No Android hardware results are prefilled.

## Verified for this update

| Check | Result | Scope |
| --- | --- | --- |
| Automated tests | 21 passed | 11 protocol, 3 API contract, 4 result-summary/import, 3 browser-transport logic tests |
| Protocol behaviour | Passed | Original TTL/duplicate cases plus K cap, All compatibility, ingress exclusion, dynamic K, invalid settings |
| Result summaries | Passed | Per-alert stored-copy reach, retained event counts, repeated-export deduplication, missing snapshot scope, mixed-source rejection |
| Browser transport logic | Passed | A–B–C, triangle termination, K=1 first-hop reach, persistence after reload, failed-transfer logging |
| Browser interaction | Passed | A–B–C, duplicate, K persistence/reload, K vs All, per-alert results, report download, local multi-file import, repeated snapshot deduplication, mixed-source/malformed rejection |
| Desktop/narrow web layout | Passed | 1440 px and 390 px widths; no page-level horizontal overflow or page errors |
| React production build | Passed | Vite generated production assets |
| Android JavaScript/Hermes export | Passed | Updated screens, shared engine and result-summary code bundled |
| Expo native prebuild | Passed | Android project generated; this is not native compilation |
| Native-module autolinking | Passed | org.meshaid.nativebridge.MeshNativeModule discovered |

API tests use an injected in-memory repository, not a live MongoDB instance.
Browser import tests used synthetic Android-labelled fixtures only to exercise
validation and merging, not as evidence of physical radio results.
Android checks above are source/bundle/configuration checks, not an installed APK.

## Hardware gates still pending

- Native APK compilation and installation on the team's Windows/Android setup.
  This environment has JDK 17, but no configured Android SDK or connected phones.
- Physical Nearby discovery, permissions, pairing and simultaneous peer links.
- Real A–B offline delivery and A–B–C relay with hop limit 2.
- Native K-setting persistence, SQLite persistence and Android share-sheet export.
- A live MongoDB integration test.

The physical checklist and troubleshooting steps are in ANDROID_REVIEW2.md.

## Measurement limits

- Browser links use a fixed 180 ms synthetic delay; these are logic checks, not
  measured BLE/Wi-Fi radio results.
- "Sent"/"relayed" means transfer completion, not an application delivery ACK.
  Check the remote received event for the same UUID.
- Results coverage is stored copies across captured node snapshots only. Include
  the origin snapshot and all participating phones when assessing an experiment.
- Imported files must belong to the same experiment. The tool cannot infer this
  reliably from device timestamps. Export and clear between experiments.
- Each node retains at most 1,000 alerts and 5,000 log events. Partial or old logs
  do not establish a packet-loss rate.
- Monotonic timestamps from different phones/sessions cannot be subtracted.
  Cross-phone latency is omitted in the new Results UI.
- K chooses sorted eligible endpoint IDs, not random peers. Smaller K can reduce
  coverage, and first K may favour the same peers while connections remain stable.

## Scope intentionally unchanged

Unsigned alerts; exact UUID registry; JSON; direct SQLite; Google Nearby selecting
its radio medium; foreground operation; no retry queue or automatic reconnect
catch-up. Ed25519/TOFU, Bloom, protobuf, Room/LRU, explicit radio adapters,
background delivery and battery/range/churn measurements remain later work.

The existing dashboard-desktop.png/dashboard-mobile.png images are historical
Review 1 browser screenshots, not evidence for this update or Android hardware.
