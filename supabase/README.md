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
```

The pure policy checks run without a Supabase stack:

```sh
node --experimental-strip-types --test \
  supabase/functions/delete-account/policy.test.ts
```
