# MeshAid Review 2 — start here

This is the COMPLETE updated project based on your existing offline-mesh repository
(commit a506fac). No manual file merging is needed. Extract the ZIP to a new folder
and open that entire folder in VS Code. Keep the old folder as a backup if you have
local changes or an .env; do not extract on top of it.

## 1. Laptop dashboard — start with this

Install Node.js 22.12+ (Node 24 also works). Open the VS Code terminal in the folder
containing package.json, then run:

```powershell
npm ci
npm run dev:web
```

Open http://localhost:5173. MongoDB and Android Studio are not required for this step.

What is new:
- Every simulated phone has a saved neighbour limit: All, or K = 1–16.
- Android uses the same relay engine and also saves its K setting.
- The Results tab shows captured nodes, receipts, duplicate drops, failures,
  and stored copies per alert.
- Import A/B/C Android JSON exports TOGETHER into Results. It works without MongoDB.
- Download a separate results report for review evidence.

## 2. Easy demo on the laptop

1. Keep A–B and B–C checked; leave A–C unchecked. Set K to All on each phone.
2. Send a NEW alert from A with hop limit 2. Inspect C: it stores the alert with 0 hops.
3. Open Results: this alert should have stored copies on 3 / 3 captured nodes.
4. Inject a duplicate on C. Duplicates stopped increases; there is no new alert row.
5. To show K: keep A–B and A–C, turn B–C off, and use hop limit 1.
6. Select A, set K=1, and send a fresh alert. Only one neighbour receives it.
7. Set A to All and send another fresh alert. Both neighbours receive it.
8. Compare the two UUIDs in Results. Less fanout may also mean less coverage.

## 3. Android — build and real phones

Read docs/ANDROID_REVIEW2.md. It has the Windows prerequisites, exact commands,
phone installation steps, test checklist, and troubleshooting.

IMPORTANT: Expo Go cannot run this app's custom Kotlin Nearby/SQLite module.
Use the custom release-variant build. Android source/prebuild checks are NOT an APK
or proof of physical radio behaviour. Actual APK compilation and the phone demo
still need your laptop and phones. Keep the app in the foreground.

## 4. Explain it in the review

Read docs/REVIEW2_GUIDE.md for short Hinglish viva answers and the demo order.
Read docs/VALIDATION.md for what was actually verified.

## 5. Optional backend

Only needed to archive runs in MongoDB, not for phone-to-phone delivery or the
Results tab. The original Express/MongoDB workflow remains in README.md.

## What has NOT been added

Ed25519/libsodium/TOFU, Bloom filters, protobuf, Room/LRU, background delivery,
retry/catch-up, separate radio adapters and research-scale metrics are still pending.
The added K selection is a simple deterministic cap on neighbours, not randomized
gossip. All is the original forwarding behaviour. No new dependencies were added.
