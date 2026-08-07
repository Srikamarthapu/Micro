# Mobile Prototype Agent Guide

## Prototype Instructions

In ChatGPT Work Mode, run `sites-preview start "$PWD"`, open `http://terminal.local:4173/` in the cloud browser, and verify the rendered app and its primary interactions. Keep that preview open and tell the user to inspect it in the cloud browser; do not present the local URL as a user-facing chat link. In Codex Desktop, run the local server yourself, open the preview in the in-app browser, and provide the clickable local URL. Do not deploy to Sites unless the user explicitly asks to share, publish, or deploy. Do not give the user server-start instructions when you can run it.

Before planning or implementing any mobile-app change, read this `AGENTS.md` in full. It is the source of truth for the template's runtime and component guidance.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Editing Boundary

- Build app-specific UI in `src/Prototype.tsx` and `src/prototype.css`.
- Treat `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `src/mobile/`, `public/assets/iphone/`, `public/assets/android/`, `public/assets/status/`, `vite.config.ts`, `worker/index.js`, and `scripts/prepare-sites-build.mjs` as protected runtime files. Do not edit, replace, remove, or recreate them unless the user explicitly asks to change the mobile runtime itself. For an explicit runtime change, update the affected lock hashes only after verifying the new runtime behavior.
- Run `npm run check:runtime` before preview or handoff. If it fails, restore the protected runtime instead of weakening or bypassing the check.
- `npm run build` preserves the mobile runtime and prepares the static Cloudflare Worker output required by Sites. Before a Sites handoff, confirm `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json`, and source `.openai/hosting.json` exist, then run `npm run test:sites`. Do not replace this project with a Vinext starter.

## Runtime Contract

- Preserve the mobile device runtime unless the user's task explicitly asks otherwise. Do not replace it with a standalone page. Visual fidelity applies to app-owned content inside the device screen, not to template-owned device chrome.
- Keep `App` composed around `PhoneFrame` -> `KeyboardProvider`, with `StatusBar`, app content, `HomeIndicator`, and `KeyboardDock` mounted inside the phone frame. `StatusBar` and the iOS home indicator are overlaid device chrome. When the Android keyboard is closed, the app viewport reserves the protected navigation-bar region instead of painting behind it. When the Android keyboard is open, preserve the current full-screen keyboard layout: its asset includes the IME navigation strip and the separate black navigation bar is hidden. iOS screens continue to paint behind the home-indicator area and own their safe-area content padding.
- Preserve the `iPhone` / `Pixel 10` device picker and both calibrated device presets. The Pixel screen is `427 x 952`; its `32 x 32` camera circle and `public/assets/android/navigation-bar.svg` bottom navigation bar are protected device chrome, not app content.
- Preserve the device picker's intentionally lightweight Codex styling in the top-right corner: its trigger wrapper is borderless and transparent, its trigger sizes to content, and its right-aligned menu uses the compact 3px inset plus the specified hairline and elevation shadow layers. Keep the prototype root and default app screen white.
- Preserve `StatusBar` as live device chrome, including its platform-specific typography, source status-icon assets, and spacing. Pixel 10 uses Roboto, Android indicators, and 32px top, left, and right padding. iPhone uses its iOS indicators, system typography, and calibrated spacing. Do not hardcode screenshot times like `9:41` into the status bar, replace its real-time clock, or move status bar content into app markup unless the user explicitly asks for a fixed/mock device time.
- `PhoneFrame` owns the calibrated device frame, screen portal, device picker, camera cutout, and custom cursor. Keep device assets in `public/assets/iphone/` and `public/assets/android/`; if an asset fails to load, repair the asset path or restore the asset instead of removing the frame, keyboard, or image render.
- Use `MobileScroll` directly for simple single-screen prototypes. Use `FlowStack` for conventional multi-screen flows whose routes can own their fixed header and footer; when using it, define each route as a `FlowScreen`: `{ id, header?, headerHeight?, footer?, footerHeight?, render }`, and use `flow.push(screen)`, `flow.pop()`, and `flow.replace(screen)` from `FlowStack` render callbacks or `useFlow()` instead of introducing another router.
- Use `Carousel` for a carousel, horizontal rail, swipeable cards, image or media strip, horizontally scrollable cards, chip rail, or other horizontal collection.
- For a layered app shell—such as a persistent composer, independently presented sheet, pushed/peek sidebar, or app-wide transition—compose directly in `Prototype.tsx` rather than forcing it through `FlowStack`. Keep app-owned fixed chrome as sibling layers outside `MobileScroll`.
- When using `FlowScreen`, put route-owned fixed headers or footers in `FlowScreen.header` or `FlowScreen.footer`. Set `headerHeight` to the visible app-toolbar height; `FlowStack` adds the device's top safe-area/status-bar inset automatically. Do not include `StatusBar` or its height in the header. Set `footerHeight` to the full app-footer height. `FlowScreen.footer` is an overlay, not reserved layout space; screens using it must add their own bottom content padding such as `padding-bottom: calc(var(--flow-footer-height) + var(--mobile-safe-area-height) + 24px)` so final content can scroll above the footer while still painting behind it.
- Render only scrollable content inside `MobileScroll`; it is for content that should move with scroll and rubber-band overscroll. Keep app-owned headers, nav bars, tabs, composers, and overlays outside it. This keeps scroll physics, safe areas, keyboard insets, scrollbars, and drag click suppression active without letting content paint under fixed chrome.
- Buttons, links, cards, and images inside `MobileScroll` should still allow drag scrolling when the pointer moves beyond tap slop. Use `data-scroll-drag="ignore"` only for rare controls that must own the drag gesture themselves.
- Do not add `var(--keyboard-height)` to ordinary screen/content padding inside `MobileScroll`; the scroll viewport already shrinks above the simulated keyboard. For custom fixed composers, search bars, or toast chrome, use `useKeyboardInsets().bottomInset`. It is relative to the app viewport: Android returns `0` while the closed-keyboard viewport already reserves navigation, then returns the keyboard height while open; iOS continues to clear the home indicator while closed and ride directly above the keyboard while open. Do not pin custom bottom chrome to `bottom: 0` or only `keyboardHeight`.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for every text-entry control. A raw `input` or `textarea` disconnects focus, keyboard animation, safe-area insets, and attached surfaces.
- Use `BottomSheet` for phone-scoped sheets. Its props are `open`, `onOpenChange`, `title`, optional `description`, optional `snap`, and `children`; it renders through the phone screen portal and dismisses the keyboard before opening.

## Horizontal Carousels

- Use `Carousel` for horizontally draggable cards, images, media, chips, or other horizontal collections. Do not recreate these with `overflow-x`, custom pointer handlers, or a generic div.
- `Carousel` can be nested directly inside `MobileScroll`. It owns horizontal gestures and automatically yields vertical gestures to the parent.
- Never put `data-scroll-drag="ignore"` on or around a `Carousel`; doing so prevents vertical parent scrolling when a gesture begins inside it.
- Do not add CSS scroll snapping to `Carousel`; its runtime owns momentum and release motion.
- Use `data-scroll-drag="ignore"` only when a control must prevent parent scrolling in every drag direction.

See `src/mobile/COMPONENTS.md` for the full component and gesture contract.

## Keyboard Rule

The simulated keyboard is a separate top-layer component. Before presenting anything that behaves like iOS navigation or modal UI, dismiss it first.

Call `keyboard.hide()` before:

- pushing, popping, or replacing FlowStack routes
- opening bottom sheets, action sheets, dialogs, menus, or navigation sheets
- starting transitions where the destination should not inherit text-input focus

`FlowStack` already hides the keyboard for `push`, `pop`, and `replace`. `BottomSheet` already hides it before opening. If you add new modal/sheet/navigation primitives, follow the same rule.

When a composer, search surface, or other keyboard-attached component closes, call `keyboard.hide()` in the same event before changing that component's open state. Position attached surfaces from `useKeyboardInsets()` rather than a separate timer or visibility flag so both dismiss together.

When any text-entry control loses focus, dismiss the simulated keyboard. If the control is custom or does not use the runtime's keyboard-aware fields, handle its blur event and call `keyboard.hide()` explicitly. Keep the keyboard open only when focus is moving directly to another text-entry control that should share the same keyboard session.

## Interaction Rules

- Do not trigger buttons or inputs after a pointer has become a drag. Preserve the drag suppression behavior in `MobileScroll`.
- Do not allow native browser image/file dragging inside the phone frame. Preserve the phone-level `dragstart` suppression and non-draggable image styles so scroll drags that begin on images still scroll the prototype.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for text entry so the simulated keyboard and safe-area insets stay connected.
- Fixed phone chrome should not animate with pushed screens. Screen content can animate; the status bar, camera cutout, and preview chrome should stay put.
- Keep the keyboard below the home indicator/safe area layer in z-index, and above ordinary app UI while visible.
- Keep the home indicator as the topmost safe-area layer in the z-index above everything else in the prototype.

## Micro Product Direction

- The latest durable reference set is `/Users/kamarthapusri/.codex/attachments/a19b791b-3306-475a-9e62-267a73f74008/`. Treat `image-3.png` as clean visual inspiration for composition, hierarchy, spacing, and polish. It is not a product-content reference: do not copy its commerce language, shopping patterns, or catalog semantics into Micro.
- Treat `image-1.png` and `image-2.png` in that same reference set as repair examples only. They document visual problems to correct; do not reproduce their clipped status-card treatment, generic marker treatment, density, or crop as a desired direction.
- The earlier parchment-and-watercolor direction at `/Users/kamarthapusri/.codex/attachments/532c6efa-9a59-4b96-a512-abf06067913b/image-1.png` is superseded by this explicit redesign direction and is retained only as project history, not as the current implementation target.
- Preserve Micro's civic semantics while redesigning: nearby paid tasks, Community Help, Sponsored help, trustworthy neighbor identity, task scope, fair-pay clarity, safety boundaries, youth/guardian consent, and lifecycle status must remain plain and legible. Micro should feel like neighborhood coordination, never a shopping app or generic gig marketplace.
- Use an airy white and cool pale-blue foundation, bold clean hierarchy, generous breathing room, crisp dark typography, subtle borders, and restrained elevation. Keep teal primary actions, blue Community Help cues, and purple Sponsored cues semantic and selective rather than decorative.
- Prefer natural human photography for map-marker identity only. Map markers should use centered circular avatar photos that remain readable at roughly 38–52px, with a clear selected state and accessible non-photo fallback.
- Do not place PFP photography in task cards, the Nearby header, message rows, task-detail requester blocks, Youth Mode cards, access fixtures, or other routine components. Those surfaces retain Micro's normal category icons, initials, and compact trust treatments so identity imagery never overwhelms task content.
- Profile-photo selection is a frontend-only demo setting whose chosen local file powers the current persona's own future map marker. Keep the normal initials treatment on the Profile card itself, preview the chosen file only inside the photo-setting control, and never imply that an account photo was uploaded, synced, moderated, or stored remotely.
- Keep the map plus nearby-task surface and five persistent labeled tabs as Micro's recognizable civic shell unless the user explicitly changes that structure.
- Treat visual cleanliness as a primary product constraint: keep the first viewport focused on the map, one selected task, and one primary action; use concise card copy, stable equal-width navigation, restrained badges, and progressive disclosure for secondary metadata and safety detail.
- Requesters never write a listing. Every published task comes from the reviewed catalog in `src/taskCatalog.ts` (200 tasks across 12 categories): the requester picks an entry, answers its bounded options, and `composeListing()` writes the title, description, inclusions, exclusions, completion check, duration, and suggested pay. Moderation is therefore a property of the data, not a filter applied afterwards, so there is no prohibited-keyword regex to maintain. Do not reintroduce free-text title, description, scope, or completion fields; if a task is missing, add a catalog entry with its own safety boundary and pay band. The private match address stays the one typed field and is never public.
- Catalog categories are the source of truth for task categories everywhere, including the Nearby filter chips and fixture task `category` strings. Each category owns a `boundary` shown at the safety check and a `baseExcluded` clause every task in it inherits; each entry owns its own `modes`, `youthEligible`, `minutes`, and `pay`. Start times are the bounded `startTimeSlots` rail — do not return to a typed time string.
- Micro's geography is Oakland and Alameda. Areas are a bounded enum in `src/Prototype.tsx` (`areas`): `all` (Oakland & Alameda), `downtown`, `temescal`, `fruitvale`, `westoak`, `alameda`. Each carries a `center`, a `zoom`, and a display label. Do not reintroduce free-text area strings, and keep `all` as the explicit region-wide sentinel rather than overloading a real neighborhood.
- Every task carries `coords: LatLng` and an `areaId`. Distance is always computed with `distanceMiles()` from the viewer's own profile area, never stored as a string. Adding a task without coordinates will place it at the map centre.
- The Nearby map is the **Maps JavaScript API** via `@vis.gl/react-google-maps`. Google owns positioning; markers are `AdvancedMarker` carrying Micro's avatar bubbles. Do not reintroduce hardcoded `.pin-*` coordinates or hand-rolled projection.
- The map owns its drag gesture, so `.map-stage` carries `data-scroll-drag="ignore"`. A drag starting on the map pans it instead of scrolling the page; that is intended.
- Each area clamps the map: `minZoom`/`maxZoom` bound zoom, and `restriction` fences panning to `areaBounds()` derived from `spanMi`. Keep `spanMi` comfortably larger than the viewport at `minZoom` — otherwise the fence clamps zoom-out before `minZoom` and the floor drifts with device and sheet height. Selecting an area reframes the map; panning afterwards is the user's and must not be yanked back.
- Maps JavaScript is billed per map load, not per pan or zoom. Do not add geocoding, Places autocomplete, or per-keystroke map calls; Nearby search stays client-side over already-loaded fixtures.
- The key comes from `VITE_GOOGLE_MAPS_API_KEY` and ships in the client bundle, so it must stay referrer-restricted and limited to the Maps APIs actually in use. `VITE_GOOGLE_MAPS_MAP_ID` is required for Advanced Markers; `DEMO_MAP_ID` is the development-only fallback.
- A missing key, a rejected key, or a disabled API must degrade to the labelled placeholder rather than an empty frame captioned as if it were showing locations. Google reports these through `gm_authFailure` and by simply not painting `.gm-style`, so both signals are watched.
- Be explicit that this is a local prototype. Maps, photos, identity, task data, messages, payments, moderation, and notifications are fixtures or browser-local preview state until secure backend services exist.
- Animation-library ideas may inform tactile motion and state transitions, but this prototype should not import web-only 3D or scrolling effects that compromise the native mobile feel, accessibility, or performance.
