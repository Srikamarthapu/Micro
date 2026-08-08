import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { taskFromRow } from "./taskRows";
import type { Task } from "./types";

/**
 * The two-sided half of a task: who accepted it and what the two of them said
 * afterwards. Everything here is server state, so both devices see the same
 * thing; the rest of the prototype's lifecycle remains local fixtures.
 *
 * Reads go through the `*_details` views, whose RLS already narrows them to
 * rows the signed-in neighbor is party to — there is no client-side filter to
 * forget, and no query that could widen by accident.
 */

export type AssignmentStatus = "accepted" | "withdrawn" | "completed" | "canceled";

export type TaskAssignment = {
  id: string;
  taskId: string | null;
  helperId: string | null;
  helperName: string;
  requesterId: string | null;
  requesterName: string;
  taskTitle: string;
  status: AssignmentStatus;
  createdAt: string;
  settledAt?: string;
  /** Set once the helper reported the work done and a code was issued. */
  completionRequestedAt?: string;
  task?: Task;
};

export type TaskMessage = {
  id: string;
  assignmentId: string;
  taskId: string | null;
  senderId: string | null;
  senderName: string;
  body: string;
  kind: "human" | "system";
  createdAt: string;
};

export type CollaborationResult = { ok: boolean; message?: string };
/** A completion request also hands back the code the helper reads out. */
export type CompletionCodeResult = CollaborationResult & { code?: string };

function assignmentFromRow(row: Record<string, unknown>, task?: Task): TaskAssignment {
  return {
    id: String(row.id),
    taskId: row.task_id ? String(row.task_id) : null,
    helperId: row.helper_id ? String(row.helper_id) : null,
    helperName: (row.helper_name as string) || "A neighbor",
    requesterId: row.requester_id ? String(row.requester_id) : null,
    requesterName: (row.requester_name as string) || task?.requesterName || "A neighbor",
    taskTitle: (row.task_title as string) || "this task",
    status: String(row.status) as AssignmentStatus,
    createdAt: String(row.created_at),
    settledAt: row.settled_at ? String(row.settled_at) : undefined,
    completionRequestedAt: row.completion_requested_at ? String(row.completion_requested_at) : undefined,
    task,
  };
}

function messageFromRow(row: Record<string, unknown>): TaskMessage {
  return {
    id: String(row.id),
    assignmentId: String(row.assignment_id),
    taskId: row.task_id ? String(row.task_id) : null,
    senderId: row.sender_id ? String(row.sender_id) : null,
    senderName: (row.sender_name as string) || "A neighbor",
    body: String(row.body),
    kind: String(row.kind) === "system" ? "system" : "human",
    createdAt: String(row.created_at),
  };
}

export type CollaborationState = {
  /** Live and settled assignments on tasks you own or accepted. */
  assignments: TaskAssignment[];
  /** Every thread you are party to, keyed by immutable assignment id. */
  messagesByAssignment: Record<string, TaskMessage[]>;
  error: string | null;
  /** True until the first load settles, so the UI can avoid a false "no threads". */
  loading: boolean;
  acceptTask: (taskId: string) => Promise<CollaborationResult>;
  withdrawAssignment: (assignmentId: string) => Promise<CollaborationResult>;
  cancelAssignment: (assignmentId: string) => Promise<CollaborationResult>;
  requestCompletion: (assignmentId: string) => Promise<CompletionCodeResult>;
  confirmCompletion: (assignmentId: string, code: string) => Promise<CollaborationResult>;
  /** The helper's own issued code, or null for anyone else. */
  fetchCompletionCode: (assignmentId: string) => Promise<string | null>;
  completeAssignment: (assignmentId: string) => Promise<CollaborationResult>;
  sendMessage: (assignmentId: string, body: string) => Promise<CollaborationResult>;
  refresh: () => Promise<void>;
};

export function emptyCollaboration(): CollaborationState {
  const unavailable = async () => ({ ok: false, message: "Micro is not connected to a project." });
  return {
    assignments: [],
    messagesByAssignment: {},
    error: null,
    loading: false,
    acceptTask: unavailable,
    withdrawAssignment: unavailable,
    cancelAssignment: unavailable,
    requestCompletion: unavailable,
    confirmCompletion: unavailable,
    fetchCompletionCode: async () => null,
    completeAssignment: unavailable,
    sendMessage: unavailable,
    refresh: async () => {},
  };
}

export function useCollaboration(userId: string | null, accessToken: string | null): CollaborationState {
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));

  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setAssignments([]);
      setMessages([]);
      setError(null);
      setLoading(false);
      return;
    }
    const [assignmentResult, messageResult] = await Promise.all([
      supabase.from("task_assignment_details").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("task_message_details").select("*").order("created_at", { ascending: true }).limit(500),
    ]);
    const failure = assignmentResult.error ?? messageResult.error;
    if (failure) {
      setError(failure.message);
      setLoading(false);
      return;
    }
    const assignmentRows = (assignmentResult.data ?? []) as Array<Record<string, unknown>>;
    const taskIds = [...new Set(assignmentRows.flatMap((row) => row.task_id ? [String(row.task_id)] : []))];
    const tasksById = new Map<string, Task>();
    let enrichmentError: string | null = null;
    if (taskIds.length) {
      const [taskResult, addressResult] = await Promise.all([
        supabase.from("tasks").select("*").in("id", taskIds),
        supabase.from("task_private_details").select("task_id, private_address").in("task_id", taskIds),
      ]);
      enrichmentError = taskResult.error?.message ?? addressResult.error?.message ?? null;
      const addresses = new Map(((addressResult.data ?? []) as Array<{ task_id: string; private_address: string }>).map((row) => [row.task_id, row.private_address]));
      for (const row of (taskResult.data ?? []) as Array<Record<string, unknown>>) {
        const assignment = assignmentRows.find((candidate) => String(candidate.task_id) === String(row.id));
        const task = taskFromRow({ ...row, requester_name: assignment?.requester_name });
        task.privateAddress = addresses.get(task.id);
        tasksById.set(task.id, task);
      }
    }
    setError(enrichmentError);
    setAssignments(assignmentRows.map((row) => assignmentFromRow(row, tasksById.get(String(row.task_id)))));
    setMessages((messageResult.data ?? []).map((row) => messageFromRow(row as Record<string, unknown>)));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Refetching on every event rather than merging the payload keeps RLS the
  // only thing deciding what this device may hold: a row arrives, and the
  // reload re-asks the server what the whole picture looks like.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const client = supabase;
    if (!client || !userId || !accessToken) return;
    // Realtime runs its own connection, which needs the session before it can
    // apply the select policies that scope these tables per subscriber.
    client.realtime.setAuth(accessToken);
    const channel = client
      .channel(`micro-collaboration-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        void refreshRef.current();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignments" }, () => {
        void refreshRef.current();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_messages" }, () => {
        void refreshRef.current();
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [userId, accessToken]);

  const messagesByAssignment = useMemo(() => {
    const grouped: Record<string, TaskMessage[]> = {};
    for (const message of messages) {
      (grouped[message.assignmentId] ??= []).push(message);
    }
    return grouped;
  }, [messages]);

  const acceptTask = useCallback(async (taskId: string): Promise<CollaborationResult> => {
    if (!supabase || !userId) return { ok: false, message: "Micro is not connected to a project." };
    const { error: acceptError } = await supabase.rpc("accept_task", { p_task_id: taskId });
    if (acceptError) return collaborationFailure(acceptError);
    await refresh();
    return { ok: true };
  }, [refresh, userId]);

  const withdrawAssignment = useCallback(async (assignmentId: string): Promise<CollaborationResult> => {
    if (!supabase || !userId) return { ok: false, message: "Micro is not connected to a project." };
    const assignment = assignments.find((candidate) => candidate.id === assignmentId && candidate.helperId === userId && candidate.status === "accepted");
    if (!assignment) return { ok: false, message: "This task no longer has an active commitment to withdraw." };
    const { error: withdrawError } = await supabase.rpc("withdraw_task_assignment", { p_assignment_id: assignment.id });
    if (withdrawError) return collaborationFailure(withdrawError);
    await refresh();
    return { ok: true };
  }, [assignments, refresh, userId]);

  const completeAssignment = useCallback(async (assignmentId: string): Promise<CollaborationResult> => {
    if (!supabase || !userId) return { ok: false, message: "Micro is not connected to a project." };
    const assignment = assignments.find((candidate) => candidate.id === assignmentId && candidate.requesterId === userId && candidate.status === "accepted");
    if (!assignment) return { ok: false, message: "This task no longer has an active match to complete." };
    const { error: completeError } = await supabase.rpc("complete_task_assignment", { p_assignment_id: assignment.id });
    if (completeError) return collaborationFailure(completeError);
    await refresh();
    return { ok: true };
  }, [assignments, refresh, userId]);

  const requestCompletion = useCallback(async (assignmentId: string): Promise<CompletionCodeResult> => {
    if (!supabase || !userId) return { ok: false, message: "Micro is not connected to a project." };
    const assignment = assignments.find((candidate) => candidate.id === assignmentId && candidate.helperId === userId && candidate.status === "accepted");
    if (!assignment) return { ok: false, message: "This job no longer has an active commitment to finish." };
    const { data, error: requestError } = await supabase.rpc("request_task_completion", { p_assignment_id: assignment.id });
    if (requestError) return collaborationFailure(requestError);
    await refresh();
    return { ok: true, code: data ? String(data) : undefined };
  }, [assignments, refresh, userId]);

  const confirmCompletion = useCallback(async (assignmentId: string, code: string): Promise<CollaborationResult> => {
    if (!supabase || !userId) return { ok: false, message: "Micro is not connected to a project." };
    const assignment = assignments.find((candidate) => candidate.id === assignmentId && candidate.requesterId === userId && candidate.status === "accepted");
    if (!assignment) return { ok: false, message: "This task no longer has an active match to complete." };
    const trimmed = code.trim();
    if (!/^\d{4}$/.test(trimmed)) return { ok: false, message: "Enter the four digits the helper read out." };
    const { error: confirmError } = await supabase.rpc("confirm_task_completion", { p_assignment_id: assignment.id, p_code: trimmed });
    if (confirmError) return collaborationFailure(confirmError);
    await refresh();
    return { ok: true };
  }, [assignments, refresh, userId]);

  // Re-reading the issued code rather than remembering it in component state,
  // so closing the job screen or reloading never strands a helper who has
  // already told the requester one is waiting. RLS answers this for the helper
  // and returns nothing to anyone else, including the requester.
  const fetchCompletionCode = useCallback(async (assignmentId: string): Promise<string | null> => {
    if (!supabase || !userId) return null;
    const { data, error: codeError } = await supabase
      .from("task_completion_codes")
      .select("code")
      .eq("assignment_id", assignmentId)
      .maybeSingle();
    if (codeError || !data) return null;
    return String((data as { code: unknown }).code);
  }, [userId]);

  const cancelAssignment = useCallback(async (assignmentId: string): Promise<CollaborationResult> => {
    if (!supabase || !userId) return { ok: false, message: "Micro is not connected to a project." };
    const assignment = assignments.find((candidate) => candidate.id === assignmentId && candidate.requesterId === userId && candidate.status === "accepted");
    if (!assignment) return { ok: false, message: "This task no longer has an active match to cancel." };
    const { error: cancelError } = await supabase.rpc("cancel_task_assignment", { p_assignment_id: assignment.id });
    if (cancelError) return collaborationFailure(cancelError);
    await refresh();
    return { ok: true };
  }, [assignments, refresh, userId]);

  const sendMessage = useCallback(async (assignmentId: string, body: string): Promise<CollaborationResult> => {
    if (!supabase || !userId) return { ok: false, message: "Micro is not connected to a project." };
    const trimmed = body.trim();
    if (!trimmed) return { ok: false, message: "Write a message first." };
    if (trimmed.length > 2000) return { ok: false, message: "Keep messages at 2,000 characters or fewer." };
    const assignment = assignments.find((candidate) => candidate.id === assignmentId && candidate.status === "accepted");
    if (!assignment) return { ok: false, message: "Messages unlock only after a protected match." };
    const { error: insertError } = await supabase
      .from("task_messages")
      .insert({ assignment_id: assignment.id, client_nonce: crypto.randomUUID(), body: trimmed });
    if (insertError) return collaborationFailure(insertError);
    await refresh();
    return { ok: true };
  }, [assignments, refresh, userId]);

  return useMemo(
    () => ({ assignments, messagesByAssignment, error, loading, acceptTask, withdrawAssignment, cancelAssignment, requestCompletion, confirmCompletion, fetchCompletionCode, completeAssignment, sendMessage, refresh }),
    [acceptTask, assignments, cancelAssignment, completeAssignment, confirmCompletion, error, fetchCompletionCode, loading, messagesByAssignment, refresh, requestCompletion, sendMessage, withdrawAssignment],
  );
}

/** The live assignment on a task, if one exists. */
export function liveAssignmentFor(assignments: TaskAssignment[], taskId: string): TaskAssignment | null {
  return assignments.find((assignment) => assignment.taskId === taskId && assignment.status === "accepted") ?? null;
}

function collaborationFailure(error: { code?: string; message?: string }): CollaborationResult {
  const message = String(error.message ?? "").toLowerCase();
  if (message.includes("task_already_accepted")) return { ok: false, message: "Another neighbor accepted this job first." };
  if (message.includes("helper_already_has_active_task")) return { ok: false, message: "Finish or withdraw from your current commitment before accepting another task." };
  if (message.includes("task_owner_cannot_accept")) return { ok: false, message: "You cannot accept a task you posted." };
  if (message.includes("custom_task_awaiting_review")) return { ok: false, message: "This custom task is still awaiting review." };
  if (message.includes("task_start_has_passed") || message.includes("task_is_paused") || message.includes("task_not_found")) return { ok: false, message: "This task is no longer available." };
  if (message.includes("task_private_address_required")) return { ok: false, message: "The requester must add a protected task address before matching." };
  if (message.includes("assignment_not_found")) return { ok: false, message: "This protected match no longer exists." };
  if (message.includes("assignment_withdrawal_not_allowed")) return { ok: false, message: "Only the active helper can withdraw from this task." };
  if (message.includes("assignment_completion_not_allowed")) return { ok: false, message: "Only the requester can mark this matched task complete." };
  if (message.includes("assignment_cancellation_not_allowed")) return { ok: false, message: "Only the requester can cancel this matched task." };
  // The wrong-code and lockout cases are the ones a real pair will actually
  // hit, standing next to each other, so they say what to do next.
  if (message.includes("completion_code_incorrect")) return { ok: false, message: "That code does not match. Ask the helper to read it out again." };
  if (message.includes("completion_code_locked")) return { ok: false, message: "Too many wrong codes. Try again in 15 minutes." };
  if (message.includes("completion_not_requested_yet")) return { ok: false, message: "The helper has not marked this job finished yet." };
  if (message.includes("completion_request_not_allowed")) return { ok: false, message: "Only the matched helper can mark this job finished." };
  if (message.includes("completion_confirmation_not_allowed")) return { ok: false, message: "Only the requester can enter the completion code." };
  if (message.includes("live_authenticated_session_required")) return { ok: false, message: "Your session needs to be refreshed before continuing." };
  if (message.includes("message_not_allowed") || message.includes("not_a_task_participant")) return { ok: false, message: "Only the matched requester and helper can use this thread." };
  return { ok: false, message: error.message || "Micro could not complete that action." };
}
