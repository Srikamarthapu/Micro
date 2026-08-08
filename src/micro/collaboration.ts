import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";

/**
 * The two-sided half of a task: who accepted it and what the two of them said
 * afterwards. Everything here is server state, so both devices see the same
 * thing; the rest of the prototype's lifecycle remains local fixtures.
 *
 * Reads go through the `*_details` views, whose RLS already narrows them to
 * rows the signed-in neighbor is party to — there is no client-side filter to
 * forget, and no query that could widen by accident.
 */

export type AssignmentStatus = "accepted" | "withdrawn" | "completed";

export type TaskAssignment = {
  id: string;
  taskId: string;
  helperId: string;
  helperName: string;
  requesterId: string;
  taskTitle: string;
  status: AssignmentStatus;
  createdAt: string;
};

export type TaskMessage = {
  id: string;
  taskId: string;
  senderId: string;
  senderName: string;
  body: string;
  kind: "human" | "system";
  createdAt: string;
};

export type CollaborationResult = { ok: boolean; message?: string };

function assignmentFromRow(row: Record<string, unknown>): TaskAssignment {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    helperId: String(row.helper_id),
    helperName: (row.helper_name as string) || "A neighbor",
    requesterId: String(row.requester_id),
    taskTitle: (row.task_title as string) || "this task",
    status: String(row.status) as AssignmentStatus,
    createdAt: String(row.created_at),
  };
}

function messageFromRow(row: Record<string, unknown>): TaskMessage {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    senderId: String(row.sender_id),
    senderName: (row.sender_name as string) || "A neighbor",
    body: String(row.body),
    kind: String(row.kind) === "system" ? "system" : "human",
    createdAt: String(row.created_at),
  };
}

export type CollaborationState = {
  /** Live and settled assignments on tasks you own or accepted. */
  assignments: TaskAssignment[];
  /** Every thread you are party to, keyed by task id, oldest message first. */
  messagesByTask: Record<string, TaskMessage[]>;
  error: string | null;
  /** True until the first load settles, so the UI can avoid a false "no threads". */
  loading: boolean;
  acceptTask: (taskId: string) => Promise<CollaborationResult>;
  withdrawFromTask: (taskId: string) => Promise<CollaborationResult>;
  sendMessage: (taskId: string, body: string) => Promise<CollaborationResult>;
  refresh: () => Promise<void>;
};

export function emptyCollaboration(): CollaborationState {
  const unavailable = async () => ({ ok: false, message: "Micro is not connected to a project." });
  return {
    assignments: [],
    messagesByTask: {},
    error: null,
    loading: false,
    acceptTask: unavailable,
    withdrawFromTask: unavailable,
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
    setError(null);
    setAssignments((assignmentResult.data ?? []).map((row) => assignmentFromRow(row as Record<string, unknown>)));
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

  const messagesByTask = useMemo(() => {
    const grouped: Record<string, TaskMessage[]> = {};
    for (const message of messages) {
      (grouped[message.taskId] ??= []).push(message);
    }
    return grouped;
  }, [messages]);

  const acceptTask = useCallback(async (taskId: string): Promise<CollaborationResult> => {
    if (!supabase || !userId) return { ok: false, message: "Micro is not connected to a project." };
    const { error: insertError } = await supabase
      .from("task_assignments")
      .insert({ task_id: taskId, helper_id: userId, status: "accepted" });
    if (insertError) {
      // The partial unique index is the race guard: two helpers tapping accept
      // at once, and the loser is told the truth rather than shown a match.
      const alreadyTaken = insertError.code === "23505";
      return {
        ok: false,
        message: alreadyTaken
          ? "Another neighbor accepted this job first."
          : insertError.message,
      };
    }
    await refresh();
    return { ok: true };
  }, [refresh, userId]);

  const withdrawFromTask = useCallback(async (taskId: string): Promise<CollaborationResult> => {
    if (!supabase || !userId) return { ok: false, message: "Micro is not connected to a project." };
    const { error: updateError } = await supabase
      .from("task_assignments")
      .update({ status: "withdrawn" })
      .eq("task_id", taskId)
      .eq("helper_id", userId)
      .eq("status", "accepted");
    if (updateError) return { ok: false, message: updateError.message };
    await refresh();
    return { ok: true };
  }, [refresh, userId]);

  const sendMessage = useCallback(async (taskId: string, body: string): Promise<CollaborationResult> => {
    if (!supabase || !userId) return { ok: false, message: "Micro is not connected to a project." };
    const trimmed = body.trim();
    if (!trimmed) return { ok: false, message: "Write a message first." };
    const { error: insertError } = await supabase
      .from("task_messages")
      .insert({ task_id: taskId, sender_id: userId, body: trimmed, kind: "human" });
    if (insertError) return { ok: false, message: insertError.message };
    await refresh();
    return { ok: true };
  }, [refresh, userId]);

  return useMemo(
    () => ({ assignments, messagesByTask, error, loading, acceptTask, withdrawFromTask, sendMessage, refresh }),
    [acceptTask, assignments, error, loading, messagesByTask, refresh, sendMessage, withdrawFromTask],
  );
}

/** The live assignment on a task, if one exists. */
export function liveAssignmentFor(assignments: TaskAssignment[], taskId: string): TaskAssignment | null {
  return assignments.find((assignment) => assignment.taskId === taskId && assignment.status === "accepted") ?? null;
}
