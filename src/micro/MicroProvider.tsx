import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { supabase } from "../supabase";
import { useAuth } from "./AuthProvider";
import { areaIdFromServiceArea, type AreaId } from "./geo";
import { useCollaboration, type CollaborationState } from "./collaboration";
import { initialPostDraft, tasks } from "./fixtures";
import { taskFromRow } from "./taskRows";
import { type CommunityStage, type CompletionSubmission, type MessageItem, type PaidStage, type Persona, type PersonaSessionState, type PostDraft, type TabId, type Task, type TaskEvent, type TaskReviewState } from "./types";

/**
 * All app state that is not authentication: the selected task, lifecycle
 * stages, drafts, personas, and the listings loaded from Supabase.
 */

export type MicroContextValue = {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  selectedTaskId: string;
  setSelectedTaskId: (id: string) => void;
  paidStage: PaidStage;
  setPaidStage: (stage: PaidStage) => void;
  activeTask: Task;
  setActiveTask: (task: Task) => void;
  communityTask: Task | null;
  setCommunityTask: (task: Task | null) => void;
  communityStage: CommunityStage;
  setCommunityStage: (stage: CommunityStage) => void;
  communityChecks: boolean[];
  setCommunityChecks: Dispatch<SetStateAction<boolean[]>>;
  postedTask: Task | null;
  setPostedTask: (task: Task | null) => void;
  ownedTasks: Task[];
  remoteTasks: Task[];
  remoteTasksLoaded: boolean;
  remoteTasksError: string | null;
  refreshRemoteTasks: () => Promise<void>;
  /** Acceptances and task threads shared with the other side, live from Supabase. */
  collaboration: CollaborationState;
  setOwnedTasks: Dispatch<SetStateAction<Task[]>>;
  postDraft: PostDraft;
  setPostDraft: Dispatch<SetStateAction<PostDraft>>;
  acceptedTaskIds: string[];
  setAcceptedTaskIds: Dispatch<SetStateAction<string[]>>;
  closedTaskIds: string[];
  setClosedTaskIds: Dispatch<SetStateAction<string[]>>;
  acceptedTaskActors: Record<string, "adult" | "youth">;
  setAcceptedTaskActors: Dispatch<SetStateAction<Record<string, "adult" | "youth">>>;
  taskEvents: Record<string, TaskEvent[]>;
  setTaskEvents: Dispatch<SetStateAction<Record<string, TaskEvent[]>>>;
  activityPerspective: "helper" | "requester";
  setActivityPerspective: (value: "helper" | "requester") => void;
  savedTaskIds: string[];
  setSavedTaskIds: Dispatch<SetStateAction<string[]>>;
  sponsorFunded: boolean;
  setSponsorFunded: (funded: boolean) => void;
  sponsorSeeking: boolean;
  setSponsorSeeking: (seeking: boolean) => void;
  youthApprovedTaskId: string | null;
  setYouthApprovedTaskId: (taskId: string | null) => void;
  youthApprovalTaskId: string | null;
  setYouthApprovalTaskId: (taskId: string | null) => void;
  youthDeclinedTaskId: string | null;
  setYouthDeclinedTaskId: (taskId: string | null) => void;
  guardianSupervisedTaskId: string | null;
  setGuardianSupervisedTaskId: (taskId: string | null) => void;
  guardianSupervisionStatus: string;
  setGuardianSupervisionStatus: (status: string) => void;
  persona: Persona;
  setPersona: (persona: Persona) => void;
  accessTermsAccepted: boolean;
  setAccessTermsAccepted: (accepted: boolean) => void;
  guardianLinked: boolean;
  setGuardianLinked: (linked: boolean) => void;
  youthAge: 14 | 16;
  setYouthAge: (age: 14 | 16) => void;
  threadMessages: Record<string, MessageItem[]>;
  setThreadMessages: Dispatch<SetStateAction<Record<string, MessageItem[]>>>;
  blockedThreadIds: string[];
  setBlockedThreadIds: Dispatch<SetStateAction<string[]>>;
  blockedRequesterNames: string[];
  setBlockedRequesterNames: Dispatch<SetStateAction<string[]>>;
  reportedTaskIds: string[];
  setReportedTaskIds: Dispatch<SetStateAction<string[]>>;
  reportReasons: Record<string, string>;
  setReportReasons: Dispatch<SetStateAction<Record<string, string>>>;
  moderationHolds: Record<string, string>;
  setModerationHolds: Dispatch<SetStateAction<Record<string, string>>>;
  completionSubmissions: Record<string, CompletionSubmission>;
  setCompletionSubmissions: Dispatch<SetStateAction<Record<string, CompletionSubmission>>>;
  taskReviews: Record<string, TaskReviewState>;
  setTaskReviews: Dispatch<SetStateAction<Record<string, TaskReviewState>>>;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  /** Browser-local read markers retained only for fixture conversations. */
  threadReadAt: Record<string, number>;
  markThreadRead: (key: string) => void;
  /** Special jobs already read in Notifications, so the bell stops pinging for them. */
  seenSpecialJobIds: string[];
  setSeenSpecialJobIds: Dispatch<SetStateAction<string[]>>;
  /** Jobs refused from task details; they stop generating notices entirely. */
  refusedJobIds: string[];
  setRefusedJobIds: Dispatch<SetStateAction<string[]>>;
  /** Threads cleared from this device's Messages list. */
  hiddenThreadIds: string[];
  setHiddenThreadIds: Dispatch<SetStateAction<string[]>>;
  /**
   * Listings of your own you are standing in front of as if a neighbor had
   * posted them. Prototype-only: without a second account there is no other way
   * to walk the helper side of a task you composed yourself.
   */
  neighborPreviewIds: string[];
  setNeighborPreviewIds: Dispatch<SetStateAction<string[]>>;
  profileAreaId: AreaId;
  setProfileAreaId: (areaId: AreaId) => void;
  profilePhotos: Record<Persona, string>;
  setProfilePhotos: Dispatch<SetStateAction<Record<Persona, string>>>;
};

const MicroContext = createContext<MicroContextValue | null>(null);

export function useMicro() {
  const value = useContext(MicroContext);
  if (!value) throw new Error("useMicro must be used inside MicroProvider");
  return value;
}

export function MicroProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("nearby");
  const [selectedTaskId, setSelectedTaskId] = useState("leaves");
  const [paidStage, setPaidStage] = useState<PaidStage>("Payment secured");
  const [activeTask, setActiveTask] = useState<Task>(tasks[0]);
  const [communityTask, setCommunityTask] = useState<Task | null>(null);
  const [communityStage, setCommunityStage] = useState<CommunityStage>("Committed");
  const [communityChecks, setCommunityChecks] = useState([false, false]);
  const [postedTask, setPostedTask] = useState<Task | null>(null);
  const [ownedTasks, setOwnedTasks] = useState<Task[]>([]);
  // Listings other neighbors published. Empty in demo mode, where there is no
  // account to attribute a post to and nothing to sync with.
  // Fixture read markers stay in this browser. Live assignment threads use the
  // authoritative server cursors exposed by `collaboration` instead.
  const readStorageKey = auth.session?.user.id ? `micro-thread-reads-${auth.session.user.id}` : "micro-thread-reads-demo";
  const [threadReadAt, setThreadReadAt] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(readStorageKey);
      setThreadReadAt(stored ? (JSON.parse(stored) as Record<string, number>) : {});
    } catch {
      setThreadReadAt({});
    }
  }, [readStorageKey]);
  const markThreadRead = useCallback((key: string) => {
    setThreadReadAt((current) => {
      const next = { ...current, [key]: Date.now() };
      // Storage can be unavailable in private modes; an unsaved receipt is not
      // worth breaking the thread over.
      try { window.localStorage.setItem(readStorageKey, JSON.stringify(next)); } catch { /* keep going */ }
      return next;
    });
  }, [readStorageKey]);
  const [remoteTasks, setRemoteTasks] = useState<Task[]>([]);
  const [remoteTasksLoaded, setRemoteTasksLoaded] = useState(false);
  const [remoteTasksError, setRemoteTasksError] = useState<string | null>(null);
  const signedInUserId = auth.session?.user.id ?? null;
  const promotedLiveListingForUserRef = useRef<string | null>(null);

  const refreshRemoteTasks = useCallback(async () => {
    if (!supabase || !signedInUserId) {
      setRemoteTasks([]);
      setRemoteTasksLoaded(true);
      setRemoteTasksError(null);
      return;
    }
    const { data, error } = await supabase
      .from("task_listings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRemoteTasksLoaded(true);
    if (error) { setRemoteTasksError(error.message); return; }
    setRemoteTasksError(null);
    setRemoteTasks((data ?? []).map((row) => taskFromRow(row as Record<string, unknown>)));
  }, [signedInUserId]);

  useEffect(() => {
    setRemoteTasksLoaded(false);
    void refreshRemoteTasks();
  }, [refreshRemoteTasks]);

  const collaboration = useCollaboration(signedInUserId, auth.session?.access_token ?? null);
  const refreshCollaboration = collaboration.refresh;

  // Realtime is the fast path. Focus and a modest poll remain as reconciliation
  // paths for a suspended phone or a briefly disconnected websocket.
  useEffect(() => {
    const client = supabase;
    if (!client || !signedInUserId) return;
    const refresh = () => {
      void Promise.all([refreshRemoteTasks(), refreshCollaboration()]);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(refresh, 8_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshCollaboration, refreshRemoteTasks, signedInUserId]);

  useEffect(() => {
    if (!signedInUserId || !remoteTasksLoaded || !remoteTasks.length) return;
    if (promotedLiveListingForUserRef.current === signedInUserId) return;
    promotedLiveListingForUserRef.current = signedInUserId;
    setSelectedTaskId(remoteTasks[0].id);
  }, [remoteTasks, remoteTasksLoaded, signedInUserId]);
  const [postDraft, setPostDraft] = useState<PostDraft>(initialPostDraft);
  const [acceptedTaskIds, setAcceptedTaskIds] = useState<string[]>([]);
  const [closedTaskIds, setClosedTaskIds] = useState<string[]>([]);
  const [acceptedTaskActors, setAcceptedTaskActors] = useState<Record<string, "adult" | "youth">>({});
  const [taskEvents, setTaskEvents] = useState<Record<string, TaskEvent[]>>({});
  const [activityPerspective, setActivityPerspective] = useState<"helper" | "requester">("helper");
  const [savedTaskIds, setSavedTaskIds] = useState<string[]>(["hedge", "table"]);
  const [sponsorFunded, setSponsorFunded] = useState(false);
  const [sponsorSeeking, setSponsorSeeking] = useState(false);
  const [youthApprovedTaskId, setYouthApprovedTaskId] = useState<string | null>(null);
  const [youthApprovalTaskId, setYouthApprovalTaskId] = useState<string | null>(null);
  const [youthDeclinedTaskId, setYouthDeclinedTaskId] = useState<string | null>(null);
  const [guardianSupervisedTaskId, setGuardianSupervisedTaskId] = useState<string | null>(null);
  const [guardianSupervisionStatus, setGuardianSupervisionStatus] = useState("");
  const [persona, setPersonaState] = useState<Persona>("adult");
  const [accessTermsByPersona, setAccessTermsByPersona] = useState<Record<Persona, boolean>>({ adult: true, youth: true, guardian: true });
  const accessTermsAccepted = accessTermsByPersona[persona];
  const setAccessTermsAccepted = (accepted: boolean) => setAccessTermsByPersona((current) => ({ ...current, [persona]: accepted }));
  const [guardianLinked, setGuardianLinked] = useState(true);
  const [youthAge, setYouthAge] = useState<14 | 16>(16);
  const [threadMessages, setThreadMessages] = useState<Record<string, MessageItem[]>>({});
  const [blockedThreadIds, setBlockedThreadIds] = useState<string[]>([]);
  const [blockedRequesterNames, setBlockedRequesterNames] = useState<string[]>([]);
  const [reportedTaskIds, setReportedTaskIds] = useState<string[]>([]);
  const [reportReasons, setReportReasons] = useState<Record<string, string>>({});
  const [moderationHolds, setModerationHolds] = useState<Record<string, string>>({});
  const [completionSubmissions, setCompletionSubmissions] = useState<Record<string, CompletionSubmission>>({});
  const [taskReviews, setTaskReviews] = useState<Record<string, TaskReviewState>>({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  // Deliberately outside the persona snapshots: "already read" is session UI
  // state, not part of a seeded persona fixture.
  const [seenSpecialJobIds, setSeenSpecialJobIds] = useState<string[]>([]);
  // Refusing a job is a decision about that job, not about this page load, so
  // it outlives a refresh the way the read markers above do. Keyed per account
  // so one neighbor's refusals never suppress another's list.
  const refusedStorageKey = auth.session?.user.id ? `micro-refused-jobs-${auth.session.user.id}` : "micro-refused-jobs-demo";
  const [refusedJobIds, setRefusedJobIdsState] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(refusedStorageKey);
      setRefusedJobIdsState(stored ? (JSON.parse(stored) as string[]) : []);
    } catch {
      setRefusedJobIdsState([]);
    }
  }, [refusedStorageKey]);
  // Threads you have cleared from your own list. Local by design: the other
  // participant keeps their copy, and a completed thread stays a retained
  // record on the server either way.
  const hiddenThreadStorageKey = auth.session?.user.id ? `micro-hidden-threads-${auth.session.user.id}` : "micro-hidden-threads-demo";
  const [hiddenThreadIds, setHiddenThreadIdsState] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(hiddenThreadStorageKey);
      setHiddenThreadIdsState(stored ? (JSON.parse(stored) as string[]) : []);
    } catch {
      setHiddenThreadIdsState([]);
    }
  }, [hiddenThreadStorageKey]);
  const setHiddenThreadIds = useCallback<Dispatch<SetStateAction<string[]>>>((value) => {
    setHiddenThreadIdsState((current) => {
      const next = typeof value === "function" ? (value as (previous: string[]) => string[])(current) : value;
      try { window.localStorage.setItem(hiddenThreadStorageKey, JSON.stringify(next)); } catch { /* keep going */ }
      return next;
    });
  }, [hiddenThreadStorageKey]);

  const setRefusedJobIds = useCallback<Dispatch<SetStateAction<string[]>>>((value) => {
    setRefusedJobIdsState((current) => {
      const next = typeof value === "function" ? (value as (previous: string[]) => string[])(current) : value;
      try { window.localStorage.setItem(refusedStorageKey, JSON.stringify(next)); } catch { /* keep going */ }
      return next;
    });
  }, [refusedStorageKey]);
  const [neighborPreviewIds, setNeighborPreviewIds] = useState<string[]>([]);
  const [profileAreaId, setProfileAreaId] = useState<AreaId>(() => areaIdFromServiceArea(auth.profile?.service_area));
  // The chosen photo is browser-local by design — nothing is uploaded — but it
  // should still survive a reload rather than being picked again each session.
  const photoStorageKey = auth.session?.user.id ? `micro-profile-photos-${auth.session.user.id}` : "micro-profile-photos-demo";
  const [profilePhotos, setProfilePhotosState] = useState<Record<Persona, string>>({ adult: "", youth: "", guardian: "" });
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(photoStorageKey);
      setProfilePhotosState(stored ? { adult: "", youth: "", guardian: "", ...(JSON.parse(stored) as Partial<Record<Persona, string>>) } : { adult: "", youth: "", guardian: "" });
    } catch {
      setProfilePhotosState({ adult: "", youth: "", guardian: "" });
    }
  }, [photoStorageKey]);
  const setProfilePhotos: Dispatch<SetStateAction<Record<Persona, string>>> = useCallback((update) => {
    setProfilePhotosState((current) => {
      const next = typeof update === "function" ? (update as (previous: Record<Persona, string>) => Record<Persona, string>)(current) : update;
      // A full storage quota should cost the photo, not the screen.
      try { window.localStorage.setItem(photoStorageKey, JSON.stringify(next)); } catch { /* keep going */ }
      return next;
    });
  }, [photoStorageKey]);

  // Restore an accepted live task after reload for either side of the match.
  // The assignment is the source of truth; these existing lifecycle fields
  // only adapt the current shell so the matched task remains pinned and its
  // Activity entry stays reachable. The server role also locks the interface
  // to requester or helper instead of exposing the fixture perspective switch.
  useEffect(() => {
    if (!signedInUserId) return;
    const activeAssignment = collaboration.assignments.find((assignment) =>
      assignment.status === "accepted" &&
      (assignment.helperId === signedInUserId || assignment.requesterId === signedInUserId),
    );
    const activeTask = activeAssignment?.task ?? (activeAssignment?.taskId ? remoteTasks.find((task) => task.id === activeAssignment.taskId) : undefined);
    if (!activeAssignment || !activeTask) return;
    setAcceptedTaskIds((current) => current.includes(activeTask.id) ? current : [activeTask.id, ...current]);
    setAcceptedTaskActors((current) => current[activeTask.id] === "adult" ? current : { ...current, [activeTask.id]: "adult" });
    setActivityPerspective(activeAssignment.helperId === signedInUserId ? "helper" : "requester");
    setSelectedTaskId(activeTask.id);
    if (activeTask.mode === "community") {
      setCommunityTask(activeTask);
      setCommunityStage("Committed");
    } else {
      setActiveTask(activeTask);
      setPaidStage("Payment secured");
    }
  }, [collaboration.assignments, remoteTasks, signedInUserId]);

  // Realtime settlement removes only server-backed commitments from the active
  // shell. Local fixture commitments keep their own lifecycle state.
  useEffect(() => {
    if (!signedInUserId) return;
    const participantAssignments = collaboration.assignments.filter((assignment) =>
      assignment.helperId === signedInUserId || assignment.requesterId === signedInUserId,
    );
    const serverTaskIds = new Set(participantAssignments.flatMap((assignment) => assignment.taskId ? [assignment.taskId] : []));
    const activeServerTaskIds = new Set(participantAssignments.flatMap((assignment) => assignment.status === "accepted" && assignment.taskId ? [assignment.taskId] : []));
    if (!serverTaskIds.size) return;
    setAcceptedTaskIds((current) => current.filter((id) => !serverTaskIds.has(id) || activeServerTaskIds.has(id)));
    const completedIds = participantAssignments.flatMap((assignment) => assignment.status === "completed" && assignment.taskId ? [assignment.taskId] : []);
    if (completedIds.length) {
      setClosedTaskIds((current) => [...new Set([...completedIds, ...current])]);
    }
  }, [collaboration.assignments, signedInUserId]);

  const personaSessionsRef = useRef<Record<Persona, PersonaSessionState>>({
    adult: {
      selectedTaskId: "leaves", paidStage: "Payment secured", activeTask: tasks[0], communityTask: null, communityStage: "Committed", communityChecks: [false, false], postedTask: null, postDraft: initialPostDraft, acceptedTaskIds: [], closedTaskIds: [], acceptedTaskActors: {}, taskEvents: {}, activityPerspective: "helper", savedTaskIds: ["hedge", "table"], sponsorFunded: false, sponsorSeeking: false, threadMessages: {}, blockedThreadIds: [], blockedRequesterNames: [], reportedTaskIds: [], reportReasons: {}, completionSubmissions: {}, taskReviews: {}, notificationsEnabled: true, profileAreaId: "all",
    },
    youth: {
      selectedTaskId: "pantry", paidStage: "Payment secured", activeTask: tasks[3], communityTask: null, communityStage: "Committed", communityChecks: [false, false], postedTask: null, postDraft: initialPostDraft, acceptedTaskIds: [], closedTaskIds: [], acceptedTaskActors: {}, taskEvents: {}, activityPerspective: "helper", savedTaskIds: [], sponsorFunded: false, sponsorSeeking: false, threadMessages: {}, blockedThreadIds: [], blockedRequesterNames: [], reportedTaskIds: [], reportReasons: {}, completionSubmissions: {}, taskReviews: {}, notificationsEnabled: true, profileAreaId: "all",
    },
    guardian: {
      selectedTaskId: "pantry", paidStage: "Payment secured", activeTask: tasks[3], communityTask: null, communityStage: "Committed", communityChecks: [false, false], postedTask: null, postDraft: initialPostDraft, acceptedTaskIds: [], closedTaskIds: [], acceptedTaskActors: {}, taskEvents: {}, activityPerspective: "requester", savedTaskIds: [], sponsorFunded: false, sponsorSeeking: false, threadMessages: {}, blockedThreadIds: [], blockedRequesterNames: [], reportedTaskIds: [], reportReasons: {}, completionSubmissions: {}, taskReviews: {}, notificationsEnabled: true, profileAreaId: "all",
    },
  });
  const setPersona = (nextPersona: Persona) => {
    if (nextPersona === persona) return;
    personaSessionsRef.current[persona] = {
      selectedTaskId, paidStage, activeTask, communityTask, communityStage, communityChecks, postedTask, postDraft, acceptedTaskIds, closedTaskIds, acceptedTaskActors, taskEvents, activityPerspective, savedTaskIds, sponsorFunded, sponsorSeeking, threadMessages, blockedThreadIds, blockedRequesterNames, reportedTaskIds, reportReasons, completionSubmissions, taskReviews, notificationsEnabled, profileAreaId,
    };
    const next = personaSessionsRef.current[nextPersona];
    setSelectedTaskId(next.selectedTaskId);
    setPaidStage(next.paidStage);
    setActiveTask(next.activeTask);
    setCommunityTask(next.communityTask);
    setCommunityStage(next.communityStage);
    setCommunityChecks(next.communityChecks);
    setPostedTask(next.postedTask);
    setPostDraft(next.postDraft);
    setAcceptedTaskIds(next.acceptedTaskIds);
    setClosedTaskIds(next.closedTaskIds);
    setAcceptedTaskActors(next.acceptedTaskActors);
    setTaskEvents(next.taskEvents);
    setActivityPerspective(next.activityPerspective);
    setSavedTaskIds(next.savedTaskIds);
    setSponsorFunded(next.sponsorFunded);
    setSponsorSeeking(next.sponsorSeeking);
    setThreadMessages(next.threadMessages);
    setBlockedThreadIds(next.blockedThreadIds);
    setBlockedRequesterNames(next.blockedRequesterNames);
    setReportedTaskIds(next.reportedTaskIds);
    setReportReasons(next.reportReasons);
    setCompletionSubmissions(next.completionSubmissions);
    setTaskReviews(next.taskReviews);
    setNotificationsEnabled(next.notificationsEnabled);
    setProfileAreaId(next.profileAreaId);
    setPersonaState(nextPersona);
  };
  const value = useMemo(
    () => ({
      activeTab,
      setActiveTab,
      selectedTaskId,
      setSelectedTaskId,
      paidStage,
      setPaidStage,
      activeTask,
      setActiveTask,
      communityTask,
      setCommunityTask,
      communityStage,
      setCommunityStage,
      communityChecks,
      setCommunityChecks,
      postedTask,
      setPostedTask,
      ownedTasks,
      setOwnedTasks,
      threadReadAt,
      markThreadRead,
      remoteTasks,
      remoteTasksLoaded,
      remoteTasksError,
      refreshRemoteTasks,
      collaboration,
      postDraft,
      setPostDraft,
      acceptedTaskIds,
      setAcceptedTaskIds,
      closedTaskIds,
      setClosedTaskIds,
      acceptedTaskActors,
      setAcceptedTaskActors,
      taskEvents,
      setTaskEvents,
      activityPerspective,
      setActivityPerspective,
      savedTaskIds,
      setSavedTaskIds,
      sponsorFunded,
      setSponsorFunded,
      sponsorSeeking,
      setSponsorSeeking,
      youthApprovedTaskId,
      setYouthApprovedTaskId,
      youthApprovalTaskId,
      setYouthApprovalTaskId,
      youthDeclinedTaskId,
      setYouthDeclinedTaskId,
      guardianSupervisedTaskId,
      setGuardianSupervisedTaskId,
      guardianSupervisionStatus,
      setGuardianSupervisionStatus,
      persona,
      setPersona,
      accessTermsAccepted,
      setAccessTermsAccepted,
      guardianLinked,
      setGuardianLinked,
      youthAge,
      setYouthAge,
      threadMessages,
      setThreadMessages,
      blockedThreadIds,
      setBlockedThreadIds,
      blockedRequesterNames,
      setBlockedRequesterNames,
      reportedTaskIds,
      setReportedTaskIds,
      reportReasons,
      setReportReasons,
      moderationHolds,
      setModerationHolds,
      completionSubmissions,
      setCompletionSubmissions,
      taskReviews,
      setTaskReviews,
      notificationsEnabled,
      setNotificationsEnabled,
      seenSpecialJobIds,
      setSeenSpecialJobIds,
      refusedJobIds,
      setRefusedJobIds,
      hiddenThreadIds,
      setHiddenThreadIds,
      neighborPreviewIds,
      setNeighborPreviewIds,
      profileAreaId,
      setProfileAreaId,
      profilePhotos,
      setProfilePhotos,
    }),
    [acceptedTaskActors, accessTermsAccepted, acceptedTaskIds, activeTab, activeTask, activityPerspective, blockedRequesterNames, blockedThreadIds, closedTaskIds, collaboration, communityChecks, communityStage, communityTask, completionSubmissions, guardianLinked, guardianSupervisedTaskId, guardianSupervisionStatus, moderationHolds, markThreadRead, neighborPreviewIds, notificationsEnabled, ownedTasks, refreshRemoteTasks, remoteTasks, remoteTasksError, remoteTasksLoaded, paidStage, persona, postDraft, postedTask, profileAreaId, profilePhotos, reportReasons, reportedTaskIds, refusedJobIds, savedTaskIds, seenSpecialJobIds, selectedTaskId, sponsorFunded, sponsorSeeking, taskEvents, taskReviews, threadMessages, threadReadAt, youthAge, youthApprovalTaskId, youthApprovedTaskId, youthDeclinedTaskId],
  );

  return <MicroContext.Provider value={value}>{children}</MicroContext.Provider>;
}
