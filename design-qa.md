# Micro design QA

## Visual target

- Source of truth: `/Users/kamarthapusri/.codex/attachments/532c6efa-9a59-4b96-a512-abf06067913b/image-1.png`
- Cropped reference: `/Volumes/Seagate /Micro/qa/reference-app.png`
- Final full-frame capture: `/Volumes/Seagate /Micro/qa/micro-full-final.png`
- Final iPhone capture: `/Volumes/Seagate /Micro/qa/micro-iphone-final.png`
- Final Pixel capture: `/Volumes/Seagate /Micro/qa/micro-pixel-final.png`
- Final side-by-side comparison: `/Volumes/Seagate /Micro/qa/comparison-final.png`

The final UI preserves the original warm parchment background, deep navy editorial type, teal primary action, restrained blue/orange/plum participation accents, quiet watercolor map, rounded task sheet, compact task card, and five-tab mobile navigation. The brighter alternate direction was not used.

## Visual review passes

1. Replaced the early generic map treatment with a generated, product-specific watercolor neighborhood map using the original design as the strict style reference.
2. Rebalanced the header, search, map, sheet, task card, badge, earning, and CTA proportions against a same-state reference/implementation comparison.
3. Corrected the selected-card title/badge/earning overlap and verified the primary CTA remains visible above the Pixel bottom navigation.
4. Rechecked both iPhone and Pixel device frames for cropping, readable hierarchy, target sizes, safe areas, and navigation clearance.

## Interaction coverage

- Nearby search, approximate-area selection, task type, time, distance, and youth filters update the list and map from one state.
- The task sheet cycles through collapsed, half, and expanded states and exposes its state to assistive technology.
- Paid tasks carry one identity through detail, commitment, Activity, PIN validation, simulated capture, completion checks, support-authority issue pauses, payout, rating, and completion. Completed tasks remain in history and cannot be accepted again.
- Community Help commitments use a separate payment-free lifecycle, including guarded cancellation, no-show records, in-progress safety pauses, service hours, and separate volunteer/requester reviews with no payment or show-up fee.
- A Community Help request can move to Seeking Sponsor and then Sponsored, with helper, fee, sponsor-total, and recipient-total lines.
- Posting validates category, scope, exclusions, completion criteria, schedule, private address, pay, safety, and cancellation acknowledgment; the published fixture returns to Nearby and Activity.
- All message rows open; sending, reporting, selecting a reason, blocking, support-pause receipts, and immutable local task records work. Participants cannot clear their own report, and review-only youth/guardian threads never fabricate pre-assignment messages.
- Adult, youth, and guardian fixtures keep commitments, saves, report receipts, blocks, messages, and history isolated while sharing explicit guardian decisions and task-level moderation holds where safety state must cross roles.
- Youth and guardian personas support request, approval, decline, blocked-task explanation, and acceptance gating. Seeded identity, age, terms, and guardian-link states are labeled as local fixtures.
- Notifications derive from the active persona’s approval, match, lifecycle, and task-event state instead of asserting unseen activity.

## Accessibility and trust review

- Route headings receive focus, consequential changes use restrained live regions, map and segmented controls expose selection, Post exposes progressbar semantics, and rating uses a radiogroup.
- Focus rings use high-contrast teal, the hidden photo input exposes a visible focus-within treatment, interactive targets are at least 48px, and reduced motion is respected by both Motion and CSS transitions.
- Exact addresses remain private before a protected match. Payment, identity, map, messaging, moderation, and notification states are explicitly labeled as test/local fixtures rather than live services.

## Verification

- `npm run build`: passed, including TypeScript and production packaging. The bundle-size advisory is non-blocking for this baseline prototype.
- `npm run check:runtime`: passed; all 28 protected mobile runtime files are unchanged.
- `npm run test:sites`: passed 4 of 4 tests.
- Fresh in-app browser cycles on iPhone and Pixel: no current application warnings or errors; only Vite connection and React development informational logs.
- Browser regressions passed for paid acceptance, paid completion and payout, both paid no-show roles, Community completion, Community cancellation/no-show, posting, reporting, notifications, youth approval, guardian lifecycle and report propagation, review-only messages, completed-task discovery removal, and persona state restoration.

final result: passed
