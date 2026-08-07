import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { createEphemeralSupabaseClient, supabase, supabaseConfig } from "../supabase";
import { emptyCapabilities, type AccountType, type AuthActionResult, type AuthCapabilities, type AuthOrganization, type AuthProfile, type DeleteAccountInput, type SignUpInput } from "./types";

type DeleteAccountResponse = {
  deleted?: boolean;
  code?: string;
  message?: string;
  organizations?: Array<{ id: string; name: string }>;
};

/**
 * Everything about who is signed in: the Supabase session, the profile row,
 * the organization they belong to, and the capabilities the database says they
 * have. The rest of the app asks this and never queries auth tables directly.
 */

export type AuthContextValue = {
  configured: boolean;
  initialized: boolean;
  busy: boolean;
  accountLoading: boolean;
  accountError: string | null;
  accountNotice: string | null;
  session: Session | null;
  profile: AuthProfile | null;
  organization: AuthOrganization | null;
  accountType: AccountType;
  capabilities: AuthCapabilities;
  recoveryMode: boolean;
  demoMode: boolean;
  canSponsor: boolean;
  requiresPasswordReauthentication: boolean;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (input: SignUpInput) => Promise<AuthActionResult>;
  resendConfirmation: (email: string) => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  updatePassword: (password: string) => Promise<AuthActionResult>;
  createOrganization: (name: string, website?: string) => Promise<AuthActionResult>;
  deleteAccount: (input: DeleteAccountInput) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
  reloadProfile: () => Promise<void>;
  enterDemo: () => void;
  exitDemo: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function friendlyAuthError(error: unknown, fallback: string) {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? "").toLowerCase()
    : "";

  if (message.includes("invalid login credentials")) return "We couldn't sign you in. Check your email and password.";
  if (message.includes("email not confirmed")) return "Confirm your email before signing in.";
  if (message.includes("already registered") || message.includes("user already exists")) return "An account may already use that email. Try signing in or resetting the password.";
  if (message.includes("weak password") || message.includes("password should")) return "Use at least 8 characters and avoid a commonly used password.";
  if (message.includes("rate limit") || message.includes("too many requests")) return "Too many attempts. Wait a moment, then try again.";
  if (message.includes("failed to fetch") || message.includes("network")) return "Micro couldn't reach Supabase. Check your connection and try again.";
  return fallback;
}

async function accountDeletionResponse(error: unknown, data: unknown): Promise<DeleteAccountResponse> {
  if (data && typeof data === "object") return data as DeleteAccountResponse;
  const context = error && typeof error === "object" && "context" in error
    ? (error as { context?: unknown }).context
    : null;
  if (
    !context
    || typeof context !== "object"
    || !("json" in context)
    || typeof (context as { json?: unknown }).json !== "function"
  ) return {};

  try {
    return await (context as Response).clone().json() as DeleteAccountResponse;
  } catch {
    return {};
  }
}

export function initialsFromName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "M";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("") || "M";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [organization, setOrganization] = useState<AuthOrganization | null>(null);
  const [capabilities, setCapabilities] = useState<AuthCapabilities>(emptyCapabilities);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const hydrationRequestRef = useRef(0);
  const authEventSequenceRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(null);

  const hydrateAccount = useCallback(async (nextSession: Session | null) => {
    const requestId = ++hydrationRequestRef.current;
    const isCurrentRequest = () => hydrationRequestRef.current === requestId;

    if (!supabase || !nextSession) {
      setProfile(null);
      setOrganization(null);
      setCapabilities(emptyCapabilities());
      setAccountError(null);
      setAccountLoading(false);
      return;
    }

    setAccountLoading(true);
    setAccountError(null);
    setProfile(null);
    setOrganization(null);
    setCapabilities(emptyCapabilities());

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, service_area, account_type")
        .eq("id", nextSession.user.id)
        .maybeSingle();

      if (!isCurrentRequest()) return;
      if (profileError || !profileData) {
        setAccountError(
          profileError
            ? "Your account is signed in, but Micro couldn't load its protected profile. The database setup may still need to be applied."
            : "Your account is signed in, but its Micro profile is not ready yet.",
        );
        return;
      }

      const nextProfile = profileData as AuthProfile;
      setProfile(nextProfile);

      const { data: membershipData, error: membershipError } = await supabase
        .from("organization_members")
        .select("member_role, organization:organizations(id, name, verification_status, sponsorship_enabled)")
        .eq("user_id", nextSession.user.id)
        .eq("membership_status", "active")
        .maybeSingle();

      if (!isCurrentRequest()) return;
      if (membershipError) {
        setAccountError("Your account loaded, but its organization membership could not be verified.");
        return;
      }

      const membership = membershipData as {
        member_role?: AuthOrganization["role"];
        organization?: Omit<AuthOrganization, "role"> | Array<Omit<AuthOrganization, "role">> | null;
      } | null;
      const related = Array.isArray(membership?.organization)
        ? membership?.organization[0]
        : membership?.organization;

      setOrganization(
        related && membership?.member_role
          ? { ...related, role: membership.member_role }
          : null,
      );

      const { data: capabilityData, error: capabilityError } = await supabase
        .rpc("current_user_capabilities")
        .maybeSingle();

      if (!isCurrentRequest()) return;
      if (capabilityError || !capabilityData) {
        setAccountError("Micro couldn't verify your task permissions. Try loading the account again.");
        return;
      }
      setCapabilities(capabilityData as AuthCapabilities);
    } catch (error) {
      if (!isCurrentRequest()) return;
      setProfile(null);
      setOrganization(null);
      setCapabilities(emptyCapabilities());
      setAccountError(friendlyAuthError(error, "Micro couldn't load your protected account. Try again."));
    } finally {
      if (isCurrentRequest()) setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setInitialized(true);
      return;
    }

    let active = true;

    const initialSequence = authEventSequenceRef.current;
    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active || authEventSequenceRef.current !== initialSequence) return;
        if (error) {
          setAccountError("Micro couldn't restore your previous session.");
          return;
        }
        activeUserIdRef.current = data.session?.user.id ?? null;
        setSession(data.session);
        return hydrateAccount(data.session);
      })
      .catch(() => {
        if (active && authEventSequenceRef.current === initialSequence) setAccountError("Micro couldn't restore your previous session.");
      })
      .finally(() => {
        if (active && authEventSequenceRef.current === initialSequence) setInitialized(true);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      authEventSequenceRef.current += 1;
      const nextUserId = nextSession?.user.id ?? null;
      const identityChanged = activeUserIdRef.current !== nextUserId;
      activeUserIdRef.current = nextUserId;
      setSession(nextSession);
      setInitialized(true);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      if (event === "SIGNED_OUT") {
        setRecoveryMode(false);
        setDemoMode(false);
      }
      if (identityChanged) {
        hydrationRequestRef.current += 1;
        setProfile(null);
        setOrganization(null);
        setCapabilities(emptyCapabilities());
        setAccountError(null);
        setAccountLoading(Boolean(nextSession));
        window.setTimeout(() => {
          if (active) void hydrateAccount(nextSession);
        }, 0);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [hydrateAccount]);

  const requireClient = () => {
    if (supabase) return null;
    return {
      ok: false,
      message: "Micro is waiting for the project's publishable key. No secret key is required.",
    } satisfies AuthActionResult;
  };

  const runBusyAction = async (
    work: () => Promise<AuthActionResult>,
    fallback: string,
  ): Promise<AuthActionResult> => {
    setBusy(true);
    try {
      return await work();
    } catch (error) {
      return { ok: false, message: friendlyAuthError(error, fallback) };
    } finally {
      setBusy(false);
    }
  };

  const primaryAuthProvider = typeof session?.user.app_metadata?.provider === "string"
    ? session.user.app_metadata.provider
    : session?.user.identities?.[0]?.provider;
  const requiresPasswordReauthentication = Boolean(
    session && (!primaryAuthProvider || primaryAuthProvider === "email"),
  );

  const signIn = async (email: string, password: string): Promise<AuthActionResult> => {
    setAccountNotice(null);
    const missing = requireClient();
    if (missing) return missing;
    return runBusyAction(async () => {
      const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
      return error
        ? { ok: false, message: friendlyAuthError(error, "We couldn't sign you in. Try again.") }
        : { ok: true };
    }, "We couldn't sign you in. Try again.");
  };

  const signUp = async (input: SignUpInput): Promise<AuthActionResult> => {
    setAccountNotice(null);
    const missing = requireClient();
    if (missing) return missing;
    return runBusyAction(async () => {
      const { data, error } = await supabase!.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            display_name: input.fullName.trim(),
            account_type: input.accountType,
            service_area: input.approximateArea,
            standards_accepted: input.standardsAccepted,
            organization_name: input.organizationName?.trim() || null,
            organization_website: input.organizationWebsite?.trim() || null,
          },
        },
      });
      if (error) return { ok: false, message: friendlyAuthError(error, "We couldn't create the account. Try again.") };
      return { ok: true, confirmationRequired: !data.session };
    }, "We couldn't create the account. Try again.");
  };

  const resendConfirmation = async (email: string): Promise<AuthActionResult> => {
    const missing = requireClient();
    if (missing) return missing;
    return runBusyAction(async () => {
      const { error } = await supabase!.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      return error
        ? { ok: false, message: friendlyAuthError(error, "We couldn't resend the confirmation email.") }
        : { ok: true, message: "A new confirmation email is on its way." };
    }, "We couldn't resend the confirmation email.");
  };

  const requestPasswordReset = async (email: string): Promise<AuthActionResult> => {
    const missing = requireClient();
    if (missing) return missing;
    return runBusyAction(async () => {
      const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      return error
        ? { ok: false, message: friendlyAuthError(error, "We couldn't send the reset email. Try again.") }
        : { ok: true, message: "If that email belongs to an account, a reset link is on its way." };
    }, "We couldn't send the reset email. Try again.");
  };

  const updatePassword = async (password: string): Promise<AuthActionResult> => {
    const missing = requireClient();
    if (missing) return missing;
    return runBusyAction(async () => {
      const { error } = await supabase!.auth.updateUser({ password });
      if (error) return { ok: false, message: friendlyAuthError(error, "We couldn't update the password.") };
      setRecoveryMode(false);
      return { ok: true, message: "Your password has been updated." };
    }, "We couldn't update the password.");
  };

  const createOrganization = async (name: string, website?: string): Promise<AuthActionResult> => {
    const missing = requireClient();
    if (missing) return missing;
    if (!session) return { ok: false, message: "Sign in again before creating the organization profile." };
    const slugBase = name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "micro-nonprofit";
    const slug = `${slugBase}-${session.user.id.slice(0, 6)}`;
    return runBusyAction(async () => {
      const { error } = await supabase!
        .from("organizations")
        .insert({
          name: name.trim(),
          slug,
          website_url: website?.trim() || null,
        });
      if (error) return { ok: false, message: "Micro couldn't create the organization profile. Check the name and try again." };
      await hydrateAccount(session);
      return { ok: true };
    }, "Micro couldn't create the organization profile. Check the name and try again.");
  };

  const deleteAccount = async ({ password, confirmation }: DeleteAccountInput): Promise<AuthActionResult> => {
    const missing = requireClient();
    if (missing) return missing;
    if (!session) {
      return {
        ok: false,
        code: "authentication_required",
        message: "Sign in again before deleting your account.",
      };
    }
    if (confirmation !== "DELETE") {
      return {
        ok: false,
        code: "confirmation_required",
        message: "Type DELETE exactly as shown before continuing.",
      };
    }

    const deletingUserId = session.user.id;
    return runBusyAction(async () => {
      let deletionClient = supabase!;
      let freshAccessToken: string | null = null;
      let temporaryClient = false;
      const clearTemporarySession = async () => {
        if (!temporaryClient) return;
        try {
          await deletionClient.auth.signOut({ scope: "local" });
        } catch {
          // This client is memory-only and is discarded after this action.
        }
      };

      if (requiresPasswordReauthentication) {
        const email = session.user.email;
        if (!email || !password) {
          return {
            ok: false,
            code: "reauthentication_required",
            message: "Enter your current password before deleting this account.",
          };
        }

        const ephemeralClient = createEphemeralSupabaseClient();
        if (!ephemeralClient) {
          return {
            ok: false,
            code: "account_deletion_unavailable",
            message: "Micro couldn't start a secure deletion check. Try again later.",
          };
        }
        deletionClient = ephemeralClient;
        temporaryClient = true;

        const { data: reauthentication, error: reauthenticationError } =
          await deletionClient.auth.signInWithPassword({ email, password });
        if (
          reauthenticationError
          || !reauthentication.session
          || reauthentication.user?.id !== deletingUserId
        ) {
          await clearTemporarySession();
          const reauthenticationMessage = reauthenticationError
            && typeof reauthenticationError.message === "string"
            && reauthenticationError.message.toLowerCase().includes("invalid login credentials")
            ? "That password doesn't match this Micro account. Try again or reset it from the sign-in screen."
            : friendlyAuthError(
              reauthenticationError,
              "That password could not be verified for this account. Try again or reset it from the sign-in screen.",
            );
          return {
            ok: false,
            code: "reauthentication_required",
            message: reauthenticationMessage,
          };
        }
        freshAccessToken = reauthentication.session.access_token;
      }

      if (activeUserIdRef.current !== deletingUserId) {
        await clearTemporarySession();
        return {
          ok: false,
          code: "authentication_changed",
          message: "The signed-in account changed. Start account deletion again from Profile.",
        };
      }

      let invocation: { data: DeleteAccountResponse | null; error: unknown };
      try {
        invocation = await deletionClient.functions.invoke<DeleteAccountResponse>("delete-account", {
          body: { confirmation },
          ...(freshAccessToken
            ? { headers: { Authorization: `Bearer ${freshAccessToken}` } }
            : {}),
        });
      } catch (invocationError) {
        await clearTemporarySession();
        throw invocationError;
      }

      const { data, error } = invocation;
      const response = await accountDeletionResponse(error, data);
      if (error || response.deleted !== true) {
        await clearTemporarySession();
        if (response.code === "organization_owner_transfer_required") {
          const organizationName = response.organizations?.[0]?.name ?? organization?.name;
          return {
            ok: false,
            code: response.code,
            message: organizationName
              ? `Choose another linked person as the active owner of ${organizationName} before deleting this account.`
              : "Choose another linked person as the active owner of your nonprofit before deleting this account.",
          };
        }
        if (response.code === "storage_cleanup_required") {
          return {
            ok: false,
            code: response.code,
            message: "Micro found account-owned files that must be safely removed first. Contact support before trying again.",
          };
        }
        if (response.code === "reauthentication_required") {
          return {
            ok: false,
            code: response.code,
            message: requiresPasswordReauthentication
              ? "Your secure sign-in expired. Enter your password again, then retry."
              : "Your secure sign-in expired. Sign out, sign back in, and then retry.",
          };
        }
        if (response.code === "authentication_required" || response.code === "invalid_session") {
          return {
            ok: false,
            code: response.code,
            message: "Your session is no longer valid. Sign in again before retrying.",
          };
        }
        return {
          ok: false,
          code: response.code ?? "account_deletion_unconfirmed",
          message: "Micro did not receive a deletion confirmation. Check your connection; if you can still sign in, retry from Profile.",
        };
      }

      await clearTemporarySession();
      // Auth deletion does not clear a browser's cached session. Clear it only
      // after the server confirms that the authoritative hard delete succeeded.
      try {
        await supabase!.auth.signOut({ scope: "local" });
      } catch {
        // The server may already have removed the session. The confirmed delete
        // remains authoritative, so clear the local React state below.
      }
      authEventSequenceRef.current += 1;
      hydrationRequestRef.current += 1;
      activeUserIdRef.current = null;
      setSession(null);
      setProfile(null);
      setOrganization(null);
      setCapabilities(emptyCapabilities());
      setAccountError(null);
      setAccountNotice("Your Micro account was deleted. You’re now signed out.");
      setRecoveryMode(false);
      setDemoMode(false);
      return { ok: true };
    }, "Micro couldn't confirm account deletion. Check your connection and try again.");
  };

  const signOut = async (): Promise<AuthActionResult> => {
    if (demoMode) {
      setDemoMode(false);
      return { ok: true };
    }
    const missing = requireClient();
    if (missing) return missing;
    return runBusyAction(async () => {
      const { error } = await supabase!.auth.signOut();
      if (error) return { ok: false, message: "Micro couldn't sign you out. Try again." };
      setProfile(null);
      setOrganization(null);
      setCapabilities(emptyCapabilities());
      return { ok: true };
    }, "Micro couldn't sign you out. Try again.");
  };

  const reloadProfile = useCallback(async () => {
    if (session) {
      await hydrateAccount(session);
      return;
    }
    if (!supabase) {
      setAccountError("Micro is waiting for the project's publishable key.");
      return;
    }

    const authSequence = authEventSequenceRef.current;
    setAccountLoading(true);
    setAccountError(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (authEventSequenceRef.current !== authSequence) return;
      if (error) {
        setAccountError("Micro couldn't restore your previous session.");
        return;
      }
      activeUserIdRef.current = data.session?.user.id ?? null;
      setSession(data.session);
      setInitialized(true);
      if (data.session) await hydrateAccount(data.session);
    } catch {
      if (authEventSequenceRef.current === authSequence) setAccountError("Micro couldn't restore your previous session.");
    } finally {
      if (authEventSequenceRef.current === authSequence) setAccountLoading(false);
    }
  }, [hydrateAccount, session]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: supabaseConfig.configured,
    initialized,
    busy,
    accountLoading,
    accountError,
    accountNotice,
    session,
    profile,
    organization,
    accountType: (organization || profile?.account_type === "nonprofit") ? "nonprofit" : "regular",
    capabilities,
    recoveryMode,
    demoMode,
    canSponsor: capabilities.can_sponsor_tasks,
    requiresPasswordReauthentication,
    signIn,
    signUp,
    resendConfirmation,
    requestPasswordReset,
    updatePassword,
    createOrganization,
    deleteAccount,
    signOut,
    reloadProfile,
    enterDemo: () => {
      setAccountNotice(null);
      setDemoMode(true);
    },
    exitDemo: () => setDemoMode(false),
  }), [accountError, accountLoading, accountNotice, busy, capabilities, demoMode, initialized, organization, profile, recoveryMode, reloadProfile, requiresPasswordReauthentication, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
