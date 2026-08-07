import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfig } from "../supabase";
import { emptyCapabilities, type AccountType, type AuthActionResult, type AuthCapabilities, type AuthOrganization, type AuthProfile, type SignUpInput } from "./types";

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
  session: Session | null;
  profile: AuthProfile | null;
  organization: AuthOrganization | null;
  accountType: AccountType;
  capabilities: AuthCapabilities;
  recoveryMode: boolean;
  demoMode: boolean;
  canSponsor: boolean;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (input: SignUpInput) => Promise<AuthActionResult>;
  resendConfirmation: (email: string) => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  updatePassword: (password: string) => Promise<AuthActionResult>;
  createOrganization: (name: string, website?: string) => Promise<AuthActionResult>;
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

  const signIn = async (email: string, password: string): Promise<AuthActionResult> => {
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
    session,
    profile,
    organization,
    accountType: (organization || profile?.account_type === "nonprofit") ? "nonprofit" : "regular",
    capabilities,
    recoveryMode,
    demoMode,
    canSponsor: capabilities.can_sponsor_tasks,
    signIn,
    signUp,
    resendConfirmation,
    requestPasswordReset,
    updatePassword,
    createOrganization,
    signOut,
    reloadProfile,
    enterDemo: () => setDemoMode(true),
    exitDemo: () => setDemoMode(false),
  }), [accountError, accountLoading, busy, capabilities, demoMode, initialized, organization, profile, recoveryMode, reloadProfile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
