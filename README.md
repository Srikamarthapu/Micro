# Micro

Micro is a warm, trust-first mobile prototype for arranging small neighborhood tasks. This repository is the front-end baseline from the v1.0 product requirements: it brings the core experience, safety boundaries, role handoffs, and visual system to life with realistic local fixture data.

## What is included

- Nearby discovery across Oakland and Alameda with search, a bounded approximate-area picker, filters, map/list coordination, and paid, Community Help, and Sponsored modes.
- Detailed task scope, exclusions, completion criteria, requester trust, fair-pay totals, privacy-safe media, save, and report states.
- A four-step posting flow that opens on the task catalog: find one of 200 reviewed tasks, answer its bounded options, set arrangement/time/place/pay, and review the composed listing.
- Role-aware Activity journeys for start PINs, completion evidence, requester confirmation, simulated payout, cancellations, no-shows, support pauses, service hours, and structured reviews.
- Protected task threads with immutable lifecycle records, local messaging, reporting, blocking, and review-only youth/guardian states.
- Adult, youth, and guardian fixtures with task-specific approval, age/consent gates, persona-isolated records, and shared safety holds where roles overlap.
- Live Supabase email authentication for regular neighbors and nonprofit representatives, protected account profiles, organization membership, verification state, password recovery, and database-derived sponsorship permissions.
- Live signed-in task publishing with owner-only private addresses, plus server-verified self-service account deletion with recent password confirmation and organization-owner safeguards.
- Responsive iPhone and Pixel 10 frames using the protected mobile runtime.

## Current redesign direction

The latest review set uses `image-3` as clean visual inspiration and `image-1` / `image-2` as repair examples only. Micro borrows the reference's visual discipline—not its commerce content or shopping behavior.

- The interface uses an airy white and cool pale-blue foundation, bold readable hierarchy, generous spacing, subtle borders, restrained depth, and semantic teal, Community Help blue, and Sponsored purple accents.
- The product remains civic neighborhood coordination: nearby tasks, human trust, clear scope, fair pay, Community Help, sponsorship, safety, consent, and lifecycle status stay more important than decorative polish.
- Natural human photography is reserved for map-marker identity. Map pins use centered circular avatars designed to remain readable at 38–52px; routine cards, headers, message rows, and trust surfaces keep the normal compact icon or initials treatment.
- Profile-photo controls preview a user-selected local image only inside the setting and use it for that persona's future map marker, with a seeded portrait or person-icon fallback. That interaction never suggests a remote account upload or permanent storage.
- The map, nearby-task surface, and five labeled tabs remain the recognizable mobile shell unless a later product decision explicitly changes them.

## Task catalog

Requesters do not write listings. `src/taskCatalog.ts` holds 200 reviewed tasks across 12 categories — yard & garden, home help, moving & hauling, cleaning, errands & pickup, pets & animals, tech help, senior support, events & setup, accessibility, school & learning, and community & mutual aid. Posting means picking an entry and answering a few bounded questions (yard size, number of boxes, stairs, distance, grade level, and so on); `composeListing()` turns that into the public title, description, inclusions, exclusions, completion check, duration, and suggested pay.

Posting opens on the catalog rather than on an abstract question: neighbors know "my leaves need raking," not "I want a Paid task." The first screen is a search box over all 200 tasks, a most-requested shortlist, and a grid of all 12 categories with counts. Drilling into a category shows its safety boundary before any task is chosen. Because the task is picked first, the arrangement step can offer only the arrangements that are honest for it — a food-pantry shift never offers Paid, and its category boundary is already on screen.

If a search finds nothing, and only then, the requester can describe the task themselves. That path types a title and a description; the category, duration, and completion check stay bounded, prohibited work is rejected outright, and the safety boundary comes from the chosen category. Such a listing carries an "awaiting review" marker wherever it appears and never counts as youth-eligible.

On the catalog path nothing is typed, so nothing unreviewed can be published. Scope, safety boundaries, youth eligibility, and pay bands are authored per entry and inherited per category, so moderation is a property of the catalog rather than a keyword filter running after the fact. The private match address is the only free-text field in the flow, and it is never shown publicly.

## Run locally

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 4174
```

Then open `http://127.0.0.1:4174/`.

### Map

The Nearby map uses the Google **Maps JavaScript API**. Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
# VITE_GOOGLE_MAPS_API_KEY=...
# VITE_GOOGLE_MAPS_MAP_ID=...
```

In Google Cloud Console: enable **Maps JavaScript API**, restrict the key to HTTP referrers plus that API, and create a **Map ID** (type JavaScript) — Advanced Markers require one. The key is bundled into the client, so those restrictions are the only thing protecting it. Without a key, or with the API disabled, the app still runs and the map area says so plainly instead of showing an empty frame.

Areas are a fixed enum — `Oakland & Alameda`, `Downtown & Lake Merritt`, `Temescal & Rockridge`, `Fruitvale & San Antonio`, `West Oakland & Jack London`, `Alameda Island`, and `Island of Montréal`. Each carries a centre, a default zoom, min/max zoom, and a pan fence, so the map cannot drift out of the chosen area. Distances are computed from the viewer's own area; there is no geocoding or autocomplete traffic.

### Supabase accounts

The app uses browser-safe Supabase configuration only:

```bash
# .env.local — never commit this file
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Apply the SQL files in `supabase/migrations/` in filename order. They create RLS-protected profiles, organizations, memberships, public-safe task listings, owner-only private addresses, and database-derived capability gates. Authenticated database access also requires the JWT's `session_id` to match a live Supabase Auth session, so revoked or deleted-account tokens fail closed before their normal JWT expiry.

Deploy `supabase/functions/delete-account/` with JWT verification enabled. The function accepts only `{"confirmation":"DELETE"}`, verifies the live Auth user, requires a password authentication from the last five minutes, and derives the deletion target from that verified user. It never accepts a user ID or password in its request body. Never put a service-role key, database password, JWT secret, or connection string in a `VITE_*` variable.

### Verify

```bash
npm run check:runtime
npx tsc --noEmit
npm run build
npm run test:sites
npm run test:runtime
```

## Prototype boundary

Supabase authentication, protected account profiles, account types, organization membership, database-derived sponsorship permissions, signed-in task listings, private task addresses, and account deletion are live when the project variables, migrations, and Edge Function are configured. Google Maps can provide the basemap when its browser key and Map ID are configured. Fixture map markers, task matching and acceptance, youth/guardian personas, identity verification, payments, push notifications, messaging, sponsorship requests, moderation, and storage remain local fixtures or deferred services. Any selected profile photo is a browser-local preview with an explicit fallback; it is not uploaded, synced, moderated, or permanently stored. The UI labels these boundaries directly.
