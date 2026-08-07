# Micro design QA — map-only profile photo cleanup

## Evidence and target

- User-reported broken-state screenshot: `/var/folders/8w/t8c81jyx39s8szjv3wk71tt00000gn/T/codex-clipboard-d160f53f-3d4a-4b7a-a12b-7bc69489f710.png` (`546 × 1210`).
- Current clean composition reference: `/Users/kamarthapusri/.codex/attachments/a19b791b-3306-475a-9e62-267a73f74008/image-3.png` (`929 × 668`).
- Current implementation: `http://127.0.0.1:4174/` in the Codex in-app browser.
- Intended calibrated device viewports: iPhone `393 × 852`; Pixel 10 `427 × 952`.
- Primary state under review: Nearby map, half-height task sheet, selected task, persistent five-tab navigation.

The clean reference is used for composition, breathing room, hierarchy, and restraint only. Micro retains its own civic task semantics and does not copy commerce content.

## Broken-state findings and repairs

1. **P0 — portrait imagery escaped its intended slots.** A broad avatar image rule expanded multiple profile photos into overlapping full-width layers. Avatar image sizing is now scoped to the map marker bubble and the explicit marker-photo preview in Profile. `PersonAvatar` is no longer used in task cards, task detail, header, Messages, Youth, access, or blocked-person surfaces.
2. **P1 — header identity and controls collided.** The wordmark, subtitle, area selector, and profile control competed for horizontal space. The header is now a constrained single-row grid with the Micro wordmark, one area selector, and a conventional icon action.
3. **P1 — selected task anatomy was replaced by a portrait crop.** Nearby cards now use the normal category icon, requester label, title, pay or civic status, metadata, and action hierarchy. No task-card portrait is rendered.
4. **P1 — inconsistent component spacing and visual language.** The app content now uses an airy white and pale-blue base, crisp dark type, restrained borders/elevation, semantic teal/blue/purple accents, 48px minimum controls, and a consistent spacing/radius scale.
5. **P1 — map identity was generic or unreadable.** Only map markers use profile photos, constrained to `48px` with a `52px` selected state, semantic mode cues, a visible selected state, and initials/icon fallback.
6. **P2 — Activity summary icon inherited an oversized orbit rule.** Selector specificity now keeps the compact status icon inside its intended summary card.
7. **P1 — Post preview labels could overlap listing titles.** Preview badges and pay are now in the card grid instead of being absolutely positioned over the title.
8. **P2 — task category icons could lose centering.** Requester caption styling is now limited to the copy column, preserving the icon's centered grid layout.
9. **P2 — local photo choice could imply upload.** Profile labels the marker photo as a browser-local preview and explicitly states that it is not uploaded, synced, or moderated.

## Source and production checks

- Profile-photo scope inspection: only map pins and the Profile marker-photo chooser use `PersonAvatar`.
- No CSS gradients remain in the app-owned stylesheet.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run check:runtime`: passed; all 28 protected mobile runtime files remain unchanged.
- `npm run build`: passed and produced the required client, worker, and hosting artifacts.
- `npm run test:sites`: passed 4 of 4 checks.
- `git diff --check`: passed.
- Local preview health: `HTTP/1.1 200 OK` at `http://127.0.0.1:4174/`.

## Visual and interaction verification

- Fresh in-app browser renders were inspected on August 6, 2026 in both calibrated device frames. The iPhone and Pixel 10 default Nearby views keep the header, search controls, map, marker portraits, selected task card, task sheet, and five-tab navigation within their intended bounds.
- The current implementation was compared against the user-reported broken-state screenshot. The stacked full-width portraits, split wordmark, oversized task crop, and component collisions are no longer present. Profile photography appears only in the circular map markers; ordinary cards and controls retain icons or initials.
- Selecting Devon's map marker updated the selected task to “Move two boxed lamps.” The Filters sheet opened with mode, category, time, distance, and youth controls, and the Paid task filter reported two matching tasks.
- Task detail opened from Nearby with scope, exclusions, completion criteria, privacy boundary, trust treatment, pay breakdown, save/report actions, and the primary commitment action intact.
- Activity rendered the empty-commitment action, sponsored-help state, and completed history. Messages rendered three local fixture threads. Profile rendered the normal initials card and a separate browser-local “Your map marker” photo setting. Post rendered step 1 of 4 with all three participation modes.
- Fresh iPhone and Pixel checks plus the exercised primary screens produced no browser console warnings or errors.
- The preview remains open at `http://127.0.0.1:4174/` for handoff.

The older files under `qa/` describe the superseded parchment direction and remain historical evidence only; they are not presented as current visual targets.

final result: passed
