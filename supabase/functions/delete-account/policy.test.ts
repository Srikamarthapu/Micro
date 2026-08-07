import assert from "node:assert/strict"
import test from "node:test"

import {
  hasRecentPasswordAuthentication,
  isStorageOwnershipError,
  RECENT_PASSWORD_WINDOW_MS,
} from "./policy.ts"

const nowMs = 1_800_000_000_000

test("accepts a password authentication inside the five-minute window", () => {
  assert.equal(hasRecentPasswordAuthentication({
    amr: [{ method: "password", timestamp: (nowMs - 60_000) / 1000 }],
  }, nowMs), true)
})

test("rejects a stale password authentication even when the token was refreshed", () => {
  assert.equal(hasRecentPasswordAuthentication({
    amr: [
      { method: "password", timestamp: (nowMs - RECENT_PASSWORD_WINDOW_MS - 1) / 1000 },
      { method: "token_refresh", timestamp: nowMs / 1000 },
    ],
  }, nowMs), false)
})

test("rejects non-password and missing authentication methods", () => {
  assert.equal(hasRecentPasswordAuthentication({
    amr: [{ method: "oauth", timestamp: nowMs / 1000 }],
  }, nowMs), false)
  assert.equal(hasRecentPasswordAuthentication({}, nowMs), false)
})

test("allows at most one minute of future clock skew", () => {
  assert.equal(hasRecentPasswordAuthentication({
    amr: [{ method: "password", timestamp: (nowMs + 59_000) / 1000 }],
  }, nowMs), true)
  assert.equal(hasRecentPasswordAuthentication({
    amr: [{ method: "password", timestamp: (nowMs + 61_000) / 1000 }],
  }, nowMs), false)
})

test("classifies only storage ownership deletion errors", () => {
  assert.equal(isStorageOwnershipError({ message: "User owns Storage objects" }), true)
  assert.equal(isStorageOwnershipError({ code: "storage_owner_conflict" }), true)
  assert.equal(isStorageOwnershipError({ message: "Database error deleting user" }), false)
})
