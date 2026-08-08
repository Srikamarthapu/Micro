import type { Dispatch, SetStateAction } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Icon } from "@phosphor-icons/react";
import type { AreaId, LatLng } from "./geo";

/**
 * The shapes the whole app agrees on. Kept free of components and fixtures so
 * any module can import a type without dragging rendering code along with it.
 */

export type AccountType = "regular" | "nonprofit";
export type OrganizationVerificationStatus = "pending" | "verified" | "rejected" | "suspended";

export type AuthProfile = {
  id: string;
  display_name: string;
  service_area: string | null;
  account_type: AccountType;
};

export type AuthOrganization = {
  id: string;
  name: string;
  verification_status: OrganizationVerificationStatus;
  sponsorship_enabled: boolean;
  role: "owner" | "admin" | "member";
};

export type AuthCapabilities = {
  can_post_tasks: boolean;
  can_accept_tasks: boolean;
  can_receive_sponsorship_requests: boolean;
  can_sponsor_tasks: boolean;
};

export type SignUpInput = {
  accountType: AccountType;
  fullName: string;
  email: string;
  password: string;
  approximateArea: AreaId;
  standardsAccepted: boolean;
  organizationName?: string;
  organizationWebsite?: string;
};

export type AuthActionResult = {
  ok: boolean;
  message?: string;
  confirmationRequired?: boolean;
  code?: string;
};

export type DeleteAccountInput = {
  password?: string;
  confirmation: "DELETE";
};

export const emptyCapabilities = (): AuthCapabilities => ({
  can_post_tasks: false,
  can_accept_tasks: false,
  can_receive_sponsorship_requests: false,
  can_sponsor_tasks: false,
});
export type TabId = "nearby" | "post" | "activity" | "messages" | "profile";
export type TaskMode = "paid" | "community" | "sponsored";
export type PaidStage =
  | "Payment secured"
  | "In progress"
  | "Completion pending"
  | "Payout released"
  | "Completed"
  | "Reopened";
export type CommunityStage = "Committed" | "Checked in" | "Completion pending" | "Completed" | "Canceled";
export type MessageItem = { id: number; mine: boolean; text: string };
export type TaskEvent = { id: number; text: string };

export function appendTaskEvent(
  setter: Dispatch<SetStateAction<Record<string, TaskEvent[]>>>,
  taskId: string,
  text: string,
) {
  setter((current) => {
    const previous = current[taskId] ?? [];
    return {
      ...current,
      [taskId]: [...previous, { id: Date.now() + previous.length, text }],
    };
  });
}


export type Task = {
  id: string;
  title: string;
  description: string;
  mode: TaskMode;
  earning?: number;
  coords: LatLng;
  areaId: AreaId;
  area: string;
  time: string;
  /**
   * The moment `time` names, so a listing can drop out of Nearby once its start
   * has passed. Absent when the start is Flexible or came from a remote row
   * that only carries a label.
   */
  startsAt?: Date;
  duration: string;
  icon: Icon;
  youthEligible?: boolean;
  category?: string;
  included?: string;
  excluded?: string;
  completion?: string;
  privateAddress?: string;
  photo?: string;
  requesterName?: string;
  requesterInitials?: string;
  requesterAvatar?: string;
  ownerPersona?: Persona;
  listingPaused?: boolean;
  /** Requester-described rather than chosen from the reviewed catalog. */
  customPending?: boolean;
  /** Set when the listing came from Supabase rather than local fixtures. */
  ownerId?: string;
};

export type PostDraft = {
  mode: TaskMode;
  /** Catalog entry the listing is built from. Listings exist only for catalog tasks. */
  templateId: string;
  /** Answers to that entry's bounded options, keyed by option id. */
  selections: Record<string, string>;
  /** Set only when the requester described a task the catalog does not carry. */
  customTitle: string;
  customDetails: string;
  customCategoryId: string;
  customMinutes: number;
  customCompletionId: string;
  /** One of `dateChoicesFor(now)` — derived from the date, not a fixed enum. */
  dateChoice: string;
  startTime: string;
  privateAddress: string;
  /**
   * Where the device says the task is. Optional: a listing can still be posted
   * from the profile's approximate area, which is what happens when location is
   * declined or unavailable.
   */
  coords?: LatLng;
  amount: string;
  photoAcknowledged: boolean;
  photoPreview: string;
  riskConfirmed: boolean;
  safetyConfirmed: boolean;
};

export type Persona = "adult" | "youth" | "guardian";

export type CompletionSubmission = {
  note: string;
  evidencePreview: string;
};

export type RoleReview = {
  rating: number;
  tags: string[];
  saved: boolean;
};

export type TaskReviewState = {
  helper: RoleReview;
  requester: RoleReview;
};

export function emptyTaskReview(): TaskReviewState {
  return {
    helper: { rating: 0, tags: [], saved: false },
    requester: { rating: 0, tags: [], saved: false },
  };
}

export type PersonaSessionState = {
  selectedTaskId: string;
  paidStage: PaidStage;
  activeTask: Task;
  communityTask: Task | null;
  communityStage: CommunityStage;
  communityChecks: boolean[];
  postedTask: Task | null;
  postDraft: PostDraft;
  acceptedTaskIds: string[];
  closedTaskIds: string[];
  acceptedTaskActors: Record<string, "adult" | "youth">;
  taskEvents: Record<string, TaskEvent[]>;
  activityPerspective: "helper" | "requester";
  savedTaskIds: string[];
  sponsorFunded: boolean;
  sponsorSeeking: boolean;
  threadMessages: Record<string, MessageItem[]>;
  blockedThreadIds: string[];
  blockedRequesterNames: string[];
  reportedTaskIds: string[];
  reportReasons: Record<string, string>;
  completionSubmissions: Record<string, CompletionSubmission>;
  taskReviews: Record<string, TaskReviewState>;
  notificationsEnabled: boolean;
  profileAreaId: AreaId;
};
