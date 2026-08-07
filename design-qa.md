# Micro design QA — clean navigation and density pass

## Evidence and target

- User issue crop, Messages selected: `/var/folders/8w/t8c81jyx39s8szjv3wk71tt00000gn/T/codex-clipboard-8d27b2e1-edb6-4589-b49e-c6f2b860bc19.png` (`634 × 218`).
- User issue crop, Nearby selected: `/var/folders/8w/t8c81jyx39s8szjv3wk71tt00000gn/T/codex-clipboard-bdc6e6a6-be34-4f65-babf-fd20542cca5e.png` (`718 × 274`).
- Ooru native structural reference, Home: `/var/folders/8w/t8c81jyx39s8szjv3wk71tt00000gn/T/screenshot_optimized_93a98805-e310-4230-a699-1f6d4bf63989.jpg` (`368 × 800`, iPhone 17 Pro Simulator).
- Ooru native structural reference, Messages selected: `/var/folders/8w/t8c81jyx39s8szjv3wk71tt00000gn/T/screenshot_optimized_09478e6c-3f42-4d1d-ba28-a3f541dd54cf.jpg` (`368 × 800`, iPhone 17 Pro Simulator).
- Pre-change Micro implementation captures: `/tmp/micro-cleanliness-audit-2026-08-07/01-nearby.png` through `05-profile.png` (`1280 × 720` browser-canvas captures).
- Current implementation URL: `http://127.0.0.1:4174/`.
- Intended calibrated CSS viewports: iPhone `393 × 852` at density `1`; Pixel 10 `427 × 952` at density `1`.
- State: root Nearby view with the half-height task sheet, selected task, and persistent five-tab navigation; root Activity, Messages, and Profile states were also reviewed before implementation.

Ooru is used only for structural restraint: safe-area ownership, inset navigation geometry, stable tab sizing, spacing rhythm, and progressive disclosure. Its family-care meaning, heartbeat language, colors, messages, and product-specific concepts are explicitly out of scope for Micro.

## Comparison history

### Pass 1 — issue evidence and pre-change Micro

- **P1 — active nav item entered the phone safe area.** In both user crops, the selected item stretched into the home-indicator region and touched the outer bar edge. Inspection found that `.bottom-nav` referenced `--mobile-safe-area-height` outside the element where that variable exists, invalidating the full padding shorthand. The single grid row then stretched each tab to the bar's full height.
- **P1 — content rendered under persistent navigation.** The root `MobileScroll` extended to the bottom of the app viewport while the navigation overlaid it. The selected Nearby CTA was visibly obscured in the pre-change capture.
- **P1 — Nearby density was too high.** Six portrait markers, a selected label, map note, full task description, three fact rows, optional youth treatment, and a CTA competed in the first viewport.
- **P1 — Activity exposed status, notifications, sponsored help, and multiple history records at once.** There was no strong now-versus-history hierarchy.
- **P2 — Profile stacked separate trust surfaces and a full marker-photo editor before the end of settings.** The photo editor was useful but too prominent for a secondary local-prototype preference.
- **P2 — navigation labels rendered larger than intended.** A higher-specificity inherited font rule overrode the nav's font size and weight.

### Repairs made

- Rebuilt the navigation as a safe-area-aware outer wrapper with a bordered white rail, 6px inner padding, five stable equal columns, 54px tab targets, 22px icons, 11px labels, and an independent animated active cushion.
- Added explicit iPhone and Android nav-safe variables and ended the root tab scene above the nav, so scrolling content cannot paint beneath persistent navigation.
- Removed the duplicate legacy navigation CSS block that caused the regression-prone override chain.
- Limited the map to the selected marker plus the three nearest visible markers; all tasks remain available in the list.
- Shortened the default map and replaced list-card descriptions plus three fact rows with one concise time, duration, and fair-pay or volunteer metadata line. Full scope and safety detail remain in Task details.
- Reduced root heading scale, selected-card outline weight, shadows, and excess sheet spacing while preserving 48px controls and semantic teal, blue, and purple states.
- Changed Activity history to one visible record plus an accessible View all control, and only presents the full Sponsored help surface when it needs attention.
- Joined Profile's stats and reliability surfaces visually and moved the map-marker photo editor into a dedicated bottom sheet reached from one compact Preferences row.
- Preserved Micro's own civic semantics, map-only portrait rule, and explicit local-prototype boundaries.

## Required fidelity surfaces

- **Fonts and typography:** Atkinson Hyperlegible remains the body and UI family; Fraunces remains limited to the Micro wordmark and existing display hierarchy. Root headings are reduced to 31px, task-sheet heading to 25px, and nav labels are explicitly fixed at 11px with a higher-specificity selector.
- **Spacing and layout rhythm:** Navigation follows a 6px internal rhythm with 16px side insets and independent safe-area clearance. Routine cards use an 18px radius; major map and sheet surfaces use 26px. The root scene now reserves the full navigation height.
- **Colors and tokens:** Micro retains white and pale blue foundations, navy ink, teal primary actions, blue Community Help, and purple Sponsored help. Ooru's sage, clay, and care-state palette was not copied.
- **Image quality and asset fidelity:** Natural photography remains exclusive to centered circular map markers. Task cards, Messages, Profile identity, Youth Mode, and other routine components retain category icons or initials. No new generated or approximate visual assets were introduced.
- **Copy and content:** Micro retains nearby paid tasks, Community Help, Sponsored help, fair-pay or volunteer clarity, approximate location, youth and guardian boundaries, and local-prototype disclosures. No Ooru-specific copy or meaning was transferred.

## Verification

- Ooru `main` at `c19ee030` was built and run in a fresh isolated native workspace on an iPhone 17 Pro Simulator. Home and Messages were captured, and the Messages tab interaction succeeded. The user's Ooru checkout was not edited.
- `npx tsc --noEmit`: passed.
- `npm run check:runtime`: passed; all 28 protected mobile runtime files remain unchanged.
- `npm run build`: passed and produced the client, Worker, and hosting metadata.
- `npm run test:sites`: passed 4 of 4 tests.
- `git diff --check`: passed.
- Local preview health: `HTTP/1.1 200 OK` at `http://127.0.0.1:4174/`.

## Remaining blocker

The Codex in-app browser's local-URL security policy rejected the automated refresh of the current `127.0.0.1:4174` tab after the final changes. Because a fresh post-fix Micro screenshot could not be captured in the required browser, the revised iPhone and Pixel layouts could not be placed beside the issue and Ooru reference images for a valid final visual comparison. No alternate browser or Playwright CLI was used.

The implementation and build checks are complete, but visual QA remains blocked until the user refreshes the live preview for the planned user test or a later in-app-browser capture becomes available.

final result: blocked
