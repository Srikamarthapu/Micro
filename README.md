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

This baseline intentionally does not connect production authentication, identity or age verification, payments, maps, push notifications, messaging, moderation, storage, or task APIs. All visible data and receipts are local fixtures, and the UI labels those boundaries directly. The state seams are ready for secure services later without pretending those services exist today.
