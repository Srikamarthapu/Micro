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

export type TaskThreadReadCursor = {
  assignmentId: string;
  readerId: string;
  lastReadAt: string;
  lastReadMessageId: string;
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

function threadReadCursorFromRow(row: Record<string, unknown>): TaskThreadReadCursor {
  return {
    assignmentId: String(row.assignment_id),
    readerId: String(row.reader_id),
    lastReadAt: String(row.last_read_at),
    lastReadMessageId: String(row.last_read_message_id),
  };
}

export type CollaborationState = {
  /** Live and settled assignments on tasks you own or accepted. */
  assignments: TaskAssignment[];
  /** Every thread you are party to, keyed by immutable assignment id. */
  messagesByAssignment: Record<string, TaskMessage[]>;
  /** The caller's authoritative server read cursor for each assignment. */
  readCursorsByAssignment: Record<string, TaskThreadReadCursor>;
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
  markThreadRead: (assignmentId: string, messageId: string) => Promise<CollaborationResult>;
  sendMessage: (assignmentId: string, body: string, clientNonce: string) => Promise<CollaborationResult>;
  refresh: () => Promise<void>;
};

export function emptyCollaboration(): CollaborationState {
  const unavailable = async () => ({ ok: false, message: "Micro is not connected to a project." });
  return {
    assignments: [],
    messagesByAssignment: {},
    readCursorsByAssignment: {},
    error: null,
    loading: false,
    acceptTask: unavailable,
    withdrawAssignment: unavailable,
    cancelAssignment: unavailable,
    requestCompletion: unavailable,
    confirmCompletion: unavailable,
    fetchCompletionCode: async () => null,
    markThreadRead: unavailable,
    sendMessage: unavailable,
    refresh: async () => {},
  };
}

export function useCollaboration(userId: string | null, accessToken: string | null): CollaborationState {
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [readCursorsByAssignment, setReadCursorsByAssignment] = useState<Record<string, TaskThreadReadCursor>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));

  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setAssignments([]);
      setMessages([]);
      setReadCursorsByAssignment({});
      setError(null);
      setLoading(false);
      return;
    }
    const [assignmentResult, messageResult, readCursorResult] = await Promise.all([
      supabase.from("task_assignment_details").select("*").order("created_at", { ascending: false }).limit(200),
      supabase
        .from("task_message_details")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(500),
      supabase
        .from("task_thread_reads")
        .select("assignment_id, reader_id, last_read_at, last_read_message_id"),
    ]);
    const failure = assignmentResult.error ?? messageResult.error ?? readCursorResult.error;
    if (failure) {
      setError(failure.message);
      setLoading(false);
      return;
    }
    const assignmentRows = (assignmentResult.data ?? []) as Array<Record<string, unknown>>;
    const messageRows = ((messageResult.data ?? []) as Array<Record<string, unknown>>).slice().reverse();
    const readCursorRows = (readCursorResult.data ?? []) as Array<Record<string, unknown>>;
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
    setMessages(messageRows.map((row) => messageFromRow(row)));
    setReadCursorsByAssignment(Object.fromEntries(readCursorRows.map((row) => {
      const cursor = threadReadCursorFromRow(row);
      return [cursor.assignmentId, cursor];
    })));
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
      .on("postgres_changes", { event: "*", schema: "public", table: "task_thread_reads" }, () => {
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
    // A thread that opens empty makes the requester wait for a stranger to
    // speak first. The helper's name and intent is the one message that is
    // always true at this moment, so the match sends it for them.
    const { data: fresh } = await supabase
      .from("task_assignment_details")
      .select("id, helper_name")
      .eq("task_id", taskId)
      .eq("helper_id", userId)
      .eq("status", "accepted")
      .maybeSingle();
    if (fresh?.id) {
      const helperName = String(fresh.helper_name ?? "").trim();
      const greeting = helperName ? `Hi, my name is ${helperName} and I'll be helping with this task.` : "Hi — I'll be helping with this task.";
      // Best effort: a greeting that fails to send must never make a
      // successful acceptance look like it failed.
      await supabase.from("task_messages").insert({ assignment_id: String(fresh.id), client_nonce: crypto.randomUUID(), body: greeting });
    }
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
    const { data, error: confirmError } = await supabase.rpc("confirm_task_completion", { p_assignment_id: assignment.id, p_code: trimmed });
    if (confirmError) return collaborationFailure(confirmError);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, message: "Micro could not verify the completion response." };
    }
    const result = data as { ok?: unknown; error_code?: unknown };
    if (result.ok !== true) {
      return collaborationFailure({ message: typeof result.error_code === "string" ? result.error_code : "completion_confirmation_failed" });
    }
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

  const markThreadRead = useCallback(async (assignmentId: string, messageId: string): Promise<CollaborationResult> => {
    if (!supabase || !userId) return { ok: false, message: "Micro is not connected to a project." };
    if (!assignments.some((candidate) => candidate.id === assignmentId)) {
      return { ok: false, message: "This protected match is no longer available." };
    }
    const { data, error: readError } = await supabase.rpc("mark_task_thread_read", {
      p_assignment_id: assignmentId,
      p_message_id: messageId,
    });
    if (readError) return collaborationFailure(readError);

    const returned = Array.isArray(data) ? data[0] : data;
    if (returned && typeof returned === "object") {
      const cursor = threadReadCursorFromRow(returned as Record<string, unknown>);
      setReadCursorsByAssignment((current) => ({ ...current, [cursor.assignmentId]: cursor }));
    } else {
      await refresh();
    }
    return { ok: true };
  }, [assignments, refresh, userId]);

  const sendMessage = useCallback(async (assignmentId: string, body: string, clientNonce: string): Promise<CollaborationResult> => {
    if (!supabase || !userId) return { ok: false, message: "Micro is not connected to a project." };
    const trimmed = body.trim();
    if (!trimmed) return { ok: false, message: "Write a message first." };
    if (trimmed.length > 2000) return { ok: false, message: "Keep messages at 2,000 characters or fewer." };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientNonce)) {
      return { ok: false, message: "This message retry token is invalid. Please try again." };
    }
    const assignment = assignments.find((candidate) => candidate.id === assignmentId && candidate.status === "accepted");
    if (!assignment) return { ok: false, message: "Messages unlock only after a protected match." };
    const { error: insertError } = await supabase
      .from("task_messages")
      .insert({ assignment_id: assignment.id, client_nonce: clientNonce, body: trimmed });
    if (insertError?.code === "23505") {
      const { data: existing, error: reconciliationError } = await supabase
        .from("task_message_details")
        .select("id, assignment_id, sender_id, client_nonce, body")
        .eq("assignment_id", assignment.id)
        .eq("sender_id", userId)
        .eq("client_nonce", clientNonce)
        .maybeSingle();
      if (reconciliationError || !existing || existing.body !== trimmed) {
        return collaborationFailure(reconciliationError ?? insertError);
      }
    } else if (insertError) {
      return collaborationFailure(insertError);
    }
    await refresh();
    return { ok: true };
  }, [assignments, refresh, userId]);

  return useMemo(
    () => ({
      assignments,
      messagesByAssignment,
      readCursorsByAssignment,
      error,
      loading,
      acceptTask,
      withdrawAssignment,
      cancelAssignment,
      requestCompletion,
      confirmCompletion,
      fetchCompletionCode,
      markThreadRead,
      sendMessage,
      refresh,
    }),
    [
      acceptTask,
      assignments,
      cancelAssignment,
      confirmCompletion,
      error,
      fetchCompletionCode,
      loading,
      markThreadRead,
      messagesByAssignment,
      readCursorsByAssignment,
      refresh,
      requestCompletion,
      sendMessage,
      withdrawAssignment,
    ],
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
  if (message.includes("assignment_cancellation_not_allowed")) return { ok: false, message: "Only the requester can cancel this active task." };
  if (message.includes("completion_request_not_allowed")) return { ok: false, message: "Only the active helper can request completion." };
  if (message.includes("completion_confirmation_not_allowed")) return { ok: false, message: "Only the requester can confirm completion." };
  if (message.includes("completion_not_requested_yet")) return { ok: false, message: "The helper has not requested completion yet." };
  if (message.includes("completion_code_incorrect")) return { ok: false, message: "That code does not match. Ask the helper to read it again." };
  if (message.includes("completion_code_locked")) return { ok: false, message: "Too many incorrect codes. Wait 15 minutes before trying again." };
  if (message.includes("live_authenticated_session_required")) return { ok: false, message: "Your session needs to be refreshed before continuing." };
  if (message.includes("message_not_allowed") || message.includes("not_a_task_participant")) return { ok: false, message: "Only the matched requester and helper can use this thread." };
  return { ok: false, message: error.message || "Micro could not complete that action." };
}
