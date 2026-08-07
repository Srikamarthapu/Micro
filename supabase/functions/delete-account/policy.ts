export const RECENT_PASSWORD_WINDOW_MS = 5 * 60 * 1000
const CLOCK_SKEW_MS = 60 * 1000

type AuthenticationMethod = {
  method?: unknown
  timestamp?: unknown
}

export function hasRecentPasswordAuthentication(
  claims: Record<string, unknown> | null,
  nowMs: number,
) {
  const methods = claims?.amr
  if (!Array.isArray(methods)) return false

  return methods.some((candidate: AuthenticationMethod) => {
    if (candidate?.method !== "password" || typeof candidate.timestamp !== "number") {
      return false
    }

    const authenticationTimeMs = candidate.timestamp * 1000
    const ageMs = nowMs - authenticationTimeMs
    return ageMs >= -CLOCK_SKEW_MS && ageMs <= RECENT_PASSWORD_WINDOW_MS
  })
}

export function isStorageOwnershipError(error: unknown) {
  if (!error || typeof error !== "object") return false

  const candidate = error as { message?: unknown; code?: unknown }
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : ""
  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : ""

  return (
    (message.includes("storage") && message.includes("owner"))
    || message.includes("owns storage objects")
    || code.includes("storage")
  )
}
