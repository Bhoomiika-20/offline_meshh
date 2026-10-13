# Review 2 — contribution and demonstration plan

Replace placeholders with actual names. The table assigns work; a member should claim completion only after reviewing, running, explaining and validating their component.

| Member | Files owned | Responsibility | Evidence to present |
|---|---|---|---|
| Member 1 | `apps/mobile/src/App.js`, `store.js`; React dashboard UI | Screens, composer validation, Redux, alert feed and peer status | Create alert; display payload fields; show saved alerts |
| Member 2 | `apps/mobile/modules/mesh-native/.../MeshNativeModule.kt`; native permissions | Discover, pair, connect, transfer, disconnect; native integration | Two-phone offline transfer and connection failure handling |
| Member 3 | `packages/core/index.js`, `tests/protocol.test.js`, mobile service adapter | K-neighbour relay, TTL, exact UUID deduplication and shared contracts | Three-phone A–B–C test, TTL=1/2, cyclic duplicate test |
| Member 4 | `MeshDatabase.kt`, `apps/server`, analysis script, integration report | SQLite/history, logs, MongoDB archive and evidence collection | Restart persistence, JSON export/import, event correlation |

All members own integration. Member 2’s native module is the main hardware risk; Member 3 should pair with them while Member 1 and Member 4 connect UI/storage. Architecture must be understood by everyone.

## Review presentation sequence

1. Architecture: distinguish on-phone relay from optional laptop archive (one minute).
2. Explain the alert fields, TTL semantics and pending security (one minute).
3. Pair A–B and B–C; show no A–C connection. Turn cellular internet off (two minutes).
4. Fresh alert with TTL 2 reaches C through B. Display UUID and logs on all three phones (two minutes).
5. Fresh alert with TTL 1 reaches B and stops. Local duplicate test increments duplicate_drop without another feed entry (one minute).
6. Restart a phone; history and UUID suppression persist. Export one phone’s logs, then show the dashboard archive (two minutes).

If the hardware build or radio test has not passed, explicitly present the browser as a **simulation**, show completed source and tests, and list the remaining hardware gate. A screenshot of simulated phones is not evidence of BLE/Wi-Fi radio propagation.

## Physical acceptance checklist (fill after testing)

| Test | Expected | Observed / phone models / Android version |
|---|---|---|
| Native release build | APK installs and opens without Metro | Not yet recorded |
| Permission denied | Visible error; no fake discovery | Not yet recorded |
| Pairing | Same code on both devices; accept/reject works | Not yet recorded |
| A–B offline | Fresh alert received without cellular internet | Not yet recorded |
| A–B–C, TTL=2 | C receives through B with zero remaining hops | Not yet recorded |
| TTL=1 | B displays; C does not receive | Not yet recorded |
| Duplicate | One feed row; duplicate_drop log | Not yet recorded |
| Restart | Alerts/seen UUIDs remain | Not yet recorded |
| Disconnect during send | Explicit failure or remote receipt evidence | Not yet recorded |
| Export | Android-labelled JSON opens and imports into MongoDB | Not yet recorded |

No “40–50% completed” claim is computed from module count. The guide’s rubric and observed acceptance results determine completion.

Review 2 additions and the K demo are in REVIEW2_GUIDE.md; Windows phone setup is in ANDROID_REVIEW2.md.
