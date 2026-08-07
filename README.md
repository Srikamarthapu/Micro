# Micro

Micro is a warm, trust-first mobile prototype for arranging small neighborhood tasks. This repository is the front-end baseline from the v1.0 product requirements: it brings the core experience, safety boundaries, role handoffs, and visual system to life with realistic local fixture data.

## What is included

- Nearby discovery with search, approximate-area controls, filters, map/list coordination, and paid, Community Help, and Sponsored modes.
- Detailed task scope, exclusions, completion criteria, requester trust, fair-pay totals, privacy-safe media, save, and report states.
- A four-step posting flow with category risk review, privacy guidance, time/pay validation, private/public address boundaries, and a final listing review.
- Role-aware Activity journeys for start PINs, completion evidence, requester confirmation, simulated payout, cancellations, no-shows, support pauses, service hours, and structured reviews.
- Protected task threads with immutable lifecycle records, local messaging, reporting, blocking, and review-only youth/guardian states.
- Adult, youth, and guardian fixtures with task-specific approval, age/consent gates, persona-isolated records, and shared safety holds where roles overlap.
- Responsive iPhone and Pixel 10 frames using the protected mobile runtime.

## Current redesign direction

The latest review set uses `image-3` as clean visual inspiration and `image-1` / `image-2` as repair examples only. Micro borrows the reference's visual discipline—not its commerce content or shopping behavior.

- The interface uses an airy white and cool pale-blue foundation, bold readable hierarchy, generous spacing, subtle borders, restrained depth, and semantic teal, Community Help blue, and Sponsored purple accents.
- The product remains civic neighborhood coordination: nearby tasks, human trust, clear scope, fair pay, Community Help, sponsorship, safety, consent, and lifecycle status stay more important than decorative polish.
- Natural human photography is reserved for map-marker identity. Map pins use centered circular avatars designed to remain readable at 38–52px; routine cards, headers, message rows, and trust surfaces keep the normal compact icon or initials treatment.
- Profile-photo controls preview a user-selected local image only inside the setting and use it for that persona's future map marker, with a seeded portrait or person-icon fallback. That interaction never suggests a remote account upload or permanent storage.
- The map, nearby-task surface, and five labeled tabs remain the recognizable mobile shell unless a later product decision explicitly changes them.

## Run locally

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 4174
```

Then open `http://127.0.0.1:4174/`.

## Verify

```bash
npm run check:runtime
npm run build
npm run test:sites
```

The visual QA record and final reference comparisons are in [`design-qa.md`](./design-qa.md) and [`qa/`](./qa/).

## Prototype boundary

This baseline intentionally does not connect production authentication, identity or age verification, payments, maps, push notifications, messaging, moderation, storage, or task APIs. All visible data and receipts are local fixtures, and the UI labels those boundaries directly. Any selected profile photo is a browser-local preview with an explicit fallback; it is not uploaded, synced, moderated, or permanently stored. The state seams are ready for secure services later without pretending those services exist today.
