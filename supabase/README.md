# Micro Supabase backend

## Account deletion trust model

`delete-account` accepts only an authenticated `POST` with the exact body
`{"confirmation":"DELETE"}`. It never accepts a user ID or password. The
function verifies the signed user JWT, calls Auth to confirm that the user still
exists, requires a password AMR event from the last five minutes, and derives
the deletion target only from that verified identity.

The function uses the server-only admin client injected by Supabase. Its secret
key must never be placed in a `VITE_*` variable, browser bundle, request body,
or repository file. Dependencies are pinned in the function-local `deno.json`,
and JWT verification remains enabled in `config.toml`.

Organization handling is atomic in the database:

- if the deleting user is `organizations.created_by`, another active owner
  becomes the account of record; deleting a non-creator owner never overwrites
  the original creator;
- an empty organization owned only by the deleting user is deleted;
- an organization with linked people but no successor owner blocks deletion
  with `organization_owner_transfer_required`.

The trigger locks each affected organization and all of its existing membership
rows in stable order, preventing concurrent owner deletions or backend role
changes from racing into an ownerless state. Future membership mutation paths
must take the organization lock before membership-row locks in the same order.
Storage-owned objects also block Auth deletion and surface as
`storage_cleanup_required`.

Hard deletion atomically cascades the user's Auth refresh sessions, so a
separate pre-deletion sign-out is intentionally avoided: it could sign the user
out everywhere and then leave the account intact if deletion were blocked.
Supabase access JWTs remain cryptographically valid until they expire. A
dedicated fixed-search-path helper therefore binds `auth.uid()` and the JWT
`session_id` to the same live `auth.sessions` row and an extant profile.
Restrictive RLS policies apply that check to every authenticated profile,
organization, membership, task, and private-address read or write, while the
capability RPC uses the same check directly. Future live tables must add the
same restrictive session gate; short JWT expiry remains defense in depth.

## Live task interaction contract

`accept_task(p_task_id)` is the only authenticated assignment write path. It
requires a live non-anonymous session and task-accept capability, locks the
requester and helper identities plus the listing and private-address row, and
creates one `task_assignments` row. That assignment ID is the private thread
ID; there is no client-created conversation row. Partial unique indexes allow
only one accepted helper per task and one accepted task per helper while still
retaining withdrawn and completed history. Own, paused, past, custom-pending,
addressless, or already accepted tasks are rejected with stable error
messages. A retry by the winning helper returns the original assignment.

Accepted listings leave `task_listings`; review-pending listings are visible
there only to their requester. Only the requester and assigned helper can fetch
an assignment, its participant-name row, or its transcript. The exact match
address extends to the helper only while that assignment is accepted.
Messages are append-only and writable only while the assignment is accepted.
Authenticated clients insert only `(assignment_id, client_nonce, body)`—the
database supplies `sender_id = auth.uid()` and `kind = 'human'`. Column grants
prevent sender or system-message spoofing before RLS is evaluated, and the
per-sender nonce makes a network retry idempotent. Both new exposed tables
carry the same restrictive live-session policy as the rest of Micro.

The trusted state transitions are:

- `withdraw_task_assignment(p_assignment_id)`, helper-only;
- `complete_task_assignment(p_assignment_id)`, requester-only, which also
  pauses the source listing.

Both transitions append-close but retain the thread. Settled account deletion
anonymizes requester, helper, and sender foreign keys and preserves the task
title snapshot and transcript. Active assignments instead block participant or
task deletion with `active_task_commitment_requires_settlement`.

Client reads use `task_assignment_details` and `task_message_details`. Routes,
message grouping, sends, and subscriptions must key a thread by
`assignment_id`, not `task_id`, because one task may have more than one
historical assignment after withdrawal. The client must tolerate nullable
`task_id`, `requester_id`, `helper_id`, and `sender_id` on retained history.

Acceptance is coordination only: it does not claim that payment is secured.
Authenticated browser grants permit only pausing an unmatched task; title,
scope, schedule, review provenance, and private address are not directly
mutable. Browser task inserts cannot set review or paused state and therefore
fail closed as review-pending until the trusted catalog publisher replaces that
interim path. Postgres Changes publishes tasks, assignments, and messages for
prototype responsiveness; RLS remains the authorization boundary, and clients
should refetch on reconnect or focus.

## Local verification

With the local Supabase stack running:

```sh
supabase db reset
supabase functions serve delete-account
```

Run the transaction-only ownership regression harness against the local
database:

```sh
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/tests/account_deletion_ownership.sql

psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/tests/live_auth_session_rls.sql

psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/tests/task_interactions_rls.sql

psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/tests/trusted_catalog_task_publishing.sql
```

The pure policy checks run without a Supabase stack:

```sh
node --experimental-strip-types --test \
  supabase/functions/delete-account/policy.test.ts
```
