import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

import {
  hasRecentPasswordAuthentication,
  isStorageOwnershipError,
} from "./policy.ts"

type OrganizationSummary = {
  id: string
  name: string
}

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {},
) => Response.json(body, {
  status,
  headers: {
    "Cache-Control": "no-store",
    ...headers,
  },
})

const jsonError = (
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
) => jsonResponse({ code, message, ...details }, status)

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonResponse(
        {
          code: "method_not_allowed",
          message: "Account deletion only accepts POST requests.",
        },
        405,
        { Allow: "POST" },
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return jsonError(400, "confirmation_required", "Type DELETE to confirm account deletion.")
    }

    if (
      !body
      || typeof body !== "object"
      || Array.isArray(body)
      || Object.keys(body).some((key) => key !== "confirmation")
      || (body as { confirmation?: unknown }).confirmation !== "DELETE"
    ) {
      return jsonError(400, "confirmation_required", "Type DELETE to confirm account deletion.")
    }

    const authorization = req.headers.get("Authorization")
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!accessToken || !ctx.userClaims?.id) {
      return jsonError(401, "authentication_required", "Sign in again before deleting your account.")
    }

    const {
      data: { user: verifiedUser },
      error: verificationError,
    } = await ctx.supabase.auth.getUser(accessToken)

    if (verificationError || !verifiedUser || verifiedUser.id !== ctx.userClaims.id) {
      return jsonError(401, "invalid_session", "Your session could not be verified. Sign in again.")
    }

    if (verifiedUser.is_anonymous || ctx.jwtClaims?.is_anonymous === true) {
      return jsonError(
        403,
        "anonymous_account_not_supported",
        "Anonymous sessions cannot use account deletion.",
      )
    }

    if (!hasRecentPasswordAuthentication(ctx.jwtClaims, Date.now())) {
      return jsonError(
        403,
        "reauthentication_required",
        "Enter your current password again before deleting your account.",
      )
    }

    const findOwnershipBlockers = async (): Promise<OrganizationSummary[]> => {
      const [createdResult, ownerMembershipResult] = await Promise.all([
        ctx.supabaseAdmin
          .from("organizations")
          .select("id")
          .eq("created_by", verifiedUser.id),
        ctx.supabaseAdmin
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", verifiedUser.id)
          .eq("member_role", "owner")
          .eq("membership_status", "active"),
      ])

      if (createdResult.error || ownerMembershipResult.error) {
        throw new Error("ownership_check_failed")
      }

      const createdOrganizations = (createdResult.data ?? []) as Array<{ id: string }>
      const ownerMemberships = (ownerMembershipResult.data ?? []) as Array<{
        organization_id: string
      }>
      const organizationIds = Array.from(new Set([
        ...createdOrganizations.map((row) => row.id),
        ...ownerMemberships.map((row) => row.organization_id),
      ]))

      if (!organizationIds.length) return []

      const [organizationsResult, linkedMembershipsResult] = await Promise.all([
        ctx.supabaseAdmin
          .from("organizations")
          .select("id, name")
          .in("id", organizationIds),
        ctx.supabaseAdmin
          .from("organization_members")
          .select("organization_id, member_role, membership_status")
          .in("organization_id", organizationIds)
          .neq("user_id", verifiedUser.id)
          .neq("membership_status", "removed"),
      ])

      if (organizationsResult.error || linkedMembershipsResult.error) {
        throw new Error("ownership_check_failed")
      }

      const organizations = (organizationsResult.data ?? []) as OrganizationSummary[]
      const linkedMemberships = (linkedMembershipsResult.data ?? []) as Array<{
        organization_id: string
        member_role: string
        membership_status: string
      }>
      return organizations
        .filter((organization) => {
          const linkedPeople = linkedMemberships.filter(
            (membership) => membership.organization_id === organization.id,
          )
          const hasSuccessorOwner = linkedPeople.some(
            (membership) => membership.member_role === "owner"
              && membership.membership_status === "active",
          )
          return linkedPeople.length > 0 && !hasSuccessorOwner
        })
        .sort((left, right) => left.name.localeCompare(right.name))
    }

    const hasActiveTaskCommitment = async (): Promise<boolean> => {
      const [helperResult, ownedTasksResult] = await Promise.all([
        ctx.supabaseAdmin
          .from("task_assignments")
          .select("task_id")
          .eq("helper_id", verifiedUser.id)
          .eq("status", "accepted")
          .limit(1),
        ctx.supabaseAdmin
          .from("tasks")
          .select("id")
          .eq("owner_id", verifiedUser.id),
      ])

      if (helperResult.error || ownedTasksResult.error) {
        throw new Error("task_commitment_check_failed")
      }
      if ((helperResult.data ?? []).length > 0) return true

      const ownedTaskIds = ((ownedTasksResult.data ?? []) as Array<{ id: string }>)
        .map((row) => row.id)
      if (!ownedTaskIds.length) return false

      const assignmentResult = await ctx.supabaseAdmin
        .from("task_assignments")
        .select("task_id")
        .in("task_id", ownedTaskIds)
        .eq("status", "accepted")
        .limit(1)
      if (assignmentResult.error) throw new Error("task_commitment_check_failed")
      return (assignmentResult.data ?? []).length > 0
    }

    let ownershipBlockers: OrganizationSummary[]
    let activeTaskCommitment: boolean
    try {
      ;[ownershipBlockers, activeTaskCommitment] = await Promise.all([
        findOwnershipBlockers(),
        hasActiveTaskCommitment(),
      ])
    } catch {
      return jsonError(
        503,
        "deletion_safety_check_failed",
        "Micro could not safely verify account obligations. Nothing was deleted.",
      )
    }

    if (activeTaskCommitment) {
      return jsonError(
        409,
        "active_task_commitment_requires_settlement",
        "Close or settle the active matched task before deleting this account.",
      )
    }

    if (ownershipBlockers.length) {
      return jsonError(
        409,
        "organization_owner_transfer_required",
        "Assign another active owner before deleting this account.",
        { organizations: ownershipBlockers },
      )
    }

    const { error: deletionError } = await ctx.supabaseAdmin.auth.admin.deleteUser(
      verifiedUser.id,
      false,
    )

    if (!deletionError) {
      return jsonResponse({ deleted: true })
    }

    // The database trigger is the race-safe authority. GoTrue may reduce a
    // trigger exception to a generic deletion error, so re-check after failure
    // to recover the stable ownership response for the client.
    try {
      ;[ownershipBlockers, activeTaskCommitment] = await Promise.all([
        findOwnershipBlockers(),
        hasActiveTaskCommitment(),
      ])
    } catch {
      ownershipBlockers = []
      activeTaskCommitment = false
    }

    if (activeTaskCommitment) {
      return jsonError(
        409,
        "active_task_commitment_requires_settlement",
        "Close or settle the active matched task before deleting this account.",
      )
    }

    if (ownershipBlockers.length) {
      return jsonError(
        409,
        "organization_owner_transfer_required",
        "Assign another active owner before deleting this account.",
        { organizations: ownershipBlockers },
      )
    }

    if (isStorageOwnershipError(deletionError)) {
      return jsonError(
        409,
        "storage_cleanup_required",
        "Remove or transfer files owned by this account before deleting it.",
      )
    }

    console.error("Account deletion failed", {
      code: deletionError.code,
      status: deletionError.status,
    })
    return jsonError(
      500,
      "account_deletion_failed",
      "Micro could not delete the account. The account and its data remain intact.",
    )
  }),
}
