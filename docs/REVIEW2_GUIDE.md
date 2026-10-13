# Review 2 — easy explanation and demo

## What changed since Review 1?

"Review 1 mein basic relay, TTL aur UUID duplicate suppression tha. Review 2 mein
humne configurable K-neighbour forwarding, a results panel, aur Android test
workflow add kiya. Same relay engine web simulation aur Android use karte hain."

Only say real-phone testing is completed AFTER the team records successful tests.
Simulation screenshots and an Android JavaScript bundle are not hardware evidence.

## K-neighbour forwarding — simple Hinglish

"Har node maximum K connected neighbours ko alert bhejta hai. Jis neighbour se
alert aaya usko wapas nahi bhejta. All mode mein sab eligible neighbours ko bhejta
hai. Chhota K sends kam kar sakta hai, par coverage bhi kam ho sakti hai."

- K = kitne neighbours ko bhejna.
- TTL / hop limit = alert kitni transmissions door tak ja sakta hai.
- UUID = unique alert identity; same alert dobara relay nahi karna.
- Selection = sorted peer IDs se first K. Demo repeatable rehta hai. Randomized
  gossip/rotation and guaranteed full-network delivery are NOT claimed.
- Each PHONE has its own K setting, saved after restart; it is not a global radio
  setting and is not embedded in each alert's JSON.

## Very short cross questions

**Why add K?** "Forwarding fanout control karne ke liye. Har alert ko har peer
ko bhejna zaroori nahi; tradeoff fewer sends versus possible lower coverage hai."

**K=1 means one hop?** "Nahi. K neighbours ki count hai; TTL distance control
karta hai. Chain A–B–C mein K=1 aur TTL=2 se C tak pahunch sakta hai."

**Is this Bloom filter?** "Nahi. Duplicate detection exact persistent UUID registry
se hoti hai. Bloom filter later optimization hai."

**Does MongoDB send alerts?** "Nahi. Phones Nearby Connections se baat karte hain.
MongoDB optional laptop archive hai. Results import bhi server ke bina chalti hai."

**Does Nearby itself make the mesh relay?** "Nearby local links aur payload transfer
deta hai. Our shared RelayEngine multi-hop forwarding, TTL aur duplicates handle
karta hai."

**Is the alert signed?** "Nahi. Pairing codes connection confirm karte hain;
Ed25519/TOFU alert security abhi pending hai."

**What does coverage mean in Results?** "Selected alert kitne exported nodes ke
storage mein present hai, divided by exported node count; origin present ho toh
include hota hai. Yeh full network delivery guarantee nahi hai."

**Why no latency card?** "Different phones ki clocks directly comparable nahi hoti.
Clock synchronization ke bina cross-phone latency reliable nahi hai."

**Does sent prove receipt?** "Nahi. Nearby transfer complete hona aur receiving
app ka received event alag hain. Same UUID ke remote logs check karte hain."

## Presentation order (about 5 minutes)

1. Problem: Internet fail ho toh local phones alerts relay karein.
2. Architecture: React Native UI -> shared relay -> Kotlin Nearby + SQLite.
3. New K setting: All vs K=1 on a two-neighbour, one-hop experiment.
4. TTL=2 A–B–C and TTL=1 stopping at B.
5. Duplicate suppression, restart history, JSON export, Results evidence.
6. Explicitly identify simulation versus actual phone observations and pending work.

If physical testing has not passed, show the web simulation and actual test status.
Do not label simulated numbers as radio measurements.

## Four-member split

| Member | Work to explain |
| --- | --- |
| 1 | Android/web UI, settings, alert composer and feed |
| 2 | Android build, permissions, Nearby pairing and direct transfer |
| 3 | K selection, relay, TTL and UUID duplicate handling |
| 4 | SQLite, exports, Results and optional MongoDB archive |

## Read only these files first

- packages/core/index.js — relay, TTL, UUID checks, K selection.
- apps/web/src/Results.jsx — results UI; packages/core/review.js computes summaries.
- apps/mobile/src/service.js — connects UI, relay engine and native module.
- docs/ANDROID_REVIEW2.md — build and physical acceptance checklist.

No new libraries were added. The existing project and folder layout are retained.
