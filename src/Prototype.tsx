import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Buildings,
  Camera,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CornersIn,
  CornersOut,
  ChatCircle,
  Check,
  CheckCircle,
  Clock,
  CurrencyDollar,
  EnvelopeSimple,
  HandHeart,
  
  Info,
  
  ListChecks,
  LockKey,
  MagnifyingGlass,
  MapPin,
  Minus,
  NavigationArrow,
  NotePencil,
  Prohibit,

  PaperPlaneTilt,
  Plus,
  SealCheck,
  
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  Sparkle,
  Star,
  Tag,
  Trash,
  UserCircle,
  UsersThree,
  Warning,
  Wrench,
  X,
  type Icon,
} from "@phosphor-icons/react";
import "@fontsource-variable/atkinson-hyperlegible-next";
import "@fontsource-variable/fraunces";
import { AdvancedMarker, AdvancedMarkerAnchorPoint, APILoadingStatus, APIProvider, Circle, Map as GoogleMap, useApiLoadingStatus, useMap } from "@vis.gl/react-google-maps";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type FormEvent, type ReactNode, type SetStateAction } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  BottomSheet,
  Carousel,
  FlowStack,
  KeyboardInput,
  KeyboardTextarea,
  MobileScroll,
  useFlow,
  useKeyboard,
  useKeyboardInsets,
  type FlowScreen,
} from "./mobile";
import {
  buildCustomTemplate,
  catalogCategories,
  categoryById,
  composeListing,
  customCompletions,
  customDurations,
  customTextProblem,
  CUSTOM_TEMPLATE_ID,
  defaultSelections,
  searchTemplates,
  taskTemplates,
  templateById,
  type TaskTemplate,
} from "./taskCatalog";
import { supabase } from "./supabase";
import { areaById, areaForPoint, areas, areaBounds, distanceMiles, formatDistance, mapsApiKey, mapsMapId, pixelOffsetFromCenter, readDeviceLocation, staticMapUrl, type AreaId, type LatLng, type MicroArea } from "./micro/geo";
import { agoLabel, arrivalWindowMinutes, countdownLabel, dateChoicesFor, hasExpired, minutesUntil, slotsRemainingToday, startLabel, startMoment, startsToday, startTimeSlots } from "./micro/schedule";
import { type CollaborationState, type TaskAssignment } from "./micro/collaboration";
import { appendTaskEvent, emptyTaskReview, type AccountType, type CompletionSubmission, type MessageItem, type PaidStage, type Persona, type PostDraft, type TabId, type Task, type TaskEvent, type TaskMode } from "./micro/types";
import { initialPostDraft, modeMeta, pastThreadTasks, sponsoredFixtureTask, tasks } from "./micro/fixtures";
import { AuthProvider, initialsFromName, useAuth, type AuthContextValue } from "./micro/AuthProvider";
import { MicroProvider, useMicro } from "./micro/MicroProvider";
import { taskFromRow } from "./micro/taskRows";







const rootScreen: FlowScreen = {
  id: "micro-home",
  render: () => <MicroShell />,
};

export default function Prototype() {
  return <AuthProvider><AuthBoundary /><div className="app-status-scrim" aria-hidden="true" /></AuthProvider>;
}

function AuthBoundary() {
  const auth = useAuth();

  if (!auth.initialized || (auth.session && auth.accountLoading)) {
    return <AuthLoadingScreen />;
  }

  if (auth.recoveryMode) {
    return <FlowStack initial={makeUpdatePasswordScreen()} />;
  }

  if (auth.accountError) {
    return <AuthAccountErrorScreen />;
  }

  if (auth.session && auth.profile) {
    if (auth.accountType === "nonprofit" && !auth.organization) {
      return <FlowStack initial={makeNonprofitSetupScreen()} />;
    }

    return (
      <MicroProvider key={auth.session.user.id}>
        <FlowStack initial={rootScreen} />
      </MicroProvider>
    );
  }

  if (auth.demoMode) {
    return (
      <MicroProvider key="local-demo">
        <FlowStack initial={rootScreen} />
      </MicroProvider>
    );
  }

  return <FlowStack initial={authWelcomeScreen} />;
}

const authWelcomeScreen: FlowScreen = {
  id: "auth-welcome",
  render: () => <AuthWelcomeScreen />,
};

function authRoute(title: string, id: string, render: () => ReactNode): FlowScreen {
  return {
    id,
    headerHeight: 66,
    header: (flow) => <RouteHeader title={title} onBack={flow.pop} />,
    render,
  };
}

function makeLoginScreen(): FlowScreen {
  return authRoute("Sign in", "auth-login", () => <LoginScreen />);
}

function makeAccountTypeScreen(): FlowScreen {
  return authRoute("Create account", "auth-account-type", () => <AccountTypeScreen />);
}

function makeSignUpScreen(accountType: AccountType): FlowScreen {
  return authRoute(
    accountType === "nonprofit" ? "Nonprofit account" : "Neighbor account",
    `auth-signup-${accountType}`,
    () => <SignUpScreen accountType={accountType} />,
  );
}

function makeCheckEmailScreen(email: string): FlowScreen {
  return authRoute("Check your email", "auth-check-email", () => <CheckEmailScreen email={email} />);
}

function makeForgotPasswordScreen(): FlowScreen {
  return authRoute("Reset password", "auth-forgot-password", () => <ForgotPasswordScreen />);
}

function makeResetSentScreen(email: string): FlowScreen {
  return authRoute("Check your email", "auth-reset-sent", () => <ResetSentScreen email={email} />);
}

function makeUpdatePasswordScreen(): FlowScreen {
  return {
    id: "auth-update-password",
    render: () => <UpdatePasswordScreen />,
  };
}

function makeNonprofitSetupScreen(): FlowScreen {
  return {
    id: "auth-nonprofit-setup",
    render: () => <NonprofitSetupScreen />,
  };
}

function AuthLoadingScreen() {
  return (
    <main className="auth-experience auth-loading" aria-busy="true" aria-label="Loading Micro account">
      <div className="auth-brand-mark" aria-hidden="true"><span>M</span></div>
      <div className="auth-loading-dot" aria-hidden="true" />
      <p>Opening your neighborhood…</p>
    </main>
  );
}

function AuthAccountErrorScreen() {
  const auth = useAuth();
  return (
    <MobileScroll className="auth-experience auth-scroll">
      <main className="auth-state-screen">
        <div className="auth-brand-lockup"><img className="brand-mark" src="/assets/micro/micro-mark.png" alt="" draggable={false} /><span className="auth-wordmark">Micro</span><span>helping nearby</span></div>
        <section className="auth-state-card" role="alert">
          <span className="auth-state-icon warning"><Warning size={30} weight="duotone" /></span>
          <p className="eyebrow">Account setup</p>
          <h1>We need one more connection.</h1>
          <p>{auth.accountError}</p>
          <button className="primary-button" disabled={auth.accountLoading} onClick={() => void auth.reloadProfile()}>{auth.accountLoading ? "Checking…" : "Try again"}</button>
          <button className="text-button" onClick={() => void auth.signOut()}>Sign out</button>
        </section>
      </main>
    </MobileScroll>
  );
}

function AuthWelcomeScreen() {
  const flow = useFlow();
  const auth = useAuth();
  return (
    <MobileScroll className="auth-experience auth-scroll">
      <main className="auth-welcome" data-testid="auth-welcome">
        <header className="auth-brand-lockup"><img className="brand-mark" src="/assets/micro/micro-mark.png" alt="" draggable={false} /><span className="auth-wordmark">Micro</span><span>helping nearby</span></header>
        {auth.accountNotice ? <p className="auth-account-notice" role="status"><CheckCircle size={19} weight="fill" aria-hidden="true" /><span>{auth.accountNotice}</span></p> : null}
        <section className="auth-welcome-copy">
          <h1>Small tasks.<br />Real neighbors.</h1>
          <p>Post clearly scoped help, or lend a hand nearby.</p>
        </section>
        <p className="auth-trust-strip" aria-label="Micro participation principles">Clear scope<span aria-hidden="true">·</span>Fair pay<span aria-hidden="true">·</span>Community care</p>
        <AuthHeroMap />
        <div className="auth-welcome-actions">
          <button className="primary-button" onClick={() => flow.push(makeAccountTypeScreen())}>Create an account <ArrowRight size={19} /></button>
          <button className="secondary-button" onClick={() => flow.push(makeLoginScreen())}>I already have an account</button>
          <button className="text-button auth-demo-link" onClick={auth.enterDemo}>Continue with the local demo</button>
        </div>
        <p className="auth-legal-note">Exact addresses stay private until a confirmed match.</p>
      </main>
    </MobileScroll>
  );
}

// A still map, not the interactive one: nobody should be panning a sign-in
// screen, and one fixed URL caches instead of billing a map load per visit.
const heroMapWidth = 480;
const heroMapHeight = 280;
const heroMapZoom = 11;
const heroTaskIds = ["leaves", "boxes", "tablet", "pantry"];

function AuthHeroMap() {
  const heroArea = areaById("all");
  const frameRef = useRef<HTMLElement>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const url = staticMapUrl(heroArea.center, heroMapZoom, heroMapWidth, heroMapHeight);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setFrame({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(node);
    return () => observer.disconnect();
  }, [url]);

  if (!url) {
    return (
      <figure className="auth-hero-art">
        <img src="/assets/micro/front-yard-leaves.webp" alt="A front yard with raked leaves, filled green-waste bags, and a rake by the gate" draggable={false} />
      </figure>
    );
  }
  // object-fit: cover scales the requested image by this factor and centres it,
  // so pin offsets scale by exactly the same amount. Measured rather than assumed,
  // because the frame's aspect does not match the requested image's.
  const coverScale = frame.width && frame.height
    ? Math.max(frame.width / heroMapWidth, frame.height / heroMapHeight)
    : 0;
  const pins = coverScale
    ? tasks
        .filter((task) => heroTaskIds.includes(task.id))
        .map((task) => {
          const offset = pixelOffsetFromCenter(approximateCoords(task), heroArea.center, heroMapZoom);
          return { id: task.id, x: offset.x * coverScale, y: offset.y * coverScale };
        })
        .filter((pin) => Math.abs(pin.x) < frame.width / 2 - 20 && Math.abs(pin.y) < frame.height / 2 - 20)
    : [];
  return (
    <figure className="auth-hero-art auth-hero-map" ref={frameRef}>
      <img src={url} alt="Map of Oakland and Alameda showing approximate areas where neighbours are asking for help" draggable={false} />
      {pins.map((pin) => (
        <img key={pin.id} className="auth-hero-pin" style={{ left: `calc(50% + ${pin.x}px)`, top: `calc(50% + ${pin.y}px)` }} src="/assets/micro/micro-mark.png" alt="" draggable={false} />
      ))}
    </figure>
  );
}

function AuthConnectionNote() {
  return (
    <p className="auth-connection-note" role="status">Accounts are not connected yet — use the local demo.</p>
  );
}

function AuthLiveBoundary() {
  return (
    <p className="auth-connection-note live" role="note">Accounts, real listings, matches, and task messages are live. Payments and moderation remain preview-only.</p>
  );
}

function isKeyboardTextEntry(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  if (target instanceof HTMLTextAreaElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "file", "radio", "range", "reset", "submit"].includes(target.type);
}

function AuthInputField({
  id,
  label,
  icon: FieldIcon,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
  help,
  errorId,
  invalid = false,
}: {
  id: string;
  label: string;
  icon: Icon;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "url" | "password";
  autoComplete?: string;
  placeholder?: string;
  help?: string;
  errorId?: string;
  invalid?: boolean;
}) {
  const keyboard = useKeyboard();
  const helpId = help ? `${id}-help` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <label className="auth-field" htmlFor={id}>
      <span>{label}</span>
      <span className="auth-input-shell" data-invalid={invalid ? "true" : "false"}>
        <FieldIcon size={20} aria-hidden="true" />
        <KeyboardInput
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          inputMode={type === "email" ? "email" : type === "url" ? "url" : "text"}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => {
            if (isKeyboardTextEntry(event.relatedTarget)) return;
            window.setTimeout(() => {
              if (!isKeyboardTextEntry(document.activeElement)) keyboard.hide();
            }, 0);
          }}
        />
      </span>
      {help ? <small id={helpId}>{help}</small> : null}
    </label>
  );
}

function AuthFormHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return (
    <header className="auth-form-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
      <p>{copy}</p>
    </header>
  );
}

function LoginScreen() {
  const flow = useFlow();
  const keyboard = useKeyboard();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    keyboard.hide();
    if (!emailValid || !password) {
      setError("Enter a valid email and your password.");
      return;
    }
    setError("");
    const result = await auth.signIn(email, password);
    if (!result.ok) setError(result.message ?? "We couldn't sign you in.");
  };

  return (
    <MobileScroll className="auth-experience auth-scroll">
      <main className="auth-route-page">
        <AuthFormHeading eyebrow="Welcome back" title="Sign in to Micro." copy="Your account and nonprofit permissions stay protected with Supabase. Task and message content is still local preview data." />
        {!auth.configured ? <AuthConnectionNote /> : <AuthLiveBoundary />}
        <form className="auth-form" onSubmit={submit} noValidate>
          <AuthInputField id="login-email" label="Email" icon={EnvelopeSimple} type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.org" errorId={error ? "login-error" : undefined} invalid={Boolean(error) && !emailValid} />
          <AuthInputField id="login-password" label="Password" icon={LockKey} type="password" value={password} onChange={setPassword} autoComplete="current-password" placeholder="Your password" errorId={error ? "login-error" : undefined} invalid={Boolean(error) && !password} />
          <button type="button" className="text-button auth-forgot-link" onClick={() => { keyboard.hide(); flow.push(makeForgotPasswordScreen()); }}>Forgot password?</button>
          {error ? <p id="login-error" className="auth-form-error" role="alert"><Warning size={17} weight="fill" /> {error}</p> : null}
          <button className="primary-button" type="submit" disabled={auth.busy}>{auth.busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <div className="auth-switch-row"><span>New to Micro?</span><button className="text-button" onClick={() => flow.push(makeAccountTypeScreen())}>Create an account</button></div>
      </main>
    </MobileScroll>
  );
}

function AccountTypeScreen() {
  const flow = useFlow();
  return (
    <MobileScroll className="auth-experience auth-scroll">
      <main className="auth-route-page">
        <AuthFormHeading eyebrow="Choose your account" title="How will you use Micro?" copy="Both account types can post and accept tasks. Verified nonprofits can also coordinate sponsorship." />
        <section className="account-type-list" aria-label="Account type">
          <button className="account-type-card" onClick={() => flow.push(makeSignUpScreen("regular"))}>
            <span className="account-type-icon"><UserCircle size={29} weight="duotone" /></span>
            <span><strong>Neighbor</strong><small>Post tasks, accept nearby help, and join Community Help.</small></span>
            <ArrowRight size={20} />
          </button>
          <button className="account-type-card nonprofit" onClick={() => flow.push(makeSignUpScreen("nonprofit"))}>
            <span className="account-type-icon"><Buildings size={29} weight="duotone" /></span>
            <span><strong>Nonprofit organization</strong><small>Post and accept tasks now. Sponsorship tools unlock after verification.</small></span>
            <ArrowRight size={20} />
          </button>
        </section>
        <div className="auth-privacy-card"><ShieldCheck size={21} weight="fill" /><span><strong>Account type is not a shortcut around trust.</strong> Sponsor access depends on a verified organization record.</span></div>
      </main>
    </MobileScroll>
  );
}

function SignUpScreen({ accountType }: { accountType: AccountType }) {
  const flow = useFlow();
  const keyboard = useKeyboard();
  const auth = useAuth();
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationWebsite, setOrganizationWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [area, setArea] = useState<AreaId>("all");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const valid = fullName.trim().length >= 2
    && emailValid
    && password.length >= 8
    && accepted
    && (accountType === "regular" || organizationName.trim().length >= 2);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    keyboard.hide();
    if (!valid) {
      setError(accountType === "nonprofit" && organizationName.trim().length < 2
        ? "Add the organization name, a valid email, an 8-character password, and accept the standards."
        : "Add your name, a valid email, an 8-character password, and accept the standards.");
      return;
    }
    setError("");
    const result = await auth.signUp({
      accountType,
      fullName,
      email,
      password,
      approximateArea: area,
      standardsAccepted: accepted,
      organizationName,
      organizationWebsite,
    });
    if (!result.ok) {
      setError(result.message ?? "We couldn't create the account.");
      return;
    }
    if (result.confirmationRequired) flow.replace(makeCheckEmailScreen(email.trim()));
  };

  return (
    <MobileScroll className="auth-experience auth-scroll">
      <main className="auth-route-page auth-signup-page">
        <AuthFormHeading
          eyebrow={accountType === "nonprofit" ? "Organization representative" : "Neighbor account"}
          title={accountType === "nonprofit" ? "Introduce your nonprofit." : "A few details, then you're in."}
          copy={accountType === "nonprofit" ? "This creates a pending organization profile. Sponsorship stays locked until verification." : "Micro uses your approximate area for discovery and keeps exact addresses protected."}
        />
        {!auth.configured ? <AuthConnectionNote /> : <AuthLiveBoundary />}
        <form className="auth-form" onSubmit={submit} noValidate>
          {accountType === "nonprofit" ? <AuthInputField id="signup-organization" label="Organization name" icon={Buildings} value={organizationName} onChange={setOrganizationName} autoComplete="organization" placeholder="Neighborhood Food Network" errorId={error ? "signup-error" : undefined} invalid={Boolean(error) && organizationName.trim().length < 2} /> : null}
          <AuthInputField id="signup-name" label={accountType === "nonprofit" ? "Representative name" : "Full name"} icon={UserCircle} value={fullName} onChange={setFullName} autoComplete="name" placeholder="Your name" errorId={error ? "signup-error" : undefined} invalid={Boolean(error) && fullName.trim().length < 2} />
          {accountType === "nonprofit" ? <AuthInputField id="signup-website" label="Organization website (optional)" icon={Buildings} type="url" value={organizationWebsite} onChange={setOrganizationWebsite} autoComplete="url" placeholder="https://example.org" help="You can add verification documents later; do not enter sensitive records here." errorId={error ? "signup-error" : undefined} /> : null}
          <AuthInputField id="signup-email" label={accountType === "nonprofit" ? "Work email" : "Email"} icon={EnvelopeSimple} type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.org" errorId={error ? "signup-error" : undefined} invalid={Boolean(error) && !emailValid} />
          <AuthInputField id="signup-password" label="Password" icon={LockKey} type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" help="Use a unique password you don't reuse elsewhere." errorId={error ? "signup-error" : undefined} invalid={Boolean(error) && password.length < 8} />
          <fieldset className="auth-area-choice"><legend>Approximate area</legend><div>{areas.map((option) => <button type="button" key={option.id} aria-pressed={area === option.id} data-selected={area === option.id ? "true" : "false"} onClick={() => { keyboard.hide(); setArea(option.id); }}>{option.label}</button>)}</div></fieldset>
          <button type="button" className="auth-standards-choice" aria-pressed={accepted} data-selected={accepted ? "true" : "false"} onClick={() => { keyboard.hide(); setAccepted((current) => !current); }}>
            <span className="checkbox">{accepted ? <Check size={14} weight="bold" /> : null}</span>
            <span><strong>I agree to Micro's participation standards</strong><small>Clear scope, respectful communication, no off-platform payment, and no prohibited high-risk work.</small></span>
          </button>
          {error ? <p id="signup-error" className="auth-form-error" role="alert"><Warning size={17} weight="fill" /> {error}</p> : null}
          <button className="primary-button" type="submit" disabled={auth.busy}>{auth.busy ? "Creating account…" : "Create account"}</button>
          <button className="text-button auth-demo-link" type="button" onClick={() => { keyboard.hide(); auth.enterDemo(); }}>Continue with the local demo</button>
        </form>
      </main>
    </MobileScroll>
  );
}

function CheckEmailScreen({ email }: { email: string }) {
  const flow = useFlow();
  const auth = useAuth();
  const [cooldown, setCooldown] = useState(30);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const resend = async () => {
    const result = await auth.resendConfirmation(email);
    setMessage(result.message ?? "");
    setMessageIsError(!result.ok);
    if (result.ok) setCooldown(30);
  };
  return (
    <MobileScroll className="auth-experience auth-scroll">
      <main className="auth-state-screen">
        <section className="auth-state-card">
          <span className="auth-state-icon"><EnvelopeSimple size={31} weight="duotone" /></span>
          <p className="eyebrow">One secure step</p>
          <h1>Confirm your email.</h1>
          <p>We sent a confirmation link to <strong>{email}</strong>. Open it on this device to finish signing in.</p>
          {message ? <p className={messageIsError ? "auth-form-error" : "auth-inline-status"} role={messageIsError ? "alert" : "status"}>{messageIsError ? <Warning size={17} weight="fill" /> : null}{message}</p> : null}
          <button className="secondary-button" disabled={auth.busy || cooldown > 0} onClick={() => void resend()}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend confirmation"}</button>
          <button className="text-button" onClick={() => flow.replace(makeLoginScreen())}>Back to sign in</button>
        </section>
      </main>
    </MobileScroll>
  );
}

function ForgotPasswordScreen() {
  const flow = useFlow();
  const keyboard = useKeyboard();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    keyboard.hide();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email used for your Micro account.");
      return;
    }
    const result = await auth.requestPasswordReset(email);
    if (!result.ok) setError(result.message ?? "We couldn't send the reset email.");
    else flow.replace(makeResetSentScreen(email.trim()));
  };
  return (
    <MobileScroll className="auth-experience auth-scroll">
      <main className="auth-route-page">
        <AuthFormHeading eyebrow="Account recovery" title="Reset your password." copy="Enter your email and we'll send a secure reset link if an account exists." />
        <form className="auth-form" onSubmit={submit} noValidate>
          <AuthInputField id="reset-email" label="Email" icon={EnvelopeSimple} type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.org" errorId={error ? "reset-email-error" : undefined} invalid={Boolean(error)} />
          {error ? <p id="reset-email-error" className="auth-form-error" role="alert"><Warning size={17} weight="fill" /> {error}</p> : null}
          <button className="primary-button" type="submit" disabled={auth.busy}>{auth.busy ? "Sending…" : "Send reset link"}</button>
        </form>
      </main>
    </MobileScroll>
  );
}

function ResetSentScreen({ email }: { email: string }) {
  const flow = useFlow();
  return (
    <MobileScroll className="auth-experience auth-scroll">
      <main className="auth-state-screen">
        <section className="auth-state-card">
          <span className="auth-state-icon"><CheckCircle size={31} weight="duotone" /></span>
          <p className="eyebrow">Email sent</p>
          <h1>Check your inbox.</h1>
          <p>If <strong>{email}</strong> belongs to a Micro account, its reset link is on the way.</p>
          <button className="primary-button" onClick={() => flow.replace(makeLoginScreen())}>Return to sign in</button>
        </section>
      </main>
    </MobileScroll>
  );
}

function UpdatePasswordScreen() {
  const keyboard = useKeyboard();
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    keyboard.hide();
    if (password.length < 8 || password !== confirmation) {
      setError(password !== confirmation ? "The passwords do not match." : "Use at least 8 characters.");
      return;
    }
    const result = await auth.updatePassword(password);
    if (!result.ok) setError(result.message ?? "We couldn't update the password.");
  };
  return (
    <MobileScroll className="auth-experience auth-scroll">
      <main className="auth-route-page auth-standalone-route">
        <button className="auth-standalone-back" aria-label="Sign out" onClick={() => void auth.signOut()}><ArrowLeft size={22} /></button>
        <AuthFormHeading eyebrow="Secure recovery" title="Choose a new password." copy="Use a unique password you don't use for another account." />
        <form className="auth-form" onSubmit={submit} noValidate>
          <AuthInputField id="new-password" label="New password" icon={LockKey} type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" errorId={error ? "new-password-error" : undefined} invalid={Boolean(error) && password.length < 8} />
          <AuthInputField id="confirm-password" label="Confirm password" icon={LockKey} type="password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" placeholder="Repeat your password" errorId={error ? "new-password-error" : undefined} invalid={Boolean(error) && password !== confirmation} />
          {error ? <p id="new-password-error" className="auth-form-error" role="alert"><Warning size={17} weight="fill" /> {error}</p> : null}
          <button className="primary-button" type="submit" disabled={auth.busy}>{auth.busy ? "Updating…" : "Update password"}</button>
        </form>
      </main>
    </MobileScroll>
  );
}

function NonprofitSetupScreen() {
  const keyboard = useKeyboard();
  const auth = useAuth();
  const metadata = auth.session?.user.user_metadata ?? {};
  const [name, setName] = useState(typeof metadata.organization_name === "string" ? metadata.organization_name : "");
  const [website, setWebsite] = useState(typeof metadata.organization_website === "string" ? metadata.organization_website : "");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    keyboard.hide();
    if (name.trim().length < 2) {
      setError("Enter the nonprofit's full name.");
      return;
    }
    const result = await auth.createOrganization(name, website);
    if (!result.ok) setError(result.message ?? "We couldn't create the organization profile.");
  };
  return (
    <MobileScroll className="auth-experience auth-scroll">
      <main className="auth-route-page auth-standalone-route">
        <AuthFormHeading eyebrow="Nonprofit setup" title="Create the organization profile." copy="You can post and accept tasks while verification is pending. Sponsorship tools remain protected." />
        <div className="auth-privacy-card purple"><ShieldCheck size={21} weight="fill" /><span><strong>Verification is reviewed separately.</strong> Creating this profile does not grant sponsor access.</span></div>
        <form className="auth-form" onSubmit={submit} noValidate>
          <AuthInputField id="organization-name" label="Organization name" icon={Buildings} value={name} onChange={setName} autoComplete="organization" placeholder="Neighborhood Food Network" errorId={error ? "organization-error" : undefined} invalid={Boolean(error) && name.trim().length < 2} />
          <AuthInputField id="organization-website" label="Website (optional)" icon={Buildings} type="url" value={website} onChange={setWebsite} autoComplete="url" placeholder="https://example.org" errorId={error ? "organization-error" : undefined} />
          {error ? <p id="organization-error" className="auth-form-error" role="alert"><Warning size={17} weight="fill" /> {error}</p> : null}
          <button className="primary-button" type="submit" disabled={auth.busy}>{auth.busy ? "Creating profile…" : "Create organization profile"}</button>
          <button className="text-button" type="button" onClick={() => void auth.signOut()}>Sign out</button>
        </form>
      </main>
    </MobileScroll>
  );
}

function MicroShell() {
  const { activeTab } = useMicro();
  const keyboard = useKeyboard();
  const { isKeyboardVisible } = useKeyboardInsets();
  const flow = useFlow();
  const isRootActive = flow.current.id === "micro-home";
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    keyboard.hide();
  }, [activeTab]);

  return (
    <main
      className="micro-shell"
      data-testid="micro-app"
      data-keyboard={isKeyboardVisible ? "open" : "closed"}
      aria-label="Micro neighborhood help prototype"
      aria-hidden={isRootActive ? undefined : true}
      inert={isRootActive ? undefined : true}
    >
      <span className="sr-only" role="status" aria-live="polite">{activeTab} tab</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={activeTab}
          className="tab-scene"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {activeTab === "nearby" ? <NearbyScreen /> : null}
          {activeTab === "post" ? <PostScreen /> : null}
          {activeTab === "activity" ? <ActivityScreen /> : null}
          {activeTab === "messages" ? <MessagesScreen /> : null}
          {activeTab === "profile" ? <ProfileScreen /> : null}
        </motion.section>
      </AnimatePresence>
      {!isKeyboardVisible ? <BottomNav /> : null}
    </main>
  );
}

/** Messages from the other side that arrived after you last opened that thread. */
function useUnreadMessageCount() {
  const auth = useAuth();
  const { collaboration, threadReadAt } = useMicro();
  const myId = auth.session?.user.id ?? null;
  return useMemo(() => {
    let total = 0;
    // Keys match the thread list exactly, so the badge and the row agree.
    for (const [assignmentId, messages] of Object.entries(collaboration.messagesByAssignment)) {
      const readAt = threadReadAt[`assignment-${assignmentId}`] ?? 0;
      total += messages.filter((m) => m.kind === "human" && m.senderId !== myId && Date.parse(m.createdAt) > readAt).length;
    }
    return total;
  }, [collaboration.messagesByAssignment, myId, threadReadAt]);
}

function BottomNav() {
  const { activeTab, setActiveTab } = useMicro();
  const unreadMessages = useUnreadMessageCount();
  const keyboard = useKeyboard();
  const reduceMotion = useReducedMotion();
  // Activity lives inside Profile now, so it keeps Profile lit while it is open
  // instead of owning a rail slot of its own.
  const items: Array<{ id: TabId; label: string; icon: Icon }> = [
    { id: "nearby", label: "Nearby", icon: MapPin },
    { id: "post", label: "Post", icon: Plus },
    { id: "messages", label: "Messages", icon: ChatCircle },
    { id: "profile", label: "Profile", icon: UserCircle },
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav-rail">
        {items.map(({ id, label, icon: NavIcon }) => {
          const isActive = activeTab === id || (id === "profile" && activeTab === "activity");
          return (
            <button
              key={id}
              className="nav-item"
              data-active={isActive ? "true" : "false"}
              aria-current={isActive ? "page" : undefined}
              aria-label={id === "messages" && unreadMessages ? `${label}, ${unreadMessages} unread ${unreadMessages === 1 ? "message" : "messages"}` : label}
              onClick={() => {
                keyboard.hide();
                setActiveTab(id);
              }}
              data-testid={`nav-${id}`}
            >
              {isActive ? (
                <motion.span
                  className="nav-active-cushion"
                  layoutId="micro-nav-active-cushion"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 36, mass: 0.65 }}
                  aria-hidden="true"
                />
              ) : null}
              {id === "messages" && unreadMessages ? <span className="nav-unread" aria-hidden="true">{unreadMessages > 9 ? "9+" : unreadMessages}</span> : null}
              <motion.span
                className="nav-icon-wrap"
                animate={{ scale: isActive && !reduceMotion ? 1.06 : 1 }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }}
              >
                <NavIcon size={22} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
              </motion.span>
              <span className="nav-label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Jobs worth pinging a profile about: sponsored work, which is already funded
 * and pays the helper, plus youth-eligible tasks while Youth Mode is active.
 * Deliberately independent of the Nearby filters, so clearing or narrowing a
 * filter never silences the bell. A refused job is out for good: the refusal
 * lives here rather than at each call site so the bell and the notification
 * list can never disagree about what is still worth showing.
 */
function specialJobsFor(pool: Task[], persona: Persona, areaId: AreaId, refusedJobIds: string[], signedInUserId?: string) {
  const area = areaById(areaId);
  return pool.filter((task) =>
    task.ownerPersona !== persona &&
    (!signedInUserId || task.ownerId !== signedInUserId) &&
    !refusedJobIds.includes(task.id) &&
    (areaId === "all" || task.areaId === areaId) &&
    distanceMiles(area.center, task.coords) <= 3 &&
    (task.mode === "sponsored" || (persona === "youth" && Boolean(task.youthEligible))));
}

function NearbyScreen() {
  const flow = useFlow();
  const keyboard = useKeyboard();
  const auth = useAuth();
  const { selectedTaskId, setSelectedTaskId, setActiveTab, ownedTasks, remoteTasks, remoteTasksError, collaboration, sponsorFunded, acceptedTaskIds, closedTaskIds, blockedThreadIds, blockedRequesterNames, moderationHolds, persona, youthAge, guardianLinked, accessTermsAccepted, notificationsEnabled, seenSpecialJobIds, refusedJobIds, setRefusedJobIds, profileAreaId: areaId, setProfileAreaId: setAreaId } = useMicro();
  const activeArea = areaById(areaId);
  const [mapUnavailable, setMapUnavailable] = useState("");
  const mapFailureReported = useRef(false);
  const reportMapUnavailable = useCallback((reason: string) => {
    if (!reason || mapFailureReported.current) return;
    mapFailureReported.current = true;
    setMapUnavailable(reason);
  }, []);
  const [mapExpanded, setMapExpanded] = useState(false);
  // Percentage heights cannot resolve here: the runtime's scroll content is an
  // auto-height grid. Measure the app shell (absolute, inset 0) instead so the
  // expanded map fills whatever device and safe area it is on.
  const mapStageRef = useRef<HTMLElement>(null);
  const [expandedMapHeight, setExpandedMapHeight] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<TaskMode | "all">("all");
  // An empty selection means every category, so the filter reads as "any"
  // until someone picks the specific kinds of work they want.
  const [categories, setCategories] = useState<string[]>([]);
  const [when, setWhen] = useState<"any" | "today" | "weekend">("any");
  // One clock for the screen: it retires listings whose start has passed and
  // drives the countdown on a job you have taken on.
  const [browsedAt, setBrowsedAt] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setBrowsedAt(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const [radius, setRadius] = useState<1 | 3>(3);
  const [youthOnly, setYouthOnly] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<"collapsed" | "half" | "expanded">("half");
  const dragStartY = useRef<number | null>(null);
  const sheetDragHandled = useRef(false);
  const youthParticipationReady = persona !== "youth" || (youthAge >= 15 && guardianLinked && accessTermsAccepted);
  const taskPool = Array.from(new Map([
    ...collaboration.assignments.filter((assignment) => assignment.status === "accepted" && assignment.task).map((assignment) => assignment.task as Task),
    ...remoteTasks,
    ...ownedTasks,
    ...(sponsorFunded ? [sponsoredFixtureTask] : []),
    ...tasks,
  ].map((task) => [task.id, task])).values());
  // A job you have taken on stays here rather than vanishing into Activity, so
  // the commitment is the first thing you see and it is obvious why nothing
  // else can be accepted yet.
  const activeCommitment = taskPool.find((task) => acceptedTaskIds.includes(task.id) && !closedTaskIds.includes(task.id));
  const allTasks = taskPool.filter((task) => !hasExpired(task, browsedAt) && !refusedJobIds.includes(task.id) && !task.listingPaused && !acceptedTaskIds.includes(task.id) && !closedTaskIds.includes(task.id) && !moderationHolds[task.id] && !blockedThreadIds.includes(task.id) && !blockedRequesterNames.includes(getTaskDetails(task).requester) && (persona !== "youth" || task.ownerPersona === persona || (youthParticipationReady && task.youthEligible)));
  const selected = allTasks.find((task) => task.id === selectedTaskId) ?? allTasks[0];
  const visibleTasks = allTasks.filter(
    (task) =>
      (mode === "all" || task.mode === mode) &&
      (!categories.length || (task.category ? categories.includes(task.category) : false)) &&
      (areaId === "all" || task.areaId === areaId) &&
      distanceMiles(activeArea.center, task.coords) <= radius &&
      (when === "any" || (when === "today" ? task.time.startsWith("Today") : Boolean(task.startsAt && (task.startsAt.getDay() === 0 || task.startsAt.getDay() === 6)))) &&
      (!youthOnly || task.youthEligible) &&
      `${task.title} ${task.area}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const primaryVisibleTask = visibleTasks.find((task) => task.id === selected?.id) ?? visibleTasks[0];
  // The bell pings for jobs this profile has not read yet; opening
  // Notifications marks them read, so it goes quiet until a new one appears.
  const unreadSpecialJobs = notificationsEnabled ? specialJobsFor(allTasks, persona, areaId, refusedJobIds, auth.session?.user.id).filter((task) => !seenSpecialJobIds.includes(task.id)) : [];
  const visibleIds = new Set(visibleTasks.map((task) => task.id));
  const activeFilterCount = Number(mode !== "all") + categories.length + Number(when !== "any") + Number(radius !== 3) + Number(youthOnly);
  const browsingTasks = primaryVisibleTask
    ? [primaryVisibleTask, ...allTasks.filter((task) => visibleIds.has(task.id) && task.id !== primaryVisibleTask.id)]
    : allTasks.filter((task) => visibleIds.has(task.id));
  // A job you have taken on is excluded from the browsing list, so it has to be
  // put back on the map by hand — and it is the one pin that gets to be the real
  // address rather than a privacy area, because the match already released it.
  const mapTasks = activeCommitment ? [activeCommitment, ...browsingTasks] : browsingTasks;
  const jobStage = activeCommitment ? jobStageFor(activeCommitment, browsedAt) : undefined;
  const focusedTaskId = jobStage && jobStage !== "scheduled" ? activeCommitment?.id : primaryVisibleTask?.id;

  // Once the start is inside the arrival window the job takes the screen: the
  // sheet opens itself so the address and scope are there without a swipe. It
  // fires on the change of stage, so a sheet you then close stays closed.
  useEffect(() => {
    if (jobStage === "soon" || jobStage === "now") setSheetSnap("expanded");
  }, [jobStage]);

  useEffect(() => {
    if (!mapExpanded) return;
    const shell = mapStageRef.current?.closest(".micro-shell") as HTMLElement | null;
    if (!shell) return;
    const measure = () => setExpandedMapHeight(Math.max(0, shell.clientHeight - 62 - 96));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [mapExpanded]);

  useEffect(() => {
    if (primaryVisibleTask && selectedTaskId !== primaryVisibleTask.id) setSelectedTaskId(primaryVisibleTask.id);
  }, [primaryVisibleTask, selectedTaskId, setSelectedTaskId]);

  // Refusing from a card drops the job out of the list and out of the bell;
  // Filters keeps a restore-all so nothing is hidden irreversibly.
  const refuseJob = (task: Task) => setRefusedJobIds((current) => current.includes(task.id) ? current : [...current, task.id]);

  const openTask = (task: Task) => {
    setSelectedTaskId(task.id);
    keyboard.hide();
    flow.push(makeTaskScreen(task));
  };

  return (
    <>
      <MobileScroll className="app-screen nearby-scroll">
        <div className="nearby-page" data-sheet-snap={sheetSnap} data-map-expanded={mapExpanded ? "true" : "false"}>
          <header className="brand-row">
            <button className="location-button" onClick={() => setLocationOpen(true)}>
              <MapPin size={18} weight="fill" aria-hidden="true" />
              <span>{activeArea.label}</span>
              <CaretDown size={16} weight="bold" aria-hidden="true" />
            </button>
            <button className="notify-quick-button" data-ping={unreadSpecialJobs.length ? "true" : "false"} aria-label={unreadSpecialJobs.length ? `Notifications · ${unreadSpecialJobs.length} new special ${unreadSpecialJobs.length === 1 ? "job" : "jobs"} for you` : "Notifications"} onClick={() => { keyboard.hide(); flow.push(makeNotificationsScreen()); }}>
              <Bell size={24} weight={unreadSpecialJobs.length ? "fill" : "regular"} aria-hidden="true" />
              {unreadSpecialJobs.length ? <span className="notify-ping" data-testid="special-job-ping" aria-hidden="true">{unreadSpecialJobs.length}</span> : null}
            </button>
            <button className="profile-quick-button" aria-label="Open profile" onClick={() => setActiveTab("profile")}><UserCircle size={28} weight="regular" aria-hidden="true" /></button>
          </header>

          <div className="search-row">
            <label className="search-field">
              <MagnifyingGlass size={21} aria-hidden="true" />
              <span className="sr-only">Search tasks or neighborhoods</span>
              <KeyboardInput value={search} onChange={(event) => setSearch(event.target.value)} onBlur={() => keyboard.hide()} placeholder="Search nearby tasks" data-testid="nearby-search" />
            </label>
            <button className="filter-button" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal size={22} aria-hidden="true" />
              <span>Filters</span>
              {activeFilterCount ? <span className="filter-count">{activeFilterCount}</span> : null}
            </button>
          </div>

          {/* The map owns its own drag gesture, so it opts out of parent scroll dragging. */}
          <section className="map-stage" ref={mapStageRef} style={mapExpanded && expandedMapHeight ? { height: expandedMapHeight } : undefined} data-scroll-drag="ignore" data-fallback={!mapsApiKey || mapUnavailable ? "true" : "false"} aria-label={`Approximate task map for ${activeArea.label}`}>
            {mapsApiKey && !mapUnavailable ? (
              <NearbyMap area={activeArea} tasks={mapTasks} activeTaskId={focusedTaskId} exactTaskId={activeCommitment && !activeCommitment.ownerId ? activeCommitment.id : undefined} onSelect={setSelectedTaskId} onUnavailable={reportMapUnavailable} expanded={mapExpanded} onToggleExpanded={() => setMapExpanded((open) => !open)} />
            ) : null}
            {!mapsApiKey || mapUnavailable ? <div className="map-placeholder" aria-hidden="true" /> : null}
            <div className="approximate-note"><Info size={16} weight="bold" aria-hidden="true" />{!mapsApiKey ? "Preview map needs Maps API configuration" : mapUnavailable || `Preview map · approximate ${privacyRadiusMi} mi area`}</div>
          </section>

          <section className="tasks-sheet" aria-labelledby="nearby-heading">
            <button
              className="sheet-grabber-button"
              data-scroll-drag="ignore"
              aria-label={`Task list is ${sheetSnap}. Tap or swipe to resize.`}
              onClick={() => {
                if (sheetDragHandled.current) { sheetDragHandled.current = false; return; }
                setSheetSnap((current) => current === "half" ? "expanded" : current === "expanded" ? "collapsed" : "half");
              }}
              onPointerDown={(event) => { dragStartY.current = event.clientY; sheetDragHandled.current = false; event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerUp={(event) => {
                if (dragStartY.current === null) return;
                const delta = event.clientY - dragStartY.current;
                if (delta < -24) { sheetDragHandled.current = true; setSheetSnap("expanded"); }
                if (delta > 24) { sheetDragHandled.current = true; setSheetSnap("collapsed"); }
                dragStartY.current = null;
              }}
              onPointerCancel={() => { dragStartY.current = null; sheetDragHandled.current = false; }}
            ><span className="sheet-grabber" aria-hidden="true" /></button>
            {activeCommitment ? <ActiveJobPanel task={activeCommitment} now={browsedAt} /> : null}
            <div className="tasks-heading-row"><h1 id="nearby-heading">{activeCommitment ? "Other tasks nearby" : "Nearby tasks"}</h1><span>{visibleTasks.length} nearby</span></div>
            {remoteTasksError ? <div className="test-mode-banner" role="status"><Warning size={19} /><span><strong>Listings could not load:</strong> {remoteTasksError}</span></div> : null}
            {visibleTasks.length && primaryVisibleTask ? (
              <div className="task-list">
                <TaskCard task={primaryVisibleTask} selected blockedReason={activeCommitment ? "Finish your active job first" : undefined} onOpen={openTask} onRefuse={refuseJob} />
                {visibleTasks.filter((task) => task.id !== primaryVisibleTask.id).map((task) => <TaskCard key={task.id} task={task} blockedReason={activeCommitment ? "Finish your active job first" : undefined} onOpen={openTask} onRefuse={refuseJob} />)}
              </div>
            ) : (
              <div className="empty-state"><MagnifyingGlass size={28} aria-hidden="true" /><h2>{youthParticipationReady ? "No close matches yet" : "Youth participation is paused"}</h2><p>{youthParticipationReady ? "Try another neighborhood or clear the active filter." : "Youth Mode begins at 15 and requires active terms plus a linked guardian."}</p>{youthParticipationReady ? <button className="text-button" onClick={() => { setMode("all"); setCategories([]); setWhen("any"); setRadius(3); setYouthOnly(false); setAreaId("all"); setSearch(""); }}>Clear filters</button> : null}</div>
            )}
          </section>
        </div>
      </MobileScroll>

      <BottomSheet open={filtersOpen} onOpenChange={setFiltersOpen} title="Filter nearby help" description="Refine the list by mode, one or more categories, time, distance, or youth eligibility." snap={0.78}>
        <div className="sheet-form">
          <fieldset className="choice-fieldset">
            <legend>Task type</legend>
            {(["all", "paid", "community", "sponsored"] as const).map((value) => <button key={value} className="choice-row" aria-pressed={mode === value} data-selected={mode === value ? "true" : "false"} onClick={() => setMode(value)}><span>{value === "all" ? "All nearby help" : modeMeta[value].label}</span><span className="radio-mark">{mode === value ? <Check size={15} weight="bold" /> : null}</span></button>)}
          </fieldset>
          <fieldset className="choice-fieldset inline-filter-fieldset"><legend>Category{categories.length ? <span className="legend-count">{categories.length} selected</span> : null}</legend><div className="filter-chip-grid">
            <button aria-pressed={!categories.length} data-active={!categories.length ? "true" : "false"} onClick={() => setCategories([])}>Any category</button>
            {catalogCategories.map((entry) => { const picked = categories.includes(entry.label); return <button key={entry.label} aria-pressed={picked} data-active={picked ? "true" : "false"} onClick={() => setCategories((current) => picked ? current.filter((item) => item !== entry.label) : [...current, entry.label])}>{picked ? <Check size={13} weight="bold" aria-hidden="true" /> : null}{entry.label}</button>; })}
          </div></fieldset>
          <fieldset className="choice-fieldset inline-filter-fieldset"><legend>When</legend><div className="segmented-row">{(["any", "today", "weekend"] as const).map((value) => <button key={value} aria-pressed={when === value} data-active={when === value ? "true" : "false"} onClick={() => setWhen(value)}>{value === "any" ? "Any time" : value === "today" ? "Today" : "Weekend"}</button>)}</div></fieldset>
          <fieldset className="choice-fieldset inline-filter-fieldset"><legend>Distance</legend><div className="segmented-row two-segments">{([1, 3] as const).map((value) => <button key={value} aria-pressed={radius === value} data-active={radius === value ? "true" : "false"} onClick={() => setRadius(value)}>Within {value} mi</button>)}</div></fieldset>
          <button className="choice-row" aria-pressed={youthOnly} data-selected={youthOnly ? "true" : "false"} onClick={() => setYouthOnly((current) => !current)}><span><strong>Youth-eligible only</strong><small>Guardian approval is still task-specific</small></span><span className="checkbox">{youthOnly ? <Check size={14} weight="bold" /> : null}</span></button>
          {refusedJobIds.length ? <button className="choice-row" onClick={() => setRefusedJobIds([])}><span><strong>Refused jobs</strong><small>{refusedJobIds.length} hidden from this list and from notifications</small></span><span className="settings-status">Restore all</span></button> : null}
          <div className="info-strip"><MapPin size={18} /> Within about {radius} {radius === 1 ? "mile" : "miles"} of {activeArea.label}</div>
          <button className="primary-button" onClick={() => setFiltersOpen(false)}>Show {visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"}</button>
        </div>
      </BottomSheet>

      <BottomSheet open={locationOpen} onOpenChange={setLocationOpen} title="Choose your area" description="Micro works with approximate neighborhoods. A private address is never placed on the public map." snap={0.48}>
        <div className="sheet-form">{areas.map((option) => <button key={option.id} className="choice-row" aria-pressed={areaId === option.id} data-selected={areaId === option.id ? "true" : "false"} onClick={() => { setAreaId(option.id); setLocationOpen(false); }}><span><strong>{option.label}</strong><small>{option.blurb}</small></span>{areaId === option.id ? <CheckCircle size={22} weight="fill" /> : <ArrowRight size={18} />}</button>)}</div>
      </BottomSheet>
    </>
  );
}

function PersonAvatar({ src, initials, size = "regular", label }: { src?: string; initials: string; size?: "compact" | "regular" | "large" | "pin" | "pin-active"; label?: string }) {
  const iconSize = size === "large" ? 34 : size === "compact" ? 22 : size === "pin-active" ? 29 : 25;
  return <span className="person-avatar" data-size={size} role="img" aria-label={label ?? `${initials} profile`}>
    {src ? <img src={src} alt="" draggable={false} /> : <UserCircle size={iconSize} weight="regular" aria-hidden="true" />}
  </span>;
}

function useTaskDistanceLabel() {
  const { profileAreaId } = useMicro();
  const origin = areaById(profileAreaId).center;
  return (task: Task) => formatDistance(distanceMiles(origin, task.coords));
}

/**
 * Who a listing belongs to, and whether one of yours is currently standing in
 * as a neighbor's. With no second account to post from, that stand-in is the
 * only way to walk the helper side of a task you composed yourself, so it is a
 * prototype affordance and every surface says so.
 */
function useListingOwnership() {
  const { persona, neighborPreviewIds, setNeighborPreviewIds } = useMicro();
  const auth = useAuth();
  const mine = (task: Task) => (task.ownerId ? task.ownerId === auth.session?.user.id : task.ownerPersona === persona);
  // A real listing always keeps its server-authoritative owner controls. The
  // role-switch affordance exists only for local fixtures where there truly is
  // no second account available to test with.
  const canPreview = (task: Task) => mine(task) && !task.ownerId;
  const previewing = (task: Task) => canPreview(task) && neighborPreviewIds.includes(task.id);
  return {
    mine,
    canPreview,
    previewing,
    /** Treated as yours: the requester controls, not the helper ones. */
    isOwned: (task: Task) => mine(task) && !previewing(task),
    toggle: (task: Task) => {
      if (!canPreview(task)) return;
      setNeighborPreviewIds((current) =>
        current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id],
      );
    },
  };
}

function taskAvatar(task: Task, profilePhotos: Record<Persona, string>) {
  const detail = getTaskDetails(task);
  return task.ownerPersona ? profilePhotos[task.ownerPersona] || detail.avatar : detail.avatar;
}

const markerFullSizeZoom = 15;

// Public map shows a general area, never a precise point. The displayed centre
// is deterministically offset from the real coordinate, so the true location is
// not recoverable by reading the marker position.
const privacyRadiusMi = 0.35;

function approximateCoords(task: Task): LatLng {
  let hash = 0;
  for (const char of task.id) hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  const angle = (hash / 100000) * Math.PI * 2;
  const offsetMi = privacyRadiusMi * 0.55;
  return {
    lat: task.coords.lat + (offsetMi / 69) * Math.sin(angle),
    lng: task.coords.lng + (offsetMi / (69 * Math.cos((task.coords.lat * Math.PI) / 180))) * Math.cos(angle),
  };
}

function NearbyMap({ area, tasks, activeTaskId, exactTaskId, onSelect, onUnavailable, expanded, onToggleExpanded }: { area: MicroArea; tasks: Task[]; activeTaskId?: string; exactTaskId?: string; onSelect: (id: string) => void; onUnavailable: (reason: string) => void; expanded: boolean; onToggleExpanded: () => void }) {
  const [zoom, setZoom] = useState(area.zoom);
  const [overlaysReady, setOverlaysReady] = useState(false);
  const markMapReady = useCallback(() => setOverlaysReady(true), []);
  useEffect(() => setZoom(area.zoom), [area]);
  const markerSize = zoom >= markerFullSizeZoom ? "full" : zoom >= markerFullSizeZoom - 2 ? "regular" : "compact";
  return (
    <APIProvider apiKey={mapsApiKey}>
      <MapStatusWatch onUnavailable={onUnavailable} />
      <MapRenderBoundary onUnavailable={onUnavailable}>
        <GoogleMap
          className="nearby-google-map"
          mapId={mapsMapId}
          defaultCenter={area.center}
          defaultZoom={area.zoom}
          minZoom={area.minZoom}
          maxZoom={area.maxZoom}
          restriction={{ latLngBounds: areaBounds(area), strictBounds: true }}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          reuseMaps
          onZoomChanged={(event) => setZoom(event.detail.zoom)}
        >
          {/* The matched job has no privacy area to draw: its exact spot is
              already known to whoever accepted it. */}
          {overlaysReady ? <>
            {tasks.filter((task) => task.id !== exactTaskId).map((task) => (
              <TaskAreaCircle key={`area-${task.id}`} task={task} active={activeTaskId === task.id} />
            ))}
            {tasks.map((task) => (
              <MapTaskPin key={task.id} task={task} active={activeTaskId === task.id} exact={task.id === exactTaskId} size={markerSize} onSelect={onSelect} />
            ))}
          </> : null}
        </GoogleMap>
      </MapRenderBoundary>
      <MapAreaSync area={area} />
      <MapHealthCheck onReady={markMapReady} onUnavailable={onUnavailable} />
      <MapZoomControls area={area} zoom={zoom} expanded={expanded} onToggleExpanded={onToggleExpanded} />
    </APIProvider>
  );
}

class MapRenderBoundary extends Component<{ children: ReactNode; onUnavailable: (reason: string) => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onUnavailable("Map unavailable · check Maps API access settings");
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Surfaces an unusable map (API not enabled, key rejected) instead of leaving an
// empty frame captioned as if it were showing locations.
function MapStatusWatch({ onUnavailable }: { onUnavailable: (reason: string) => void }) {
  const status = useApiLoadingStatus();
  const reported = useRef(false);
  const report = useCallback((reason: string) => {
    if (reported.current) return;
    reported.current = true;
    onUnavailable(reason);
  }, [onUnavailable]);
  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) report("Map unavailable · check Maps API access settings");
    else if (status === APILoadingStatus.FAILED) report("Map could not finish loading · refresh to try again");
  }, [status, report]);

  // Google reports key/API problems through this global rather than the loader
  // status: the script loads fine, the map just never renders.
  useEffect(() => {
    const host = window as unknown as { gm_authFailure?: () => void };
    const previous = host.gm_authFailure;
    const handleAuthFailure = () => {
      report("Map unavailable · allow this preview URL in Maps settings");
    };
    host.gm_authFailure = handleAuthFailure;
    return () => {
      if (host.gm_authFailure === handleAuthFailure) host.gm_authFailure = previous;
    };
  }, [report]);

  return null;
}

// Backstop for the case Google logs an error without invoking gm_authFailure:
// a working map always paints a .gm-style subtree into its container. This
// cannot tell a disabled API from a rejected referrer or an exhausted quota, so
// it must not name a cause — Google prints the real one to the console.
function MapHealthCheck({ onReady, onUnavailable }: { onReady: () => void; onUnavailable: (reason: string) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const painted = () => Boolean(map.getDiv()?.querySelector(".gm-style"));
    // Google can insert `.gm-style` just before reporting an authorization
    // failure. Give that global failure callback a stable grace window before
    // mounting AdvancedMarker; unmounting this check cancels the pending gate.
    let readyTimer: number | undefined;
    const scheduleReady = () => {
      if (readyTimer !== undefined) return;
      readyTimer = window.setTimeout(onReady, 1200);
    };
    if (painted()) scheduleReady();
    const poll = setInterval(() => {
      if (painted()) { clearInterval(poll); scheduleReady(); }
    }, 400);
    const deadline = setTimeout(() => {
      if (!painted()) onUnavailable("Map could not finish loading · refresh to try again");
    }, 8000);
    return () => {
      clearInterval(poll);
      clearTimeout(deadline);
      if (readyTimer !== undefined) clearTimeout(readyTimer);
    };
  }, [map, onReady, onUnavailable]);
  return null;
}

// Choosing a new area reframes the map; panning afterwards is the user's own.
function MapAreaSync({ area }: { area: MicroArea }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.panTo(area.center);
    map.setZoom(area.zoom);
  }, [map, area]);
  return null;
}

// Google's own controls are hidden so zoom matches the phone-frame styling.
function MapZoomControls({ area, zoom, expanded, onToggleExpanded }: { area: MicroArea; zoom: number; expanded: boolean; onToggleExpanded: () => void }) {
  const map = useMap();
  const step = (delta: number) => map?.setZoom((map.getZoom() ?? area.zoom) + delta);
  return (
    <div className="map-zoom-controls" data-zoom={zoom}>
      <button aria-label={expanded ? "Exit full screen map" : "Expand map to full screen"} aria-pressed={expanded} onClick={onToggleExpanded}>
        {expanded ? <CornersIn size={17} weight="bold" aria-hidden="true" /> : <CornersOut size={17} weight="bold" aria-hidden="true" />}
      </button>
      <button aria-label="Zoom in" disabled={zoom >= area.maxZoom} onClick={() => step(1)}><Plus size={17} weight="bold" aria-hidden="true" /></button>
      <button aria-label="Zoom out" disabled={zoom <= area.minZoom} onClick={() => step(-1)}><Minus size={17} weight="bold" aria-hidden="true" /></button>
    </div>
  );
}

function TaskAreaCircle({ task, active }: { task: Task; active: boolean }) {
  const stroke = task.mode === "community" ? "#3276c9" : task.mode === "sponsored" ? "#7546b7" : "#0a887c";
  return (
    <Circle
      center={approximateCoords(task)}
      radius={privacyRadiusMi * 1609.34}
      clickable={false}
      strokeColor={stroke}
      strokeOpacity={active ? 0.85 : 0.4}
      strokeWeight={active ? 2 : 1}
      fillColor={stroke}
      fillOpacity={active ? 0.16 : 0.07}
      zIndex={active ? 2 : 1}
    />
  );
}

function MapTaskPin({ task, active, exact = false, size, onSelect }: { task: Task; active: boolean; exact?: boolean; size: "compact" | "regular" | "full"; onSelect: (id: string) => void }) {
  const { profilePhotos } = useMicro();
  const detail = getTaskDetails(task);
  const labelValue = task.earning ? `$${task.earning}` : "Volunteer";
  return (
    <AdvancedMarker
      position={exact ? task.coords : approximateCoords(task)}
      zIndex={exact ? 9 : active ? 7 : 3}
      anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
      title={`${detail.requester}: ${task.title}`}
      onClick={() => onSelect(task.id)}
    >
      <span
        className="map-marker"
        data-mode={task.mode}
        data-size={size}
        data-active={active ? "true" : "false"}
        data-exact={exact ? "true" : "false"}
        role="button"
        aria-label={exact ? `${detail.requester}: ${task.title}, your accepted job at ${detail.address}` : `${detail.requester}: ${task.title}, ${modeMeta[task.mode].label}`}
      >
        <span className="map-avatar-bubble"><PersonAvatar src={taskAvatar(task, profilePhotos)} initials={detail.initials} size={active ? "pin-active" : "pin"} label={`${detail.requester} profile photo`} /><span className="map-mode-dot" aria-hidden="true" /></span>
        {active || exact ? <span className="map-pin-label"><strong>{exact ? "Your job" : detail.requester.split(" ")[0]}</strong><small>{labelValue}</small></span> : null}
      </span>
    </AdvancedMarker>
  );
}

type JobStage = "scheduled" | "today" | "soon" | "now";

/**
 * How much of your attention an accepted job has earned: booked for another day,
 * happening today, close enough that you should be heading over, or already
 * underway. A job with no resolvable start never escalates, since there is no
 * moment to count down to.
 */
function jobStageFor(task: Task, now: Date): JobStage {
  if (!task.startsAt) return "scheduled";
  const minutes = minutesUntil(now, task.startsAt);
  if (minutes <= 0) return "now";
  if (minutes <= arrivalWindowMinutes) return "soon";
  return startsToday(now, task.startsAt) ? "today" : "scheduled";
}

/**
 * The job you have taken on, pinned above everything else in Nearby. It stays a
 * quiet strip until the start comes within the arrival window, then opens into
 * everything you need to actually turn up: a live countdown, the address the
 * match released, directions out to a maps app, and the scope you agreed to —
 * so nothing about arriving requires digging through another tab.
 */
function ActiveJobPanel({ task, now }: { task: Task; now: Date }) {
  const { setActiveTab, setSelectedTaskId, profilePhotos, refreshRemoteTasks, collaboration } = useMicro();
  const distanceLabel = useTaskDistanceLabel();
  const detail = getTaskDetails(task);
  const protectedAddress = task.ownerId ? task.privateAddress?.trim() : detail.address;
  const stage = jobStageFor(task, now);
  const openJob = () => { setSelectedTaskId(task.id); setActiveTab("activity"); };
  return (
    <article className="active-job" data-stage={stage}>
      <header className="active-job-head">
        <p className="active-job-label"><span className="live-dot" aria-hidden="true" /> {stage === "now" ? "Job underway" : stage === "soon" ? "Job coming up" : stage === "today" ? "Job today" : "Your active job"}</p>
        <p className="active-job-countdown" role={stage === "scheduled" ? undefined : "status"}>{task.startsAt ? countdownLabel(now, task.startsAt) : task.time}</p>
      </header>
      <h2>{task.title}</h2>
      <p className="active-job-meta">{task.time} · {task.duration} · {task.earning ? `$${task.earning} you earn` : "Volunteer"}</p>

      {stage === "scheduled" ? (
        <button className="primary-button" onClick={openJob}>Open job <ArrowRight size={18} /></button>
      ) : (
        <>
          <div className="active-job-person">
            <PersonAvatar src={taskAvatar(task, profilePhotos)} initials={detail.initials} label={`${detail.requester} profile photo`} />
            <span><strong>{detail.requester}</strong><small>{detail.trust}</small></span>
            <button className="active-job-message" aria-label={`Message ${detail.requester}`} onClick={() => setActiveTab("messages")}><ChatCircle size={20} weight="fill" aria-hidden="true" /></button>
          </div>

          {/* The exact address is routable only when the protected row actually
              loaded. An approximate listing coordinate must never be promoted
              to a destination merely because an assignment exists. */}
          {protectedAddress ? <a className="active-job-address" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(protectedAddress)}`} target="_blank" rel="noreferrer">
            <span className="active-job-address-icon"><MapPin size={20} weight="fill" aria-hidden="true" /></span>
            <span><strong>{protectedAddress}</strong><small>{task.area} · {distanceLabel(task)} away · released for this match</small></span>
            <span className="active-job-directions"><NavigationArrow size={17} weight="fill" aria-hidden="true" /> Directions</span>
          </a> : <div className="truth-card" role="alert"><Warning size={22} weight="fill" /><div><strong>Protected address not loaded</strong><span>Do not travel yet. Retry the participant-only task details first.</span><button className="text-button" onClick={() => { void Promise.all([refreshRemoteTasks(), collaboration.refresh()]); }}>Retry protected details</button></div></div>}

          <div className="active-job-scope">
            <p className="mini-label">What you agreed to do</p>
            <ul>{detail.included.map((item) => <li key={item}><Check size={14} weight="bold" aria-hidden="true" />{item}</li>)}</ul>
            <p className="active-job-excluded"><Prohibit size={14} weight="bold" aria-hidden="true" />{detail.excluded}</p>
            {task.completion ? <p className="active-job-done"><SealCheck size={14} weight="fill" aria-hidden="true" />Done when: {task.completion}</p> : null}
          </div>

          <button className="primary-button" onClick={openJob}>{stage === "now" ? "Open job and check in" : "Open job"} <ArrowRight size={18} /></button>
        </>
      )}
    </article>
  );
}

function TaskCard({ task, selected = false, unavailable = false, blockedReason, onOpen, onRefuse }: { task: Task; selected?: boolean; unavailable?: boolean; blockedReason?: string; onOpen: (task: Task) => void; onRefuse?: (task: Task) => void }) {
  const ModeIcon = modeMeta[task.mode].icon;
  const TaskIcon = task.icon;
  const auth = useAuth();
  const distanceLabel = useTaskDistanceLabel();
  const detail = getTaskDetails(task);
  const ownership = useListingOwnership();
  const isOwnedListing = ownership.isOwned(task);
  const isPreviewExample = Boolean(auth.session && !auth.demoMode && !task.ownerId);
  return (
    <article className="task-card" data-selected={selected ? "true" : "false"} data-mode={task.mode} data-unavailable={unavailable ? "true" : "false"}>
      <div className="task-requester-row">
        <span className="task-icon" aria-hidden="true"><TaskIcon size={22} weight="bold" /></span>
        <div><strong>{detail.requester}{task.ownerId ? <span className="live-source-badge">Live</span> : null}</strong><span>{task.area} · {distanceLabel(task)}</span></div>
        <div className="mode-badge"><ModeIcon size={13} weight="fill" /> {modeMeta[task.mode].label}</div>
        {/* Refuse without opening the job: the card leaves the list and stops notifying. */}
        {onRefuse && !isOwnedListing && !unavailable ? <button className="task-refuse-button" aria-label={`Refuse ${task.title}`} onClick={() => onRefuse(task)}><X size={16} weight="bold" aria-hidden="true" /></button> : null}
      </div>
      {isPreviewExample ? <p className="review-flag"><Info size={14} weight="fill" /> Preview example · interactions stay local</p> : null}
      <div className="task-heading-pay">
        <h2>{task.title}</h2>
        {task.earning ? <div className="earning"><strong>${task.earning}</strong><span>You earn</span></div> : <span className="volunteer-label">No payment</span>}
      </div>
      <div className="task-meta-line" aria-label={`${task.time}, ${task.duration}, ${task.mode === "community" ? "volunteer with no payment" : "fair pay"}`}>
        <span>{task.time}</span>
        <span aria-hidden="true">·</span>
        <span>{task.duration}</span>
        <span aria-hidden="true">·</span>
        <strong>{task.mode === "community" ? "Volunteer" : "Fair pay"}</strong>
      </div>
      {blockedReason && !unavailable && !isOwnedListing ? <p className="review-flag blocked-flag"><Warning size={14} weight="fill" /> {blockedReason}</p> : null}
      {selected ? <button className="primary-button task-cta" disabled={unavailable} onClick={() => onOpen(task)}>{unavailable ? "No longer available" : isOwnedListing ? "Manage listing" : "View task"}</button> : (
        <button className="card-link" disabled={unavailable} onClick={() => onOpen(task)}>{unavailable ? "No longer available" : isOwnedListing ? "Manage listing" : "View details"} {!unavailable ? <ArrowRight size={17} /> : null}</button>
      )}
      {/* Prototype only: there is no second account to post from, so a listing
          of your own can stand in as a neighbor's to walk the helper side. */}
      {!unavailable && ownership.canPreview(task) ? (
        <button className="neighbor-preview-toggle" onClick={() => ownership.toggle(task)}>
          {ownership.previewing(task) ? "Stop previewing as a neighbor" : "Accept as a neighbor (prototype only)"}
        </button>
      ) : null}
    </article>
  );
}

function getTaskDetails(task: Task) {
  const details: Record<string, { included: string[]; excluded: string; requester: string; initials: string; avatar: string; address: string; trust: string }> = {
    leaves: { included: ["Rake the front lawn and walkway", "Fill the provided green-waste bags"], excluded: "No ladder, roof, or power-tool work", requester: "Rosa M.", initials: "RM", avatar: "/assets/micro/avatars/rosa-m.png", address: "Near Fruitvale Ave & E 16th St", trust: "Email confirmed · 9 completed · 4.9 from 7 reviews" },
    boxes: { included: ["Carry two sealed lamp boxes", "Place both boxes inside the garage"], excluded: "No stairs, unpacking, or furniture moving", requester: "Devon L.", initials: "DL", avatar: "/assets/micro/avatars/devon-l.png", address: "Near Mandela Pkwy & 14th St", trust: "Email confirmed · 5 completed · 5.0 from 4 reviews" },
    tablet: { included: ["Increase text size and contrast", "Pin the video-call app to the home screen"], excluded: "No passwords, purchases, or account recovery", requester: "June P.", initials: "JP", avatar: "/assets/micro/avatars/june-p.png", address: "Temescal branch library meeting room", trust: "Email confirmed · community member · 5.0 from 3 reviews" },
    pantry: { included: ["Sort shelf-stable groceries", "Pack labeled donation bags with staff present"], excluded: "No driving, heavy lifting, or private-home entry", requester: "San Antonio Pantry", initials: "SP", avatar: "/assets/micro/avatars/mayfair-pantry.png", address: "San Antonio Community Center front desk", trust: "Community partner · public setting" },
    hedge: { included: ["Shape the waist-high front hedge", "Sweep clippings from the walkway"], excluded: "No ladder, chainsaw, or work above shoulder height", requester: "Nina S.", initials: "NS", avatar: "/assets/micro/avatars/nina-s.png", address: "Near College Ave & Alcatraz Ave", trust: "Email confirmed · 7 completed · 4.8 from 6 reviews" },
    stoop: { included: ["Clear the exterior staircase and landing", "Clear the walkway to the sidewalk and spread the provided salt"], excluded: "No roof, balcony, ladder, or vehicle clearing", requester: "Chloé B.", initials: "CB", avatar: "", address: "Near Rue Saint-Denis & Rue Rachel", trust: "Email confirmed · 6 completed · 4.9 from 5 reviews" },
    brunch: { included: ["Unfold tables in the main hall", "Arrange chairs as the organizer directs"], excluded: "No food handling, vehicle use, or lifting over 20 lb", requester: "Mile End Voisins", initials: "MV", avatar: "", address: "Community hall near Avenue du Parc", trust: "Community organizer · public setting" },
    table: { included: ["Unfold two lightweight tables", "Arrange chairs in the public craft room"], excluded: "No vehicle use or lifting over 20 lb", requester: "Alameda Neighbors", initials: "AN", avatar: "/assets/micro/avatars/mayfair-neighbors.png", address: "Alameda community room on Park St", trust: "Community organizer · 12 completed tasks" },
  };
  const detailId = task.id.replace(/-history$/, "");
  return details[detailId] ?? {
    included: task.included ? task.included.split(";").map((item) => item.trim()).filter(Boolean) : [task.description, "Leave the area tidy when the scope is complete"],
    excluded: task.excluded || "No work beyond the posted scope",
    requester: task.requesterName ?? (task.id === "grocery-sponsored" ? "Ana R." : "Alex K."),
    initials: task.requesterInitials ?? (task.id === "grocery-sponsored" ? "AR" : "AK"),
    avatar: task.requesterAvatar ?? (task.id === "grocery-sponsored" ? "/assets/micro/avatars/rosa-m.png" : ""),
    address: task.privateAddress || `Near the shared location in ${task.area}`,
    trust: task.id === "grocery-sponsored" ? "Email confirmed · sponsor-funded request" : "Email confirmed · local prototype profile",
  };
}

function makeTaskScreen(task: Task): FlowScreen {
  return {
    id: `task-${task.id}`,
    headerHeight: 66,
    header: (flow) => <RouteHeader title="Task details" onBack={flow.pop} right={<ShieldCheck size={21} weight="fill" aria-label="Protected task details" />} />,
    render: (flow) => <TaskDetailScreen task={task} onDone={flow.pop} onManage={() => flow.push(makeManageListingScreen(task))} />,
  };
}

function makeManageListingScreen(task: Task): FlowScreen {
  return {
    id: `manage-${task.id}`,
    headerHeight: 66,
    header: (flow) => <RouteHeader title="Manage listing" onBack={flow.pop} />,
    render: (flow) => <ManageListingScreen task={task} onDone={flow.pop} />,
  };
}

/**
 * What a requester can still change about their own listing, and how to take it
 * down. Scope, title, and duration are deliberately absent: those come from the
 * reviewed catalog entry, so changing them means posting a different task
 * rather than quietly rewriting one neighbors may already have read.
 */
function ManageListingScreen({ task, onDone }: { task: Task; onDone: () => void }) {
  const auth = useAuth();
  const { setOwnedTasks, setActiveTab, setSelectedTaskId, refreshRemoteTasks, acceptedTaskIds } = useMicro();
  const keyboard = useKeyboard();
  const now = useMemo(() => new Date(), []);
  const [dateChoice, setDateChoice] = useState(() => task.time.split(" · ")[0] ?? "Tomorrow");
  const [startTime, setStartTime] = useState(() => task.time.split(" · ")[1] ?? "10:00 AM");
  const [amount, setAmount] = useState(String(task.earning ?? 0));
  const [address, setAddress] = useState(task.privateAddress ?? "");
  // What the address was when the screen opened. Compared against rather than
  // `task.privateAddress`, which a remote listing never carries — otherwise
  // simply loading the stored address would register as an edit.
  const [savedAddress, setSavedAddress] = useState(task.privateAddress ?? "");
  const [addressLoaded, setAddressLoaded] = useState(!task.ownerId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const paused = Boolean(task.listingPaused);
  const isRemote = Boolean(task.ownerId);
  const accepted = acceptedTaskIds.includes(task.id);
  const dateChoices = useMemo(() => dateChoicesFor(now), [now]);
  const timeSlots = useMemo(() => (dateChoice === "Today" ? slotsRemainingToday(now) : startTimeSlots), [dateChoice, now]);
  const start = startMoment(now, dateChoice, startTime);
  const timeLabel = start ? startLabel(now, start, startTime) : `${dateChoice} · ${startTime}`;
  const changed = timeLabel !== task.time || Number(amount) !== (task.earning ?? 0) || address !== savedAddress;

  // A listing row never carries the address — it lives in an owner-only table
  // — so editing one has to read it back rather than show an empty field that
  // would look like the address had been lost.
  useEffect(() => {
    if (!task.ownerId || !supabase) return;
    let live = true;
    void supabase
      .from("task_private_details")
      .select("private_address")
      .eq("task_id", task.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        if (data?.private_address) { setAddress(String(data.private_address)); setSavedAddress(String(data.private_address)); }
        setAddressLoaded(true);
      });
    return () => { live = false; };
  }, [task.id, task.ownerId]);

  const applyLocally = (patch: Partial<Task>) =>
    setOwnedTasks((current) => current.map((listing) => (listing.id === task.id ? { ...listing, ...patch } : listing)));

  const save = async () => {
    keyboard.hide();
    setBusy(true);
    setError("");
    const patch: Partial<Task> = { time: timeLabel, startsAt: start, earning: task.mode === "community" ? undefined : Number(amount), privateAddress: address };
    if (isRemote && supabase) {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ time_label: timeLabel, earning: task.mode === "community" ? null : Number(amount) })
        .eq("id", task.id);
      if (updateError) { setBusy(false); setError(updateError.message); return; }
      // The address lives in its own owner-only table, so it is written apart
      // from the listing row and only when it actually changed.
      if (address !== savedAddress) {
        const stored = await supabase.from("task_private_details").update({ private_address: address.trim() }).eq("task_id", task.id);
        if (stored.error) { setBusy(false); setError(stored.error.message); return; }
      }
      await refreshRemoteTasks();
    }
    applyLocally(patch);
    setSavedAddress(address);
    setBusy(false);
    setSaved(true);
  };

  const remove = async () => {
    setBusy(true);
    setError("");
    if (isRemote && supabase) {
      // The private address goes first: a listing row that outlived its address
      // would leave a matched helper with nowhere to go.
      await supabase.from("task_private_details").delete().eq("task_id", task.id);
      const { error: deleteError } = await supabase.from("tasks").delete().eq("id", task.id);
      if (deleteError) { setBusy(false); setError(deleteError.message); return; }
      await refreshRemoteTasks();
    }
    setOwnedTasks((current) => current.filter((listing) => listing.id !== task.id));
    setBusy(false);
    setSelectedTaskId("");
    setActiveTab("nearby");
    onDone();
  };

  return (
    <div className="route-screen">
      <MobileScroll className="app-screen route-scroll">
        <div className="route-page route-bottom-pad">
          <div className="activity-hero"><div className="status-badge">{paused ? <Warning size={14} weight="fill" /> : <CheckCircle size={14} weight="fill" />} {paused ? "Paused" : "Published"}</div><h1>{task.title}</h1><p>{task.area} shown approximately · {task.duration}</p></div>

          {accepted ? <div className="truth-card custom-truth" role="status"><Warning size={22} weight="fill" /><div><strong>Someone has accepted this task</strong><span>Changing the time or pay now would move the goalposts on a helper who already said yes. Use the task thread instead.</span></div></div> : null}

          <section className="form-section manage-section">
            <label className="field-label-block">When
              <div className="segmented-row" data-choices={dateChoices.length}>{dateChoices.map((value) => <button key={value} aria-pressed={dateChoice === value} data-active={dateChoice === value ? "true" : "false"} onClick={() => { keyboard.hide(); setSaved(false); setDateChoice(value); }}>{value}</button>)}</div>
            </label>
            {dateChoice !== "Flexible" ? <Carousel ariaLabel="Start time" className="time-rail" contentClassName="time-rail-track">
              {timeSlots.map((slot) => <button key={slot} className="time-chip" aria-pressed={startTime === slot} data-active={startTime === slot ? "true" : "false"} onClick={() => { keyboard.hide(); setSaved(false); setStartTime(slot); }}>{slot}</button>)}
            </Carousel> : null}
            {task.mode !== "community" ? <label className="field-label-block">Helper receives<div className="money-field"><CurrencyDollar size={21} /><KeyboardInput value={amount} inputMode="numeric" onChange={(event) => { setSaved(false); setAmount(event.target.value.replace(/\D/g, "")); }} onBlur={() => keyboard.hide()} /></div></label> : null}
            <label className="field-label-block">Private match address<KeyboardInput value={address} placeholder={addressLoaded ? "" : "Loading…"} onChange={(event) => { setSaved(false); setAddress(event.target.value); }} onBlur={() => keyboard.hide()} /></label>
            <p className="fine-print">Scope, title, and duration come from the reviewed catalog entry. To change those, post the task you actually need instead.</p>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            {saved ? <div className="status-receipt" role="status"><CheckCircle size={18} weight="fill" /> Listing updated{isRemote ? " for every neighbor" : " in this local session"}.</div> : null}
            <button className="primary-button" disabled={!changed || busy || !addressLoaded || !address.trim()} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
          </section>

          <section className="form-section manage-section">
            <button className="secondary-button" onClick={() => { setSelectedTaskId(task.id); setActiveTab("nearby"); onDone(); }}>See it in Nearby <ArrowRight size={18} /></button>
            <button className="secondary-button" onClick={() => applyLocally({ listingPaused: !paused })}>{paused ? "Resume listing" : "Pause listing"}</button>
            <p className="fine-print">{paused ? "Paused listings stay yours but never appear in Nearby." : "Pausing hides it from Nearby without deleting it."}</p>
          </section>

          {confirmingDelete ? (
            <section className="cancellation-card">
              <strong>Delete this listing?</strong>
              <p>{isRemote ? "It is removed for every neighbor, along with the private address stored with it. This cannot be undone." : "It is removed from this local session. This cannot be undone."}</p>
              <button className="danger-button" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete permanently"}</button>
              <button className="text-button" onClick={() => setConfirmingDelete(false)}>Keep the listing</button>
            </section>
          ) : (
            <button className="quiet-action route-quiet-action" onClick={() => setConfirmingDelete(true)}><Warning size={18} /> Delete this listing</button>
          )}
        </div>
      </MobileScroll>
    </div>
  );
}

function TaskDetailScreen({ task, onDone, onManage }: { task: Task; onDone: () => void; onManage: () => void }) {
  const auth = useAuth();
  const { setActiveTab, setPaidStage, setActiveTask, setCommunityTask, setCommunityStage, setCommunityChecks, acceptedTaskIds, setAcceptedTaskIds, setAcceptedTaskActors, setTaskEvents, setActivityPerspective, persona, youthApprovedTaskId, setYouthApprovedTaskId, setYouthApprovalTaskId, setGuardianSupervisedTaskId, setGuardianSupervisionStatus, accessTermsAccepted, guardianLinked, youthAge, blockedRequesterNames, savedTaskIds, setSavedTaskIds, reportedTaskIds, setReportedTaskIds, setReportReasons, moderationHolds, setModerationHolds, refusedJobIds, setRefusedJobIds } = useMicro();
  const { collaboration } = useMicro();
  const distanceLabel = useTaskDistanceLabel();
  const [phase, setPhase] = useState<"detail" | "review" | "approval" | "accepted">("detail");
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [matchedAddress, setMatchedAddress] = useState("");
  const [protectedDetailsError, setProtectedDetailsError] = useState("");
  const TaskIcon = task.icon;
  const ModeIcon = modeMeta[task.mode].icon;
  const detail = getTaskDetails(task);
  const requesterBlocked = blockedRequesterNames.includes(detail.requester);
  const hasOtherCommitment = acceptedTaskIds.some((id) => id !== task.id)
    || collaboration.assignments.some((assignment) => assignment.status === "accepted" && assignment.helperId === auth.session?.user.id && assignment.taskId !== task.id);
  const isSaved = savedTaskIds.includes(task.id);
  const listingReported = reportedTaskIds.includes(task.id) || Boolean(moderationHolds[task.id]);
  const isRefused = refusedJobIds.includes(task.id);
  const ownership = useListingOwnership();
  const isOwnedListing = ownership.isOwned(task);
  const youthBlocked = persona === "youth" && (!task.youthEligible || youthAge < 15 || !guardianLinked || !accessTermsAccepted);
  const needsApproval = persona === "youth" && task.youthEligible && youthApprovedTaskId !== task.id;
  const isPreviewExample = Boolean(auth.session && !auth.demoMode && !task.ownerId);
  const accountCanAccept = auth.demoMode || (Boolean(task.ownerId) && auth.capabilities.can_accept_tasks);

  const commitAcceptedTask = (acceptedTask: Task) => {
    setAcceptedTaskIds((current) => current.includes(acceptedTask.id) ? current : [...current, acceptedTask.id]);
    setAcceptedTaskActors((current) => ({ ...current, [acceptedTask.id]: persona === "youth" ? "youth" : "adult" }));
    if (persona === "youth") {
      setGuardianSupervisedTaskId(acceptedTask.id);
      setGuardianSupervisionStatus(`Sam accepted ${acceptedTask.title}. The task is ready for the agreed start window.`);
      setYouthApprovedTaskId(null);
    }
    appendTaskEvent(setTaskEvents, acceptedTask.id, `${acceptedTask.mode === "community" ? "Volunteer commitment" : "Assignment"} confirmed${acceptedTask.ownerId ? " in Micro" : " in preview"}.`);
    appendTaskEvent(setTaskEvents, acceptedTask.id, acceptedTask.mode === "community" ? "Protected task details released — no payment." : acceptedTask.ownerId ? "Protected task details released. Payment service is not connected." : "Payment secured in test mode and protected address access released.");
    setActivityPerspective("helper");
    if (acceptedTask.mode === "community") {
      setCommunityTask(acceptedTask);
      setCommunityStage("Committed");
      setCommunityChecks([false, false]);
    }
    else {
      setActiveTask(acceptedTask);
      setPaidStage("Payment secured");
    }
    setPhase("accepted");
  };

  const loadMatchedAddress = async (): Promise<string | null> => {
    if (!supabase || !task.ownerId) return null;
    const { data, error } = await supabase
      .from("task_private_details")
      .select("private_address")
      .eq("task_id", task.id)
      .maybeSingle();
    if (error || !data?.private_address) {
      setProtectedDetailsError("The match is recorded, but the protected address did not load. Do not travel until it appears.");
      return null;
    }
    const address = String(data.private_address);
    setMatchedAddress(address);
    setProtectedDetailsError("");
    return address;
  };

  const accept = async () => {
    if (isOwnedListing || !accountCanAccept || accepting) return;
    if (needsApproval) {
      setYouthApprovalTaskId(task.id);
      setPhase("approval");
      return;
    }
    if (!task.ownerId) {
      commitAcceptedTask(task);
      return;
    }
    setAccepting(true);
    setAcceptError(null);
    const result = await collaboration.acceptTask(task.id);
    if (!result.ok) {
      setAcceptError(result.message ?? "Micro couldn't accept that task.");
      setAccepting(false);
      return;
    }
    let acceptedTask = task;
    const address = await loadMatchedAddress();
    if (address) acceptedTask = { ...task, privateAddress: address };
    commitAcceptedTask(acceptedTask);
    setAccepting(false);
  };

  return (
    <div className="route-screen">
      <MobileScroll className="app-screen route-scroll">
        <div className="route-page with-actionbar">
          {/* Standing in front of your own listing must never be mistakable for
              a real match, so it is said plainly wherever the listing appears. */}
          {ownership.previewing(task) ? (
            <div className="truth-card custom-truth" role="status">
              <Warning size={22} weight="fill" />
              <div><strong>Previewing your own listing as a neighbor</strong><span>Prototype only — this stands in for a second account so you can walk the helper side. <button className="text-button" onClick={() => ownership.toggle(task)}>Stop previewing</button></span></div>
            </div>
          ) : null}
          {phase === "accepted" ? (
            <section className="success-view" role="status" aria-live="polite">
              <span className="success-seal"><CheckCircle size={46} weight="fill" /></span>
              <p className="eyebrow">Protected match made</p>
              <h1>You’re helping with<br />{task.title.toLowerCase()}.</h1>
              <p>It is pinned at the top of Nearby as your active job, the steps are in Activity, and a private task thread is ready.</p>
              <div className="truth-card">
                <ShieldCheck size={22} weight="fill" />
                <div><strong>{task.mode === "community" ? "Volunteer commitment recorded" : task.ownerId ? "Match recorded · payment not connected" : "Payment secured — test mode"}</strong><span>{task.mode === "community" ? "No payment is offered for this task." : task.ownerId ? "The live match and messages are stored; no charge or payout service exists yet." : "No real money moves in this prototype."}</span></div>
              </div>
              {task.ownerId ? matchedAddress ? <div className="address-card"><span className="mini-label">Shared after match</span><strong>{matchedAddress}</strong><p>Supabase released this address only to the matched requester and helper.</p></div> : <div className="truth-card" role="alert"><Warning size={22} weight="fill" /><div><strong>Protected address not loaded</strong><span>{protectedDetailsError || "Do not travel until Micro loads the exact address."}</span><button className="text-button" onClick={() => { void loadMatchedAddress(); }}>Retry protected details</button></div></div> : <div className="address-card"><span className="mini-label">Shared after match</span><strong>{detail.address}</strong><p>This preview address is released only after the local match state.</p></div>}
            </section>
          ) : phase === "approval" ? (
            <section className="success-view" role="status" aria-live="polite">
              <span className="success-seal purple"><ShieldCheck size={44} weight="fill" /></span>
              <p className="eyebrow">Sent to Maya K.</p>
              <h1>Guardian review requested.</h1>
              <p>This task is not accepted yet. Maya can approve or decline this exact scope and time from Youth Mode.</p>
              <div className="truth-card"><Info size={22} /><div><strong>No blanket permission</strong><span>A guardian decision applies only to this task.</span></div></div>
            </section>
          ) : phase === "review" ? (
            <section className="review-view">
              <p className="eyebrow">Commitment review</p>
              <h1>Know the task before you say yes.</h1>
              <div className="notice-card sponsored-notice">
                <ModeIcon size={24} weight="fill" />
                <div><strong>{modeMeta[task.mode].label}</strong><span>{task.mode === "sponsored" ? "A sponsor pays. The recipient total is $0." : task.mode === "community" ? "Volunteer — no payment is offered for this task." : `Helper receives $${task.earning}.`}</span></div>
              </div>
              <div className="review-list">
                <ReviewRow icon={ListChecks} title="Clear scope" text={task.description} />
                <ReviewRow icon={CalendarBlank} title="Time commitment" text={`${task.time} · ${task.duration}`} />
                <ReviewRow icon={MapPin} title="Public location" text={`${task.area}, about ${distanceLabel(task)} away. The public map shows only a ${privacyRadiusMi}-mile area, never the exact spot. The address is shared after this protected match.`} />
                <ReviewRow icon={ShieldCheck} title="Safety check" text="Use task messages, bring no extra tools, and report changes before starting." />
              </div>
              <p className="fine-print">By accepting, you agree to arrive within the agreed window and keep communication in Micro.</p>
            </section>
          ) : (
            <>
              <section className="detail-hero" data-mode={task.mode}>
                <span className="detail-icon"><TaskIcon size={31} weight="bold" /></span>
                <div className="mode-badge"><ModeIcon size={14} weight="fill" /> {modeMeta[task.mode].label}</div>
                <h1>{task.title}</h1>
                <p>{task.description}</p>
                {task.earning ? <div className="hero-earning"><strong>${task.earning}</strong><span>helper receives</span></div> : null}
              </section>
              {isPreviewExample ? <div className="persona-scope-note" role="status"><Info size={18} weight="fill" /><span><strong>Preview example</strong> You can inspect this sample, but signed-in accounts can only accept real listings from neighbors.</span></div> : null}
              <section className="detail-section">
                <h2>At a glance</h2>
                <div className="glance-grid">
                  <FactTile icon={Tag} label="Category" value={task.category ?? "Neighborhood help"} />
                  <FactTile icon={MapPin} label="Area" value={`${task.area} · ${distanceLabel(task)}`} />
                  <FactTile icon={CalendarBlank} label="When" value={task.time} />
                  <FactTile icon={Clock} label="Time needed" value={task.duration} />
                  <FactTile icon={ShieldCheck} label="Task setup" value="Clear scope" />
                </div>
              </section>
              {task.photo ? <figure className="task-photo"><img src={task.photo} alt="Privacy-safe task preview showing the work area and provided materials" /><figcaption>Task photo · exact address details excluded</figcaption></figure> : <div className="photo-missing"><Info size={19} /><span><strong>No task photo provided</strong> Scope and completion criteria remain required.</span></div>}
              <section className="detail-section paper-section">
                <h2>What’s included</h2>
                <ul className="check-list">
                  {detail.included.map((item) => <li key={item}><CheckCircle size={19} weight="fill" /> {item}</li>)}
                  <li><X size={19} weight="bold" /> {detail.excluded}</li>
                </ul>
                {task.completion ? <div className="completion-definition"><CheckCircle size={19} weight="fill" /><div><strong>Completion means</strong><span>{task.completion}</span></div></div> : null}
              </section>
              <section className="profile-preview">
                <span className="avatar large" aria-hidden="true">{detail.initials}</span>
                <div><span className="mini-label">Posted by</span><strong>{detail.requester}</strong><p>{detail.trust} · joined May 2026</p></div>
              </section>
              {task.mode !== "community" && task.earning ? <section className="detail-pay-card"><div><span>Helper receives</span><strong>${task.earning}</strong></div><div><span>Hourly equivalent</span><strong>~${Math.round((task.earning * 60) / Number(task.duration.match(/\d+/)?.[0] || 60))}/hr</strong></div><div><span>Funder total</span><strong>${task.earning + Math.max(2, Math.round(task.earning * 0.05)) + Math.max(1, Math.round(task.earning * 0.03))}</strong></div><p><ShieldCheck size={17} weight="fill" /> {task.ownerId ? "Live matching is available, but payment authorization and payouts are not connected yet." : "Payment is simulated after this preview match; no real money moves."}</p></section> : null}
              <div className="detail-secondary-actions"><button className="secondary-button" aria-pressed={isSaved} onClick={() => setSavedTaskIds((current) => isSaved ? current.filter((id) => id !== task.id) : [...current, task.id])}><Tag size={18} weight={isSaved ? "fill" : "regular"} /> {isSaved ? "Saved" : "Save task"}</button><button className="secondary-button danger-copy" disabled={listingReported} onClick={() => { const reason = "Standard priority · listing scope or safety concern · no evidence attached"; setReportedTaskIds((current) => current.includes(task.id) ? current : [...current, task.id]); setReportReasons((current) => ({ ...current, [task.id]: reason })); setModerationHolds((current) => ({ ...current, [task.id]: "Task actions are paused for support review." })); appendTaskEvent(setTaskEvents, task.id, "Listing report recorded; matching paused for support review."); }}><Warning size={18} /> {listingReported ? "In support review" : "Report listing"}</button></div>
              {listingReported ? <div className="status-receipt" role="status"><CheckCircle size={18} weight="fill" /> Listing review recorded locally. Matching is paused pending support-authority review.</div> : null}
              <div className="privacy-note"><Info size={19} /><span><strong>Approximate by design.</strong> Neighbours see a {privacyRadiusMi}-mile area, not a pin on your door. The exact address is shared only after a protected match.</span></div>
            </>
          )}
        </div>
      </MobileScroll>
      <div className="route-actionbar">
        {/* The refusal sits beside the accept button so the two answers to a job
           are offered in the same place. */}
        {phase === "detail" ? isOwnedListing ? <div className="actionbar-stack"><button className="primary-button" onClick={() => { setActiveTab("activity"); onDone(); }}>Manage listing in Activity <ArrowRight size={19} /></button>{ownership.canPreview(task) ? <button className="neighbor-preview-toggle" onClick={() => ownership.toggle(task)}>Accept as a neighbor (prototype only)</button> : null}</div> : <div className="actionbar-row"><button className="refuse-square-button" aria-pressed={isRefused} aria-label={isRefused ? "Notify me about this job again" : "Refuse this job"} onClick={() => { if (isRefused) { setRefusedJobIds((current) => current.filter((id) => id !== task.id)); return; } setRefusedJobIds((current) => current.includes(task.id) ? current : [...current, task.id]); onDone(); }}>{isRefused ? <Bell size={22} weight="fill" aria-hidden="true" /> : <X size={22} weight="bold" aria-hidden="true" />}</button><button className="primary-button" disabled={!accountCanAccept || hasOtherCommitment || requesterBlocked || youthBlocked || !accessTermsAccepted || persona === "guardian" || listingReported} onClick={() => setPhase("review")}>{isPreviewExample ? "Preview example only" : !accountCanAccept ? "Account cannot accept tasks" : listingReported ? "Listing is in review" : persona === "guardian" ? "Guardian view cannot accept tasks" : hasOtherCommitment ? "Finish your active commitment first" : requesterBlocked ? "Blocked from this requester" : !accessTermsAccepted ? "Accept terms to participate" : persona === "youth" && youthAge < 15 ? "Youth Mode is for ages 15–17" : persona === "youth" && !guardianLinked ? "Link a guardian first" : youthBlocked ? "Unavailable in Youth Mode" : task.mode === "community" ? "Volunteer for this" : "I can help"}</button></div> : null}
        {phase === "review" ? <div className="actionbar-stack">{acceptError ? <p className="form-error" role="alert">{acceptError}</p> : null}<button className="primary-button" disabled={!accountCanAccept || hasOtherCommitment || accepting} onClick={() => { void accept(); }}>{!accountCanAccept ? "Account cannot accept tasks" : hasOtherCommitment ? "Another commitment is active" : accepting ? "Recording your acceptance…" : needsApproval ? "Request guardian approval" : "Accept this task"}</button></div> : null}
        {phase === "approval" ? <button className="primary-button" onClick={() => { setActiveTab("profile"); onDone(); }}>Open Youth Mode <ArrowRight size={19} /></button> : null}
        {phase === "accepted" ? <button className="primary-button" onClick={() => { setActiveTab("activity"); onDone(); }}>Go to Activity <ArrowRight size={19} /></button> : null}
      </div>
    </div>
  );
}

function PostScreen() {
  const keyboard = useKeyboard();
  const auth = useAuth();
  const { setPostedTask, setOwnedTasks, setSelectedTaskId, setActiveTab, postDraft, setPostDraft, accessTermsAccepted, persona, youthAge, guardianLinked, profileAreaId, profilePhotos, ownedTasks, refreshRemoteTasks } = useMicro();
  const [step, setStep] = useState(0);
  const [published, setPublished] = useState(false);
  // Step 3 reviews the full listing, so the scope rows start folded here.
  const [scopeOpen, setScopeOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  // This survives an uncertain transport or authoritative re-read failure, so
  // retrying the same draft returns the original server row instead of posting
  // a duplicate. It rotates only after that row is confirmed or a new draft is
  // deliberately started.
  const publishNonceRef = useRef(crypto.randomUUID());
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const selectedTimeRef = useRef<HTMLButtonElement>(null);
  const [composingCustom, setComposingCustom] = useState(false);
  const { mode, templateId, selections, customTitle, customDetails, customCategoryId, customMinutes, customCompletionId, dateChoice, startTime, privateAddress, coords, amount, photoAcknowledged, photoPreview, riskConfirmed, safetyConfirmed } = postDraft;
  // A shared location names its own neighborhood; without one the listing falls
  // back to the approximate area set in Profile.
  const listingArea = (coords && areaForPoint(coords)) ?? areaById(profileAreaId);
  const profileArea = listingArea.label;
  function setField<K extends keyof PostDraft>(key: K, value: SetStateAction<PostDraft[K]>) {
    setPostDraft((current) => ({ ...current, [key]: typeof value === "function" ? (value as (previous: PostDraft[K]) => PostDraft[K])(current[key]) : value }));
  }

  const customInput = { title: customTitle, details: customDetails, categoryId: customCategoryId, minutes: customMinutes, completionId: customCompletionId };
  const customTemplate = useMemo(() => buildCustomTemplate(customInput), [customCategoryId, customCompletionId, customDetails, customMinutes, customTitle]);
  const template = templateId === CUSTOM_TEMPLATE_ID ? customTemplate : (templateById(templateId) ?? taskTemplates[0]);
  const customProblem = customTextProblem(customTitle, customDetails);
  // Every published word comes from here: the requester picks a catalog task and
  // answers its bounded options, and the listing is composed from that.
  const listing = useMemo(() => composeListing(template, selections), [selections, template]);
  const openCategory = openCategoryId ? categoryById(openCategoryId) : undefined;
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of taskTemplates) counts[entry.categoryId] = (counts[entry.categoryId] ?? 0) + 1;
    return counts;
  }, []);
  const mostRequested = useMemo(() => [...taskTemplates].sort((a, b) => b.popularity - a.popularity).slice(0, 6), []);
  const categoryTasks = useMemo(() => taskTemplates.filter((entry) => entry.categoryId === openCategoryId).sort((a, b) => b.popularity - a.popularity), [openCategoryId]);
  const searchResults = useMemo(() => (catalogQuery.trim() ? searchTemplates([...taskTemplates].sort((a, b) => b.popularity - a.popularity), catalogQuery) : []), [catalogQuery]);
  // The task decides which arrangements are honest for it: a food-pantry shift is
  // never a paid job, and a paid yard task is never billed to a sponsor by default.
  const availableModes = template.modes as TaskMode[];

  const setMode = (value: TaskMode) => setField("mode", value);
  const selectTemplate = (next: TaskTemplate) => {
    keyboard.hide();
    const nextSelections = defaultSelections(next);
    setComposingCustom(false);
    setPostDraft((current) => ({
      ...current,
      templateId: next.id,
      selections: nextSelections,
      mode: next.modes.includes(current.mode) ? current.mode : (next.modes[0] as TaskMode),
      amount: String(composeListing(next, nextSelections).suggestedPay),
      riskConfirmed: false,
    }));
    setStep(1);
  };
  const useCustomTask = () => {
    if (customProblem) return;
    keyboard.hide();
    setPostDraft((current) => ({
      ...current,
      templateId: CUSTOM_TEMPLATE_ID,
      selections: {},
      mode: "paid",
      amount: String(composeListing(buildCustomTemplate(customInput), {}).suggestedPay),
      riskConfirmed: false,
    }));
    setComposingCustom(false);
    setStep(1);
  };
  const setChoice = (optionId: string, choiceId: string) => {
    keyboard.hide();
    setPostDraft((current) => {
      const nextSelections = { ...current.selections, [optionId]: choiceId };
      return { ...current, selections: nextSelections, amount: String(composeListing(template, nextSelections).suggestedPay) };
    });
  };
  const setDateChoice = (value: string) => { keyboard.hide(); setField("dateChoice", value); };
  const setStartTime = (value: string) => { keyboard.hide(); setField("startTime", value); };
  const setPrivateAddress = (value: string) => setField("privateAddress", value);
  const setAmount = (value: string) => setField("amount", value);
  const setPhotoAcknowledged = (value: SetStateAction<boolean>) => setField("photoAcknowledged", value);
  const setPhotoPreview = (value: string) => setPostDraft((current) => ({ ...current, photoPreview: value, photoAcknowledged: false }));
  const setRiskConfirmed = (value: SetStateAction<boolean>) => setField("riskConfirmed", value);
  const setSafetyConfirmed = (value: SetStateAction<boolean>) => setField("safetyConfirmed", value);
  const numericAmount = Number(amount || 0);
  const platformFee = mode === "community" ? 0 : Math.max(2, Math.round(numericAmount * 0.05));
  const processingFee = mode === "community" ? 0 : Math.max(1, Math.round(numericAmount * 0.03));
  const hourlyEquivalent = Math.round((numericAmount * 60) / listing.minutes);
  // Recomputed on step change so the clock cannot go stale mid-draft.
  const now = useMemo(() => new Date(), [step]);
  const dateChoices = useMemo(() => dateChoicesFor(now), [now]);
  const timeSlots = useMemo(() => (dateChoice === "Today" ? slotsRemainingToday(now) : startTimeSlots), [dateChoice, now]);
  const accountCanPost = auth.demoMode || auth.capabilities.can_post_tasks;
  const participationReady = accountCanPost && accessTermsAccepted && (persona !== "youth" || (youthAge >= 15 && guardianLinked));
  const sponsoredPostingAllowed = auth.demoMode || auth.canSponsor;
  const draftChanged = JSON.stringify(postDraft) !== JSON.stringify(initialPostDraft);
  const scopeValid = riskConfirmed && (!photoPreview || photoAcknowledged);
  // Named one by one, because a message that repeats requirements already met
  // sends people hunting for a field that is in fact filled in.
  const logisticsProblems = [
    !timeSlots.includes(startTime) ? "pick a start time" : "",
    !privateAddress.trim() ? "add your private match address" : "",
    mode !== "community" && numericAmount < 15 ? "set a helper amount of at least $15" : "",
    !safetyConfirmed ? "confirm the safety and cancellation terms" : "",
    !participationReady ? "restore participation access in Profile" : "",
    mode === "sponsored" && !sponsoredPostingAllowed ? "finish nonprofit verification to publish a sponsored task" : "",
  ].filter(Boolean);
  const logisticsValid = logisticsProblems.length === 0;
  const goStep = (next: number) => { keyboard.hide(); setStep(next); };
  const backToCatalog = () => {
    keyboard.hide();
    if (template.isCustom) { setComposingCustom(true); } else { setOpenCategoryId(template.categoryId); }
    setStep(0);
  };

  useEffect(() => {
    if (step === 0 || published) return;
    requestAnimationFrame(() => {
      stepHeadingRef.current?.focus();
      stepHeadingRef.current?.scrollIntoView({ block: "start" });
    });
  }, [published, step]);

  // A draft can outlive the day it was written on, and Today loses slots as the
  // afternoon wears on, so pull both fields back into the current options.
  useEffect(() => {
    if (!dateChoices.includes(dateChoice)) setField("dateChoice", "Tomorrow");
    else if (timeSlots.length && !timeSlots.includes(startTime)) setField("startTime", timeSlots[0]);
  }, [dateChoice, dateChoices, startTime, timeSlots]);

  // The rail holds a full day of slots, so bring the chosen one into view rather
  // than leaving the requester looking at 7:00 AM.
  useEffect(() => {
    if (step !== 2) return;
    requestAnimationFrame(() => selectedTimeRef.current?.scrollIntoView({ block: "nearest", inline: "center" }));
  }, [step]);

  const publish = () => {
    if (!scopeValid || !logisticsValid) return;
    const listingStart = startMoment(now, dateChoice, startTime);
    const created: Task = {
      id: `posted-${Date.now()}`,
      title: listing.title,
      description: listing.details,
      mode,
      earning: mode === "community" ? undefined : numericAmount,
      // A shared location is the real spot. Without one the listing is placed
      // near the area centre, which is a stand-in, not a claim about where the
      // task is. Either way the public map only ever draws the blurred area.
      coords: coords ?? {
        lat: listingArea.center.lat + Math.sin(ownedTasks.length * 2.4) * 0.004,
        lng: listingArea.center.lng + Math.cos(ownedTasks.length * 2.4) * 0.004,
      },
      areaId: listingArea.id,
      area: profileArea,
      // Label and moment come from the same resolution, so a listing can never
      // read "Today" while counting down to a different day.
      time: listingStart ? startLabel(now, listingStart, startTime) : `${dateChoice} · ${startTime}`,
      startsAt: listingStart,
      duration: listing.duration,
      icon: template.icon,
      category: template.category,
      included: listing.included,
      excluded: listing.excluded,
      completion: listing.completion,
      privateAddress,
      photo: photoPreview || undefined,
      requesterName: auth.profile?.display_name || (persona === "youth" ? "Sam K." : persona === "guardian" ? "Maya K." : "Alex K."),
      requesterInitials: auth.profile ? initialsFromName(auth.profile.display_name) : persona === "youth" ? "SK" : persona === "guardian" ? "MK" : "AK",
      requesterAvatar: profilePhotos[persona] || undefined,
      ownerPersona: persona,
      youthEligible: template.youthEligible,
      customPending: template.isCustom || undefined,
    };
    keyboard.hide();
    if (!supabase || auth.demoMode || !auth.session) {
      // Demo mode has no account to attribute a listing to, so it stays local
      // and is honest about that on the confirmation screen.
      setPostedTask(created);
      setOwnedTasks((current) => [created, ...current]);
      setSelectedTaskId(created.id);
      setPublished(true);
      return;
    }
    void publishToSupabase(created);
  };

  const publishToSupabase = async (created: Task) => {
    setPublishing(true);
    setPublishError(null);
    const { data, error } = await supabase!
      .rpc("publish_task", {
        p_client_nonce: publishNonceRef.current,
        p_template_id: template.isCustom ? null : template.id,
        p_selections: template.isCustom ? {} : selections,
        p_mode: created.mode,
        p_earning: created.mode === "community" ? null : created.earning,
        p_starts_at: created.startsAt?.toISOString() ?? null,
        p_private_address: privateAddress.trim(),
        p_custom_title: template.isCustom ? customTitle.trim() : null,
        p_custom_description: template.isCustom ? customDetails.trim() : null,
        p_custom_category_id: template.isCustom ? customCategoryId : null,
        p_custom_minutes: template.isCustom ? customMinutes : null,
        p_custom_completion_id: template.isCustom ? customCompletionId : null,
      });
    if (error || !data) {
      setPublishing(false);
      setPublishError(error?.message ?? "The listing could not be saved.");
      return;
    }
    const taskId = String(data);
    const stored = await supabase!
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();
    if (stored.error || !stored.data) {
      setPublishing(false);
      setPublishError("The listing was saved, but Micro could not reload its authoritative details. Refresh Activity before trying to post again.");
      return;
    }
    await refreshRemoteTasks();
    const authoritativeTask = taskFromRow({ ...stored.data, requester_name: auth.profile?.display_name });
    authoritativeTask.privateAddress = privateAddress.trim();
    authoritativeTask.requesterAvatar = profilePhotos[persona] || undefined;
    setPostedTask(authoritativeTask);
    setSelectedTaskId(taskId);
    publishNonceRef.current = crypto.randomUUID();
    setPublishing(false);
    setPublished(true);
  };

  const taskRow = (entry: TaskTemplate) => {
    const RowIcon = entry.icon;
    const pay = entry.modes.includes("paid") ? `typically $${Math.max(15, entry.pay)}` : entry.modes.includes("sponsored") ? "volunteer or sponsored" : "volunteer";
    return (
      <button key={entry.id} className="catalog-row" data-selected={entry.id === templateId ? "true" : "false"} onClick={() => selectTemplate(entry)}>
        <span className="catalog-row-icon"><RowIcon size={21} weight="duotone" /></span>
        <span className="catalog-row-body">
          <strong>{entry.title}</strong>
          <small>about {entry.minutes} min · {pay}</small>
        </span>
        {entry.youthEligible ? <span className="catalog-row-flag">Youth OK</span> : null}
        <ArrowRight size={16} weight="bold" />
      </button>
    );
  };

  if (!participationReady) {
    return <MobileScroll className="app-screen tab-scroll"><div className="standard-page nav-padded"><PageTitle eyebrow="Participation check" title="Posting is paused." subtitle="Micro keeps the draft safe while participation requirements are incomplete." /><div className="empty-state participation-gate"><ShieldCheck size={36} weight="duotone" /><h2>{!accountCanPost ? "This account cannot post tasks." : persona === "youth" && youthAge < 15 ? "Youth Mode begins at age 15." : persona === "youth" && !guardianLinked ? "Link a guardian first." : "Accept the test terms first."}</h2><p>{!accountCanPost ? "Reload the protected account permissions or contact support before posting." : "Update the local age, terms, or guardian fixture in Profile. No draft fields were discarded."}</p><button className="primary-button" onClick={() => setActiveTab("profile")}>Open Profile</button></div></div></MobileScroll>;
  }

  if (published) {
    return (
      <MobileScroll className="app-screen tab-scroll">
        <div className="standard-page nav-padded">
          <section className="success-view post-success" role="status" aria-live="polite">
            <span className="success-seal"><CheckCircle size={46} weight="fill" /></span>
            <p className="eyebrow">Ready for neighbors</p>
            <h1>Your task is posted.</h1>
            <p>It is visible around {profileArea} with an approximate public location.</p>
            <div className="truth-card"><Info size={22} /><div><strong>{auth.demoMode || !auth.session ? "Local demo only" : "Saved for your neighbors"}</strong><span>{auth.demoMode || !auth.session ? "This listing lives in this browser session and no other neighbor can see it. Sign in to post for real." : "Neighbors signed in to Micro can see this listing. Your exact address stays private until a match. No payment or notification was created."}</span></div></div>
            <TaskPreview title={listing.title} details={listing.details} mode={mode} amount={amount} area={profileArea} time={`${dateChoice} · ${startTime}`} duration={listing.duration} icon={template.icon} pending={template.isCustom} />
            <div className="success-actions"><button className="primary-button" onClick={() => setActiveTab("nearby")}>See it in Nearby</button><button className="secondary-button" onClick={() => setActiveTab("activity")}>View Activity</button><button className="text-button" onClick={() => { publishNonceRef.current = crypto.randomUUID(); setPostDraft(initialPostDraft); setPublished(false); setStep(0); setOpenCategoryId(null); setCatalogQuery(""); }}>Post another task</button></div>
          </section>
        </div>
      </MobileScroll>
    );
  }

  return (
    <MobileScroll className="app-screen tab-scroll">
      <div className="standard-page nav-padded post-composer-page" data-task-selected={step > 0 ? "true" : "false"}>
        {step === 0 ? <PageTitle eyebrow="Share a small task" title="What do you need done?" subtitle="Search or browse the tasks neighbors already ask for. You will set the details, timing, and pay next." /> : null}
        <StepRail current={step} total={3} />
        <p className="step-caption" role="status" aria-live="polite">Step {step + 1} of 4 · {["Choose a task", "Set the specifics", "Arrangement, timing & pay", "Review"][step]}</p>
        {step > 0 ? (
          <article className="chosen-task">
            <button className="chosen-task-back" aria-label="Back to task catalog" onClick={backToCatalog}><CaretLeft size={24} weight="bold" /></button>
            <div className="chosen-task-title"><span className="chosen-task-icon">{(() => { const ChosenIcon = template.icon; return <ChosenIcon size={22} weight="duotone" />; })()}</span><div className="chosen-task-body"><strong>{template.title}</strong><small>{template.category} · {listing.duration}</small></div></div>
            <span className="chosen-task-toolbar-spacer" aria-hidden="true" />
            <div className="chosen-task-side">
              {step === 1
                ? <span className="chosen-task-price"><strong>${listing.suggestedPay}</strong><small>suggested</small></span>
                : mode === "community"
                  ? <span className="chosen-task-price"><strong>$0</strong><small>volunteer</small></span>
                  : <span className="chosen-task-price"><strong>${numericAmount}</strong><small>helper gets</small></span>}
              <button className="text-button" onClick={backToCatalog}>Change</button>
            </div>
          </article>
        ) : null}
        {!accessTermsAccepted ? <div className="test-mode-banner"><Warning size={19} /><span><strong>Participation paused:</strong> accept the test terms in Profile before publishing.</span></div> : null}

        {step === 0 ? (
          <section className="form-section catalog-section">
            {!composingCustom ? <div className="catalog-search"><MagnifyingGlass size={19} /><KeyboardInput value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} onBlur={() => keyboard.hide()} placeholder={`Search ${taskTemplates.length} tasks`} aria-label="Search the task catalog" />{catalogQuery ? <button className="catalog-search-clear" aria-label="Clear search" onClick={() => { keyboard.hide(); setCatalogQuery(""); }}><X size={15} weight="bold" /></button> : null}</div> : null}

            {composingCustom ? (
              <>
                <button className="catalog-crumb" onClick={() => { keyboard.hide(); setComposingCustom(false); }}><CaretLeft size={15} weight="bold" /> Back to search</button>
                <div className="catalog-category-head">
                  <span className="category-tile-icon"><NotePencil size={22} weight="duotone" /></span>
                  <div><strong>Describe the task</strong><small>For work the catalog does not carry yet.</small></div>
                </div>
                <div className="boundary-note custom-warning"><Warning size={20} weight="fill" /><span>Catalog tasks are checked for scope and safety before neighbors see them. A task you write yourself is not, so keep it plain and inside the safety boundary of the category you pick — it goes live to neighbors straight away.</span></div>
                <label className="field-label-block">Task title<KeyboardInput value={customTitle} maxLength={60} onChange={(event) => setField("customTitle", event.target.value)} onBlur={() => keyboard.hide()} placeholder="Short and plain" /></label>
                <label className="field-label-block">What should the helper do?<KeyboardTextarea rows={4} value={customDetails} maxLength={300} onChange={(event) => setField("customDetails", event.target.value)} onBlur={() => keyboard.hide()} placeholder="What the work is, what is provided, and where it happens." /></label>
                <fieldset className="choice-fieldset"><legend>Closest category</legend><div className="category-grid">{catalogCategories.map((entry) => {
                  const CategoryIcon = entry.icon;
                  return <button key={entry.id} className="category-tile" aria-pressed={customCategoryId === entry.id} data-active={customCategoryId === entry.id ? "true" : "false"} onClick={() => { keyboard.hide(); setField("customCategoryId", entry.id); setRiskConfirmed(false); }}><span className="category-tile-icon"><CategoryIcon size={21} weight="duotone" /></span><span className="category-tile-body"><strong>{entry.label}</strong></span></button>;
                })}</div></fieldset>
                <fieldset className="choice-fieldset compact-choice-fieldset"><legend>How long</legend><div className="segmented-row" data-choices={customDurations.length}>{customDurations.map((value) => <button key={value} aria-pressed={customMinutes === value} data-active={customMinutes === value ? "true" : "false"} onClick={() => { keyboard.hide(); setField("customMinutes", value); }}>{value} min</button>)}</div></fieldset>
                <fieldset className="choice-fieldset compact-choice-fieldset"><legend>Completion check</legend><div className="segmented-row" data-choices={customCompletions.length}>{customCompletions.map((entry) => <button key={entry.id} aria-pressed={customCompletionId === entry.id} data-active={customCompletionId === entry.id ? "true" : "false"} onClick={() => { keyboard.hide(); setField("customCompletionId", entry.id); }}>{entry.label}</button>)}</div></fieldset>
                <div className="boundary-note"><ShieldCheck size={20} weight="fill" /><span>{categoryById(customCategoryId)?.boundary}</span></div>
                {customProblem ? <p className="form-error" role="alert">{customProblem}</p> : null}
                <div className="form-actions"><button className="secondary-button" onClick={() => { keyboard.hide(); setComposingCustom(false); }}>Cancel</button><button className="primary-button" disabled={Boolean(customProblem)} onClick={useCustomTask}>Use this task</button></div>
              </>
            ) : catalogQuery.trim() ? (
              searchResults.length ? (
                <>
                  <p className="catalog-block-label">{searchResults.length} {searchResults.length === 1 ? "match" : "matches"} for “{catalogQuery.trim()}”</p>
                  <div className="catalog-results">{searchResults.map(taskRow)}</div>
                </>
              ) : (
                <div className="empty-state catalog-empty">
                  <MagnifyingGlass size={28} aria-hidden="true" />
                  <h2>Nothing matches “{catalogQuery.trim()}”</h2>
                  <p>Micro only publishes tasks that have been reviewed for scope and safety, so there is nothing to write in by hand. Try a plainer word — “leaves”, “boxes”, “dog” — or browse the categories.</p>
                  <button className="primary-button" onClick={() => { keyboard.hide(); setComposingCustom(true); }}><NotePencil size={18} weight="bold" /> Describe it yourself</button>
                  <button className="text-button" onClick={() => { keyboard.hide(); setCatalogQuery(""); }}>Browse categories instead</button>
                </div>
              )
            ) : openCategory ? (
              <>
                <button className="catalog-crumb" onClick={() => { keyboard.hide(); setOpenCategoryId(null); }}><CaretLeft size={15} weight="bold" /> All categories</button>
                <div className="catalog-category-head">
                  <span className="category-tile-icon">{(() => { const HeadIcon = openCategory.icon; return <HeadIcon size={22} weight="duotone" />; })()}</span>
                  <div><strong>{openCategory.label}</strong><small>{categoryTasks.length} tasks · {openCategory.blurb}</small></div>
                </div>
                <div className="boundary-note"><ShieldCheck size={20} weight="fill" /><span>{openCategory.boundary}</span></div>
                <div className="catalog-results">{categoryTasks.map(taskRow)}</div>
              </>
            ) : (
              <>
                <p className="catalog-block-label">Most requested</p>
                <div className="catalog-results">{mostRequested.map(taskRow)}</div>
                <p className="catalog-block-label">Browse every category</p>
                <div className="category-grid">
                  {catalogCategories.map((entry) => {
                    const CategoryIcon = entry.icon;
                    return (
                      <button key={entry.id} className="category-tile" onClick={() => { keyboard.hide(); setOpenCategoryId(entry.id); }}>
                        <span className="category-tile-icon"><CategoryIcon size={21} weight="duotone" /></span>
                        <span className="category-tile-body"><strong>{entry.label}</strong><small>{categoryCounts[entry.id]} tasks</small></span>
                      </button>
                    );
                  })}
                </div>
                {draftChanged ? <button className="text-button discard-draft" onClick={() => { keyboard.hide(); setPostDraft(initialPostDraft); setOpenCategoryId(null); }}>Discard changes &amp; restore example</button> : null}
              </>
            )}
          </section>
        ) : null}

        {step === 1 ? (
          <section className="form-section">
            {/* The preview card below shows Micro writing the listing, so the
                caption that used to say so has been dropped. */}
            <h2 ref={stepHeadingRef} tabIndex={-1} className="form-step-heading">Set the specifics</h2>
            {template.options.length ? template.options.map((control) => (
              <fieldset key={control.id} className="choice-fieldset compact-choice-fieldset">
                <legend>{control.label}</legend>
                <div className="segmented-row" data-choices={control.choices.length}>{control.choices.map((choice) => <button key={choice.id} aria-pressed={selections[control.id] === choice.id} data-active={selections[control.id] === choice.id ? "true" : "false"} onClick={() => setChoice(control.id, choice.id)}>{choice.label}</button>)}</div>
              </fieldset>
            )) : <p className="catalog-intro">This task has no options to set — the scope below is the whole job.</p>}
            {/* Duration and pay describe this listing, so they live in its card
                rather than as two more tiles under it. The scope rows stay
                folded: they are the whole of step 3, and repeating them in full
                here is what made this step a wall. */}
            {/* `composeListing` always returns the template's own title, which
                the route header is already showing, so it is not repeated. */}
            <section className="composed-listing">
              <p className="eyebrow">What neighbors will read</p>
              <p>{listing.details}</p>
              <p className="composed-meta">{listing.duration} · suggested ${listing.suggestedPay}</p>
              <button className="history-toggle" aria-expanded={scopeOpen} onClick={() => setScopeOpen((current) => !current)}>{scopeOpen ? "Hide scope" : "See included, excluded, and completion"}<CaretDown size={16} weight="bold" aria-hidden="true" /></button>
              {scopeOpen ? <div className="review-list"><ReviewRow icon={ListChecks} title="Included" text={listing.included} /><ReviewRow icon={X} title="Not included" text={listing.excluded} /><ReviewRow icon={CheckCircle} title="Completion check" text={listing.completion} /></div> : null}
            </section>
            <button className="choice-row risk-confirm" aria-pressed={riskConfirmed} data-selected={riskConfirmed ? "true" : "false"} onClick={() => { keyboard.hide(); setRiskConfirmed((current) => !current); }}><span><strong>{template.category} safety boundary</strong><small>{template.boundary}</small></span><span className="checkbox">{riskConfirmed ? <Check size={14} weight="bold" /> : null}</span></button>
            {/* Most tasks are posted without a photo, so the card that explains
                how to take a privacy-safe one waits until it is asked for. */}
            {photoPreview ? <div className="photo-upload-block"><div><strong>Task photo</strong><span>Show the work area without revealing a face, plate, code, document, or address marker.</span></div><figure className="post-photo-preview"><img src={photoPreview} alt="Selected privacy-safe task preview" /><button className="text-button" onClick={() => setPhotoPreview("")}>Remove photo</button></figure></div>
              : <label className="photo-add-row"><Plus size={17} weight="bold" aria-hidden="true" /> Add an optional photo<input type="file" accept="image/*" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setPhotoPreview(typeof reader.result === "string" ? reader.result : ""); reader.readAsDataURL(file); }} /></label>}
            {/* Only a chosen photo needs acknowledging (`scopeValid`), so the
                guidance appears with one instead of standing in the way of
                everyone who never adds a photo at all. */}
            {photoPreview ? <button className="photo-guidance photo-guidance-button" aria-pressed={photoAcknowledged} onClick={() => { keyboard.hide(); setPhotoAcknowledged((current) => !current); }}><ShieldCheck size={21} /><span><strong>{photoAcknowledged ? "Photo guidance reviewed" : "Review photo guidance"}</strong> The selected preview stays in this local browser session.</span><span className="checkbox">{photoAcknowledged ? <Check size={14} weight="bold" /> : null}</span></button> : null}
            {!scopeValid ? <p className="form-error" role="alert">{!riskConfirmed ? "Confirm the safety boundary for this task before continuing." : "Review the photo privacy guidance before continuing with this image."}</p> : null}
            <div className="form-actions form-actions-single"><button className="primary-button" disabled={!scopeValid} onClick={() => goStep(2)}>Timing &amp; pay</button></div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="form-section">
            <h2 ref={stepHeadingRef} tabIndex={-1} className="form-step-heading">Arrangement, timing, and pay</h2>
            <p className="catalog-intro">Choose how this is arranged, when it happens, and what the helper receives.</p>
            <div className="section-label">How is this arranged?</div>
            {availableModes.length > 1 ? (
              <div className="mode-choice-list">
                {availableModes.map((value) => {
                  const meta = modeMeta[value];
                  const ModeIcon = meta.icon;
                  return (
                    <button key={value} className="mode-choice" aria-pressed={mode === value} data-mode={value} data-selected={mode === value ? "true" : "false"} disabled={value === "sponsored" && !sponsoredPostingAllowed} onClick={() => { keyboard.hide(); setMode(value); }}>
                      <span className="mode-choice-icon"><ModeIcon size={25} weight="fill" /></span>
                      <span><strong>{meta.label}</strong><small>{value === "paid" ? "You pay the helper a fair, agreed amount." : value === "community" ? "No money changes hands." : sponsoredPostingAllowed ? "Your verified nonprofit pays the helper; the recipient pays $0." : auth.accountType === "nonprofit" ? "Unlocks after nonprofit verification and sponsorship approval." : "Available to verified nonprofit accounts."}</small></span>
                      <span className="radio-mark">{mode === value ? <Check size={15} weight="bold" /> : null}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="notice-card"><HandHeart size={22} /><div><strong>{availableModes[0] === "sponsored" && !sponsoredPostingAllowed ? "Sponsored access locked" : `${modeMeta[availableModes[0]].label} only`}</strong><span>{availableModes[0] === "sponsored" && !sponsoredPostingAllowed ? auth.accountType === "nonprofit" ? "This task stays visible, but publishing unlocks only after nonprofit verification and sponsorship approval." : "This task stays visible, but only a verified nonprofit account can publish it." : `This task is offered as ${modeMeta[availableModes[0]].label.toLowerCase()}, so there is nothing to choose here.`}</span></div></div>
            )}
            <div className="section-label">When</div>
            <div className="segmented-row" data-choices={dateChoices.length}>{dateChoices.map((value) => <button key={value} aria-pressed={dateChoice === value} data-active={dateChoice === value ? "true" : "false"} onClick={() => setDateChoice(value)}>{value}</button>)}</div>
            <div className="section-label">Start time · <span className="section-label-value">{startTime}</span></div>
            <Carousel ariaLabel="Start time" className="time-rail" contentClassName="time-rail-track">
              {timeSlots.map((slot) => <button key={slot} ref={slot === startTime ? selectedTimeRef : undefined} className="time-chip" aria-pressed={startTime === slot} data-active={startTime === slot ? "true" : "false"} onClick={() => setStartTime(slot)}>{slot}</button>)}
            </Carousel>
            <div className="derived-facts"><div><span>Duration</span><strong>{listing.duration}</strong></div><div><span>Set by</span><strong>The task you picked</strong></div></div>
            <label className="field-label-block">Private match address<KeyboardInput value={privateAddress} onChange={(event) => setPrivateAddress(event.target.value)} onBlur={() => keyboard.hide()} /></label>
            {/* The address tells a matched helper which door; the device
                location tells the map which neighborhood. Optional, because a
                task is often not where the requester is standing. */}
            <div className="location-share" data-located={coords ? "true" : "false"}>
              <span className="location-share-icon"><MapPin size={20} weight="fill" aria-hidden="true" /></span>
              <div>
                <strong>{coords ? `Location shared · ${listingArea.label}` : "Use my current location"}</strong>
                <small>{coords ? "Neighbors still see only the approximate area, never this point." : "Places the task on the map near where you are. Optional — the area from your profile is used otherwise."}</small>
              </div>
              <button className="secondary-button" disabled={locating} onClick={async () => {
                keyboard.hide();
                setLocating(true);
                setLocationError("");
                const { point, error } = await readDeviceLocation();
                setLocating(false);
                if (!point) { setLocationError(error ?? "Your location could not be read."); return; }
                if (!areaForPoint(point)) { setLocationError("You are outside the demo neighborhoods, so the profile area is used instead."); return; }
                setField("coords", point);
              }}>{locating ? "Locating…" : coords ? "Update" : "Share location"}</button>
            </div>
            {coords ? <button className="text-button" onClick={() => setField("coords", undefined)}>Use my profile area instead</button> : null}
            {locationError ? <p className="form-error" role="status">{locationError}</p> : null}
            <div className="privacy-choice"><div><span className="mini-label">Shown publicly</span><strong>{profileArea}</strong><small>Approximate neighborhood only · private after match: {privateAddress || "Address required"}</small></div><ShieldCheck size={23} weight="fill" /></div>
            {mode !== "community" ? <label className="field-label-block">Helper receives<div className="money-field"><CurrencyDollar size={21} /><KeyboardInput value={amount} inputMode="numeric" onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} onBlur={() => keyboard.hide()} /></div>{numericAmount !== listing.suggestedPay ? <button className="text-button" onClick={() => { keyboard.hide(); setAmount(String(listing.suggestedPay)); }}>Use the suggested ${listing.suggestedPay}</button> : null}</label> : <div className="notice-card"><HandHeart size={22} /><div><strong>Volunteer — no payment</strong><span>This task will never display an earning amount.</span></div></div>}
            <div className="fair-pay-card"><ShieldCheck size={22} weight="fill" /><div><strong>{mode === "community" ? "Clear time commitment" : `~$${hourlyEquivalent}/hour equivalent`}</strong><span>{mode === "sponsored" ? "Sponsor pays; recipient total is $0." : mode === "paid" ? `Helper earnings are shown before they accept. This task suggests $${listing.suggestedPay} for its scope; the prototype minimum is $15.` : "Scope and duration remain visible before a volunteer commits."}</span></div></div>
            {mode !== "community" ? <div className="fee-breakdown four-fees"><div><span>Helper receives</span><strong>${numericAmount}</strong></div><div><span>Platform</span><strong>${platformFee}</strong></div><div><span>Est. processing</span><strong>${processingFee}</strong></div><div><span>{mode === "sponsored" ? "Sponsor total" : "Requester total"}</span><strong>${numericAmount + platformFee + processingFee}</strong></div></div> : null}
            <button className="choice-row safety-confirm" aria-pressed={safetyConfirmed} data-selected={safetyConfirmed ? "true" : "false"} onClick={() => { keyboard.hide(); setSafetyConfirmed((current) => !current); }}><span><strong>I reviewed safety and cancellation terms</strong><small>Changes, cancellations, and issues stay in the task thread.</small></span><span className="checkbox">{safetyConfirmed ? <Check size={14} weight="bold" /> : null}</span></button>
            {logisticsProblems.length ? <p className="form-error" role="alert">{logisticsProblems.length === 1 ? `${logisticsProblems[0][0].toUpperCase()}${logisticsProblems[0].slice(1)} to continue.` : `Still to do: ${logisticsProblems.slice(0, -1).join(", ")} and ${logisticsProblems[logisticsProblems.length - 1]}.`}</p> : null}
            <div className="form-actions"><button className="secondary-button" onClick={() => goStep(1)}>Back</button><button className="primary-button" disabled={!logisticsValid} onClick={() => goStep(3)}>Preview</button></div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="form-section">
            <h2 ref={stepHeadingRef} tabIndex={-1} className="form-step-heading">Review the public listing</h2>
            <p className="eyebrow">Public preview</p>
            <TaskPreview title={listing.title} details={listing.details} mode={mode} amount={amount} area={profileArea} time={`${dateChoice} · ${startTime}`} duration={listing.duration} icon={template.icon} pending={template.isCustom} />
            {photoPreview ? <figure className="post-photo-preview final-photo"><img src={photoPreview} alt="Task photo included in the public preview" /><figcaption>Public task photo · reviewed for private details</figcaption></figure> : null}
            <div className="review-list"><ReviewRow icon={ListChecks} title="Included" text={listing.included} /><ReviewRow icon={X} title="Not included" text={listing.excluded} /><ReviewRow icon={CheckCircle} title="Completion check" text={listing.completion} /><ReviewRow icon={ShieldCheck} title="Cancellation & safety" text="Changes stay in the thread. Issue reports pause automatic payout review." /></div>
            <section className="listing-boundary-card"><div><span>Public before match</span><strong>{profileArea}</strong><small>{modeMeta[mode].label} · {template.category} · {dateChoice} at {startTime}</small></div><div><span>Private after protected match</span><strong>{privateAddress}</strong><small>Released only after assignment and the relevant payment or Community Help state.</small></div><div><span>Eligibility</span><strong>{template.youthEligible ? "Adults and Youth Mode helpers" : "Adults only"}</strong><small>Set by the task you picked, not by the photo or neighborhood.</small></div>{mode !== "community" ? <div><span>{mode === "sponsored" ? "Sponsor" : "Requester"} total</span><strong>${numericAmount + platformFee + processingFee}</strong><small>Helper receives ${numericAmount}; recipient pays {mode === "sponsored" ? "$0" : `$${numericAmount + platformFee + processingFee}`}.</small></div> : <div><span>Compensation</span><strong>Volunteer · $0</strong><small>No payment or payout state will be created.</small></div>}</section>
            {template.isCustom
              ? <div className="truth-card custom-truth"><Warning size={22} weight="fill" /><div><strong>You wrote this one</strong><span>It is not from Micro's reviewed catalog, so neighbors read your wording as written. Its exclusions and safety boundary still come from {template.category}.</span></div></div>
              : <div className="truth-card"><ShieldCheck size={22} /><div><strong>Written from Micro's task catalog</strong><span>The wording above comes from the reviewed entry for “{template.title}” and the options you set. Only your private address was typed in.</span></div></div>}
            <div className="form-actions"><button className="secondary-button" onClick={() => goStep(2)}>Edit</button><button className="primary-button" disabled={!scopeValid || !logisticsValid || publishing} onClick={publish}>{publishing ? "Publishing…" : "Publish task"}</button></div>
            {publishError ? <p className="form-error" role="alert">{publishError}</p> : null}
          </section>
        ) : null}
      </div>
    </MobileScroll>
  );
}

function TaskPreview({ title, details, mode, amount, area, time = "Tomorrow · 10 AM", duration = "60 min", icon = Wrench, pending = false }: { title: string; details: string; mode: TaskMode; amount: string; area: string; time?: string; duration?: string; icon?: Icon; pending?: boolean }) {
  const ModeIcon = modeMeta[mode].icon;
  const TaskIcon = icon;
  return (
    <article className="task-card preview-card" data-mode={mode} data-selected="true">
      <div className="task-card-top"><span className="task-icon"><TaskIcon size={23} weight="bold" /></span><div className="task-title-block"><div className="mode-badge"><ModeIcon size={13} weight="fill" /> {modeMeta[mode].label}</div><h2>{title}</h2></div>{mode !== "community" ? <div className="earning"><strong>${amount || "0"}</strong><span>You earn</span></div> : null}</div>
      <p className="task-description">{details}</p>
      <div className="task-facts"><span><MapPin size={17} /> {area}</span><span><CalendarBlank size={17} /> {time}</span><span><Clock size={17} /> {duration}</span></div>
    </article>
  );
}

function organizationAccessDetails(auth: AuthContextValue) {
  const status = auth.organization?.verification_status ?? "pending";
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  if (status === "suspended") {
    return {
      status,
      statusLabel,
      title: "Organization access paused",
      copy: "Organization sponsorship tools are unavailable while access is suspended. Personal task permissions remain separate.",
    };
  }
  if (status === "rejected") {
    return {
      status,
      statusLabel,
      title: "Verification needs attention",
      copy: "The organization profile needs review before sponsorship requests can be opened.",
    };
  }
  if (status === "pending") {
    return {
      status,
      statusLabel,
      title: "Verification is in review",
      copy: "Regular task features remain available according to your account permissions. Sponsorship tools unlock after organization review.",
    };
  }
  if (auth.capabilities.can_receive_sponsorship_requests && auth.canSponsor) {
    return {
      status,
      statusLabel,
      title: "Requests and funding are ready",
      copy: "Review incoming requests, fund eligible help, and track sponsored tasks in one place.",
    };
  }
  if (auth.capabilities.can_receive_sponsorship_requests) {
    return {
      status,
      statusLabel,
      title: "Sponsorship requests are ready",
      copy: "Your organization can review requests. Funding remains locked until sponsorship is enabled.",
    };
  }
  return {
    status,
    statusLabel,
    title: "Organization verified",
    copy: "Sponsorship access has not been enabled for this organization yet.",
  };
}

function ActivityScreen() {
  const flow = useFlow();
  const auth = useAuth();
  const { paidStage, sponsorFunded, sponsorSeeking, setSponsorSeeking, activeTask, communityTask, communityStage, ownedTasks, remoteTasks, collaboration, refreshRemoteTasks, setOwnedTasks, setActiveTab, setSelectedTaskId, persona, reportedTaskIds, moderationHolds, acceptedTaskIds, closedTaskIds, acceptedTaskActors, taskEvents, activityPerspective, setActivityPerspective, accessTermsAccepted, guardianLinked, youthAge, youthApprovalTaskId, youthApprovedTaskId, guardianSupervisedTaskId, guardianSupervisionStatus } = useMicro();
  const [showAllHistory, setShowAllHistory] = useState(false);
  const paidReported = reportedTaskIds.includes(activeTask.id) || Boolean(moderationHolds[activeTask.id]);
  const communityReported = Boolean(communityTask && (reportedTaskIds.includes(communityTask.id) || moderationHolds[communityTask.id]));
  const participationReady = accessTermsAccepted && (persona !== "youth" || (youthAge >= 15 && guardianLinked));
  const actor = persona === "adult" ? "adult" : persona === "youth" ? "youth" : null;
  const paidBelongsToActor = Boolean(actor && acceptedTaskActors[activeTask.id] === actor);
  const communityBelongsToActor = Boolean(actor && communityTask && acceptedTaskActors[communityTask.id] === actor);
  const showPaid = participationReady && paidBelongsToActor && acceptedTaskIds.includes(activeTask.id);
  const showCommunity = participationReady && communityBelongsToActor && Boolean(communityTask) && acceptedTaskIds.includes(communityTask?.id ?? "") && communityStage !== "Completed" && communityStage !== "Canceled";
  const showReopened = participationReady && paidBelongsToActor && paidStage === "Reopened" && !acceptedTaskIds.includes(activeTask.id);
  const showCompletedPaid = participationReady && paidBelongsToActor && paidStage === "Completed" && Boolean(taskEvents[activeTask.id]?.length);
  const hasActiveCommitment = showPaid || showCommunity;
  const activeLifecycleTask = showCommunity && communityTask ? communityTask : showPaid ? activeTask : null;
  const liveLifecycleTask = activeLifecycleTask?.ownerId ? activeLifecycleTask : null;
  const liveLifecycleAssignment = liveLifecycleTask ? participantAssignmentFor(collaboration, liveLifecycleTask.id, auth.session?.user.id ?? null) : null;
  const effectivePerspective = liveLifecycleTask
    ? liveLifecycleAssignment?.helperId === auth.session?.user.id ? "helper" : liveLifecycleTask.ownerId === auth.session?.user.id ? "requester" : activityPerspective
    : activityPerspective;
  const guardianTaskId = youthApprovalTaskId ?? youthApprovedTaskId ?? guardianSupervisedTaskId;
  const guardianTask = guardianTaskId ? tasks.find((task) => task.id === guardianTaskId) : null;
  const attentionLabel = !participationReady ? "Participation paused" : persona === "guardian" ? guardianTask ? "1 youth task needs context" : "Guardian view" : (paidReported && showPaid) || (communityReported && showCommunity) ? "1 task is in support review" : showReopened ? "1 task needs a new match" : hasActiveCommitment ? "1 task needs attention" : "No active commitments";
  const attentionCopy = !participationReady ? "Update the age, terms, or guardian link in Profile before participating." : persona === "guardian" ? guardianTask ? guardianSupervisedTaskId === guardianTask.id && guardianSupervisionStatus ? guardianSupervisionStatus : "Approval stays task-specific and never creates a guardian commitment." : "Task approvals stay separate from adult activity." : (paidReported && showPaid) || (communityReported && showCommunity) ? "Participant actions remain paused until support authority resolves the report." : showReopened ? "The test payment hold was released after a no-show." : hasActiveCommitment ? effectivePerspective === "helper" ? "Your helper or volunteer next step is ready." : liveLifecycleTask ? "Your matched request is ready." : "Seeded requester controls are visible for this matched task." : "Accept a nearby task when the scope and timing fit.";
  const completedCatalog = Array.from(new Map([...collaboration.assignments.map((assignment) => assignment.task).filter((task): task is Task => Boolean(task)), ...tasks, sponsoredFixtureTask, ...ownedTasks, ...pastThreadTasks, activeTask, ...(communityTask ? [communityTask] : [])].map((task) => [task.id.replace(/-history$/, ""), task])).values());
  const completedSessionTasks = completedCatalog.filter((task) => closedTaskIds.includes(task.id) && acceptedTaskActors[task.id] === actor);
  const liveOwnedTasks = [
    ...collaboration.assignments.filter((assignment) => assignment.requesterId === auth.session?.user.id && assignment.task).map((assignment) => assignment.task as Task),
    ...remoteTasks.filter((task) => task.ownerId === auth.session?.user.id),
  ];
  const ownedByPersona = Array.from(new Map([
    ...liveOwnedTasks,
    ...ownedTasks.filter((task) => task.ownerPersona === persona),
  ].map((task) => [task.id, task])).values());
  const toggleListingPause = async (task: Task) => {
    const paused = Boolean(task.listingPaused);
    if (task.ownerId && supabase && auth.session) {
      const { error } = await supabase.from("tasks").update({ listing_paused: !paused }).eq("id", task.id).eq("owner_id", auth.session.user.id);
      if (!error) await refreshRemoteTasks();
      return;
    }
    setOwnedTasks((current) => current.map((listing) => listing.id === task.id ? { ...listing, listingPaused: !paused } : listing));
  };
  const completedItems: Array<{ id: string; icon: Icon; title: string; copy: string }> = [
    ...completedSessionTasks.map((task) => ({ id: task.id, icon: task.mode === "community" ? HandHeart : CheckCircle, title: task.title, copy: task.mode === "community" ? "Volunteer task · completed in this session" : `Completed in this session · $${task.earning ?? 0} test payout` })),
    ...(persona === "adult"
      ? [
        { id: "porch-light", icon: CheckCircle, title: "Set up porch light timer", copy: "Completed July 30 · $20 released" },
        { id: "garden-beds", icon: HandHeart, title: "Water community garden beds", copy: "Volunteer task · completed July 26" },
      ]
      : [
        { id: "library-kits", icon: ShieldCheck, title: "Pack library welcome kits", copy: "Guardian-approved · completed July 28 · $18 test payout" },
        { id: "community-supplies", icon: HandHeart, title: "Sort community-center supplies", copy: "Volunteer task · 1 hour added July 22" },
      ]),
  ];
  const visibleCompletedItems = showAllHistory ? completedItems : completedItems.slice(0, 1);
  const isLiveNonprofit = Boolean(auth.session && auth.organization && auth.accountType === "nonprofit");
  const organizationAccess = organizationAccessDetails(auth);
  const openSponsorshipRequests = auth.capabilities.can_receive_sponsorship_requests && !sponsorFunded ? 1 : 0;
  // The banner only earns its space when it says something the cards below do
  // not: participation is paused, support is involved, or there is nothing to
  // list at all. Above a healthy commitment it just repeats the card's own
  // status, title, and next step back at you.
  const showAttentionBanner =
    !participationReady ||
    persona === "guardian" ||
    (paidReported && showPaid) ||
    (communityReported && showCommunity) ||
    showReopened ||
    !hasActiveCommitment;

  return (
    <>
      <MobileScroll className="app-screen tab-scroll">
        <div className="standard-page nav-padded activity-page">
          {showAttentionBanner ? <section className="status-summary" role="status" aria-live="polite"><span className="status-orbit">{hasActiveCommitment ? <Bell size={24} weight="fill" /> : <ListChecks size={24} weight="bold" />}</span><div><strong>{attentionLabel}</strong><span>{attentionCopy}</span>{!hasActiveCommitment && !showReopened && persona !== "guardian" ? <button className="status-browse-action" onClick={() => setActiveTab("nearby")}>{participationReady ? "Browse nearby" : "Browse without joining"}<ArrowRight size={16} /></button> : null}</div></section> : null}
        {isLiveNonprofit ? <button className="organization-entry" onClick={() => flow.push(makeOrganizationWorkspaceScreen())}>
          <span className="organization-entry-icon"><Buildings size={23} weight="fill" /></span>
          <span className="organization-entry-copy">
            <strong>{auth.organization?.name ?? "Organization workspace"}</strong>
            <small>{openSponsorshipRequests ? `${openSponsorshipRequests} sponsorship request to review` : organizationAccess.title}</small>
          </span>
          <span className="organization-entry-end"><span className="organization-status" data-status={organizationAccess.status}>{organizationAccess.statusLabel}</span><ArrowRight size={19} weight="bold" /></span>
        </button> : null}
        {/* A testing control, so it stays quiet and only explains itself in the
            seeded view, where the caveat actually matters. */}
        {hasActiveCommitment && !liveLifecycleTask ? <fieldset className="perspective-switch compact-perspective"><legend>Prototype perspective</legend><div className="segmented-row two-segments"><button aria-pressed={activityPerspective === "helper"} data-active={activityPerspective === "helper" ? "true" : "false"} onClick={() => setActivityPerspective("helper")}>{showCommunity ? "Volunteer" : "Helper"}</button><button aria-pressed={activityPerspective === "requester"} data-active={activityPerspective === "requester" ? "true" : "false"} onClick={() => setActivityPerspective("requester")}>Requester</button></div>{activityPerspective === "requester" ? <p>A clearly labeled seeded requester view for testing confirmation and arrival support.</p> : null}</fieldset> : null}
        {persona === "guardian" && guardianTask ? <section className="guardian-activity-card"><ShieldCheck size={24} weight="fill" /><div><span>{youthApprovalTaskId ? "Approval requested" : guardianSupervisedTaskId === guardianTask.id ? "Sam’s task lifecycle" : "Approved for Sam"}</span><strong>{guardianTask.title}</strong><small>{guardianSupervisedTaskId === guardianTask.id && guardianSupervisionStatus ? guardianSupervisionStatus : "This is not your commitment. Review it from Youth Mode."}</small></div><button className="secondary-button" onClick={() => { setActiveTab("profile"); }}>Open Youth Mode</button></section> : null}
        {showReopened ? <section className="activity-group"><div className="section-heading"><h2>Needs a new match</h2><span>1</span></div><article className="posted-card"><div className="mode-badge"><Warning size={14} weight="fill" /> Reopened</div><h3>{activeTask.title}</h3><p>Payment hold released · visible in Nearby again</p><button className="secondary-button" onClick={() => { setSelectedTaskId(activeTask.id); setActiveTab("nearby"); }}>See reopened listing</button></article></section> : null}
        {showPaid ? <section className="activity-group">
          <div className="section-heading"><h2>{effectivePerspective === "helper" ? "Your commitment" : "Matched request"}</h2><span>1</span></div>
          <button className="activity-card" onClick={() => flow.push(makeActivityJourneyScreen(activeTask))}>
            <div className="activity-top"><span className="status-badge"><ShieldCheck size={14} weight="fill" /> {paidReported ? "Support review" : liveLifecycleTask ? "Live match" : paidStage}</span><ArrowRight size={19} /></div>
            <h3>{activeTask.title}</h3>
            <p>{activeTask.time} · {activeTask.area}</p>
            <div className="activity-bottom"><span>{paidReported ? "Payout review paused" : liveLifecycleTask ? "Live match · payment service not connected" : effectivePerspective === "requester" ? `Test hold · helper earns $${activeTask.earning ?? 0}` : `Helper receives $${activeTask.earning ?? 0}`}</span><strong>Open task</strong></div>
          </button>
          {!liveLifecycleTask && paidStage === "Payment secured" && !paidReported && effectivePerspective === "requester" ? <button className="quiet-action" onClick={() => flow.push(makeNoShowScreen())}><Warning size={18} /> Helper didn’t arrive?</button> : null}
          {!liveLifecycleTask && paidStage === "Payment secured" && !paidReported && effectivePerspective === "helper" ? <button className="quiet-action" onClick={() => flow.push(makeRequesterNoShowScreen(activeTask))}><Warning size={18} /> Requester unavailable?</button> : null}
        </section> : null}
        {showCommunity && communityTask ? <section className="activity-group"><div className="section-heading"><h2>{effectivePerspective === "helper" ? "Community commitment" : "Community request"}</h2><span>1</span></div><button className="activity-card community-activity-card" onClick={() => flow.push(makeCommunityJourneyScreen(communityTask))}><div className="activity-top"><span className="status-badge community-status"><HandHeart size={14} weight="fill" /> {communityReported ? "Support review" : communityStage}</span><ArrowRight size={19} /></div><h3>{communityTask.title}</h3><p>{communityTask.time} · {communityTask.area}</p><div className="activity-bottom"><span>{communityReported ? "Participant actions paused" : "Volunteer · no payment"}</span><strong>{effectivePerspective === "helper" ? "Open commitment" : "Review request"}</strong></div></button></section> : null}
        {ownedByPersona.length ? <section className="activity-group"><div className="section-heading"><h2>Posted by you</h2><span>{ownedByPersona.length}</span></div>{ownedByPersona.map((task) => { const paused = Boolean(task.listingPaused); const matched = collaboration.assignments.some((assignment) => assignment.taskId === task.id && assignment.status === "accepted"); return <article key={task.id} className="posted-card"><div className="mode-badge">{paused ? <Warning size={14} weight="fill" /> : <CheckCircle size={14} weight="fill" />} {paused ? "Paused" : matched ? "Matched" : task.ownerId ? "Live" : "Preview"}</div><h3>{task.title}</h3><p>{matched ? "A helper accepted · protected thread ready" : `${task.time} · ${paused ? "Hidden from Nearby" : `${task.area} shown approximately`}`}</p><div className="success-actions">{matched ? <button className="secondary-button" onClick={() => setActiveTab("messages")}>Open messages</button> : !paused ? <button className="secondary-button" onClick={() => { setSelectedTaskId(task.id); setActiveTab("nearby"); }}>Preview listing</button> : null}{!matched ? <button className="text-button" onClick={() => void toggleListingPause(task)}>{paused ? "Resume listing" : "Pause listing"}</button> : null}</div></article>; })}</section> : null}
        {persona === "adult" && auth.demoMode ? <section className="activity-group">
          <div className="section-heading"><h2>Sponsored help</h2><span>1</span></div>
          <article className="sponsor-card">
            <div className="mode-badge"><Sparkle size={14} weight="fill" /> {sponsorFunded ? "Sponsored" : sponsorSeeking ? "Seeking Sponsor" : "Community Help"}</div>
            <h3>Grocery pickup for Ana</h3>
            <p>{sponsorFunded ? "Funded in test mode · helper earns $24" : sponsorSeeking ? "Volunteer window ended · recipient pays $0" : "Volunteer window open · no payment offered"}</p>
            {!sponsorSeeking && !sponsorFunded ? <button className="secondary-button" onClick={() => setSponsorSeeking(true)}>Volunteer window ended — seek a sponsor</button> : <button className="secondary-button" onClick={() => flow.push(makeSponsorScreen())}>{sponsorFunded ? "View funded task" : "Sponsor this task"}</button>}
          </article>
        </section> : null}
        {persona !== "guardian" ? <section className="activity-group completed-group">
          <div className="section-heading"><h2>Recently completed</h2><span>{completedItems.length}</span></div>
          {visibleCompletedItems.map(({ id, icon: HistoryIcon, title, copy }) => <div key={id} className="compact-history"><HistoryIcon size={20} weight="fill" /><div><strong>{title}</strong><span>{copy}</span></div></div>)}
          {completedItems.length > 1 ? <button className="history-toggle" aria-expanded={showAllHistory} onClick={() => setShowAllHistory((current) => !current)}>{showAllHistory ? "Show less" : `View all ${completedItems.length}`}<CaretDown size={16} weight="bold" aria-hidden="true" /></button> : null}
        </section> : null}
        {/* A destination rather than activity, and the Nearby bell already
            reaches it, so it sits after the tasks instead of ahead of them. */}
        <button className="notification-entry" onClick={() => flow.push(makeNotificationsScreen())}><span><Bell size={20} weight="fill" /><strong>Notifications</strong></span><small>{isLiveNonprofit ? "Tasks + sponsorships" : "Role-aware updates"}</small><ArrowRight size={18} /></button>
      </div>
      </MobileScroll>
      <header className="activity-toolbar">
        <button type="button" aria-label="Back to Profile" onClick={() => setActiveTab("profile")}><CaretLeft size={25} weight="bold" /></button>
        <h1>Activity</h1>
        <span aria-hidden="true" />
      </header>
    </>
  );
}

function makeNotificationsScreen(): FlowScreen {
  return { id: "notifications", headerHeight: 66, header: (flow) => <RouteHeader title="Notifications" onBack={flow.pop} />, render: () => <NotificationsScreen /> };
}

type Notice = { icon: Icon; title: string; copy: string; time: string; tab: TabId; task?: Task };

/**
 * The notices that came from the other person: an acceptance on something you
 * posted, and the newest reply in any thread you are party to. Both sides are
 * covered by one pass, because "who is the other person here" is just whoever
 * did not do the thing.
 */
function collaborationNotices(collaboration: CollaborationState, signedInUserId: string | null): Notice[] {
  if (!signedInUserId) return [];
  const now = new Date();
  const notices: Notice[] = [];

  for (const assignment of collaboration.assignments) {
    if (assignment.status !== "accepted" || assignment.requesterId !== signedInUserId) continue;
    notices.push({
      icon: HandHeart,
      title: `${assignment.helperName} accepted your job`,
      copy: `${assignment.taskTitle} · open the task thread to agree on arrival details.`,
      time: agoLabel(now, new Date(assignment.createdAt)),
      tab: "messages",
    });
  }

  for (const thread of Object.values(collaboration.messagesByAssignment)) {
    // Your own lines are not news, and a thread you have not been replied to in
    // has nothing to announce.
    const latest = [...thread].reverse().find((message) => message.senderId !== signedInUserId);
    if (!latest) continue;
    notices.push({
      icon: ChatCircle,
      title: `New message from ${latest.senderName}`,
      copy: latest.body,
      time: agoLabel(now, new Date(latest.createdAt)),
      tab: "messages",
    });
  }

  return notices;
}

function NotificationsScreen() {
  const flow = useFlow();
  const auth = useAuth();
  const { setActiveTab, paidStage, persona, youthApprovalTaskId, youthApprovedTaskId, guardianSupervisedTaskId, guardianSupervisionStatus, activeTask, communityTask, acceptedTaskIds, closedTaskIds, acceptedTaskActors, taskEvents, moderationHolds, notificationsEnabled, setNotificationsEnabled, sponsorFunded, ownedTasks, remoteTasks, blockedThreadIds, blockedRequesterNames, profileAreaId, refusedJobIds, setSelectedTaskId, setSeenSpecialJobIds, collaboration } = useMicro();
  const openTab = (tab: TabId) => { setActiveTab(tab); flow.pop(); };
  // A job notice opens that job, not just the tab it lives on.
  const openJob = (task: Task) => { setSelectedTaskId(task.id); setActiveTab("nearby"); flow.replace(makeTaskScreen(task)); };
  const actor = persona === "adult" ? "adult" : persona === "youth" ? "youth" : null;
  const markRead = useCallback((ids: string) => setSeenSpecialJobIds((current) => {
    const next = ids.split(",").filter((id) => id && !current.includes(id));
    return next.length ? [...current, ...next] : current;
  }), [setSeenSpecialJobIds]);
  const actorTasks = [activeTask, communityTask].filter((task): task is Task => Boolean(task && actor && acceptedTaskActors[task.id] === actor && (acceptedTaskIds.includes(task.id) || taskEvents[task.id]?.length)));
  const lifecycleTask = actorTasks.find((task) => acceptedTaskIds.includes(task.id)) ?? [...actorTasks].sort((first, second) => (taskEvents[second.id]?.at(-1)?.id ?? 0) - (taskEvents[first.id]?.at(-1)?.id ?? 0))[0];
  const activeMatch = Boolean(lifecycleTask && acceptedTaskIds.includes(lifecycleTask.id));
  const latestEvent = lifecycleTask ? taskEvents[lifecycleTask.id]?.at(-1) : null;
  const isLiveNonprofit = Boolean(auth.session && auth.organization && auth.accountType === "nonprofit");
  const notices: { icon: Icon; title: string; copy: string; time: string; tab: TabId; task?: Task }[] = [
    { icon: Bell, title: "Nearby help refreshed", copy: "Browse the current local paid, volunteer, and sponsored fixtures.", time: "Now", tab: "nearby" },
  ];
  if (isLiveNonprofit) {
    const organizationAccess = organizationAccessDetails(auth);
    notices.unshift({
      icon: sponsorFunded ? SealCheck : auth.capabilities.can_receive_sponsorship_requests ? Sparkle : LockKey,
      title: sponsorFunded ? "Sponsored task funded" : auth.capabilities.can_receive_sponsorship_requests ? "Sponsorship request ready" : organizationAccess.title,
      copy: sponsorFunded ? "The local preview records a funded helper task with a $0 recipient total." : auth.capabilities.can_receive_sponsorship_requests ? "Open Activity to review the local request fixture and your organization’s funding access." : organizationAccess.copy,
      time: "Now",
      tab: "activity",
    });
  }
  // The Nearby bell counts these, so the list has to name the same jobs: same
  // pool, same exclusions, or the badge would promise a notice that isn't here.
  const specialJobs = specialJobsFor([...remoteTasks, ...ownedTasks, ...(sponsorFunded ? [sponsoredFixtureTask] : []), ...tasks], persona, profileAreaId, refusedJobIds, auth.session?.user.id)
    .filter((task) => !hasExpired(task, new Date()) && !acceptedTaskIds.includes(task.id) && !closedTaskIds.includes(task.id) && !task.listingPaused && !moderationHolds[task.id] && !blockedThreadIds.includes(task.id) && !blockedRequesterNames.includes(getTaskDetails(task).requester));
  for (const task of [...specialJobs].reverse()) {
    notices.unshift({
      icon: task.mode === "sponsored" ? Sparkle : ShieldCheck,
      title: task.mode === "sponsored" ? "Sponsored job for you" : "Youth-eligible job for you",
      copy: `${task.title} · ${task.area} · ${task.time}${task.earning ? ` · $${task.earning}` : ""}`,
      time: "Now",
      tab: "nearby",
      task,
    });
  }
  // Reading the list is what clears the bell.
  const specialJobIds = specialJobs.map((task) => task.id).join(",");
  useEffect(() => { markRead(specialJobIds); }, [markRead, specialJobIds]);
  if (youthApprovalTaskId && (persona === "guardian" || persona === "youth")) notices.unshift({ icon: ShieldCheck, title: persona === "guardian" ? "Youth task needs your review" : "Guardian review requested", copy: "The exact pantry-task scope and time are ready for a task-specific decision.", time: "Now", tab: "profile" });
  else if (youthApprovedTaskId && (persona === "guardian" || persona === "youth")) notices.unshift({ icon: ShieldCheck, title: "Youth task approved", copy: "Approval covers only this task, scope, and scheduled time; no assignment exists until acceptance.", time: "Now", tab: "profile" });
  else if (persona === "guardian" && guardianSupervisedTaskId) notices.unshift({ icon: ShieldCheck, title: "Youth task lifecycle", copy: guardianSupervisionStatus || "Sam’s task remains visible for task-specific guardian context.", time: "Now", tab: "profile" });
  if (lifecycleTask && activeMatch) {
    // Once the start is close, the countdown leads: it is the only notice whose
    // wording changes with the clock, so it goes first and says where to go.
    const arrivalStage = jobStageFor(lifecycleTask, new Date());
    const arrivalStart = arrivalStage === "soon" || arrivalStage === "now" ? lifecycleTask.startsAt : undefined;
    if (arrivalStart) {
      const arrivalAddress = lifecycleTask.ownerId ? lifecycleTask.privateAddress?.trim() : getTaskDetails(lifecycleTask).address;
      notices.unshift({
        icon: NavigationArrow,
        title: `${countdownLabel(new Date(), arrivalStart)} · ${lifecycleTask.title}`,
        copy: arrivalAddress ? `Head to ${arrivalAddress}. The address and scope are on the job card in Nearby.` : "The protected address is unavailable. Do not travel yet; retry the matched task details in Nearby.",
        time: "Now",
        tab: "nearby",
      });
    }
    notices.push(
      { icon: SealCheck, title: "Match confirmed", copy: `${lifecycleTask.title} has protected task details ready for this profile.`, time: "2m", tab: "activity" },
      { icon: ChatCircle, title: "Task thread ready", copy: "Use the protected thread for arrival, scope changes, and safety context.", time: "7m", tab: "messages" },
      { icon: CalendarBlank, title: "Start-window support", copy: `${lifecycleTask.time}. Arrival tools remain with this commitment.`, time: "1h", tab: "activity" },
    );
  }
  // What the other side did. These lead the list: an acceptance or a reply is
  // the only thing here that came from another person rather than from this
  // device's own fixtures.
  for (const notice of collaborationNotices(collaboration, auth.session?.user.id ?? null).reverse()) {
    notices.unshift(notice);
  }
  if (lifecycleTask && moderationHolds[lifecycleTask.id]) notices.push({ icon: Warning, title: "Support review is open", copy: "Participant actions remain paused; only support authority can resolve the task report.", time: "Now", tab: "activity" });
  if (latestEvent) notices.push({ icon: CheckCircle, title: "Latest task record", copy: latestEvent.text, time: "Now", tab: "activity" });
  if (lifecycleTask?.mode !== "community" && (paidStage === "Payout released" || paidStage === "Completed")) notices.push({ icon: CurrencyDollar, title: "Test payout receipt", copy: "No real money moved; the simulated receipt remains in Payments & payouts.", time: "Now", tab: "profile" });
  return <MobileScroll className="app-screen route-scroll"><div className="route-page route-bottom-pad"><p className="eyebrow">Seeded in-app events</p><h1>Useful, not noisy.</h1><p className="lead">Each notice names the task state and opens the place where someone can act.</p>{!notificationsEnabled ? <div className="truth-card" role="status"><Bell size={21} /><div><strong>Task notifications are paused</strong><span>Existing in-app records remain visible. No push delivery is connected.</span><button className="text-button" onClick={() => setNotificationsEnabled(true)}>Turn on for this profile</button></div></div> : null}<div className="notification-list">{notices.map(({ icon: NoticeIcon, title, copy, time, tab, task }) => <button key={`${title}·${copy}`} className="notification-row" onClick={() => task ? openJob(task) : openTab(tab)}><span className="notification-icon"><NoticeIcon size={20} weight="fill" /></span><span><strong>{title}</strong><small>{copy}</small></span><time>{time}</time></button>)}</div><div className="demo-card"><Info size={20} /><div><strong>Local fixtures only</strong><span>Push delivery and notification preferences need a live account and backend later.</span></div></div></div></MobileScroll>;
}

function makeCommunityJourneyScreen(task: Task): FlowScreen {
  return { id: `community-${task.id}`, headerHeight: 66, header: (flow) => <RouteHeader title="Community commitment" onBack={flow.pop} />, render: () => <CommunityJourney task={task} /> };
}

function participantAssignmentFor(collaboration: CollaborationState, taskId: string, userId: string | null) {
  if (!userId) return null;
  return collaboration.assignments.find((assignment) =>
    assignment.taskId === taskId &&
    (assignment.requesterId === userId || assignment.helperId === userId),
  ) ?? null;
}

function LiveAssignmentSyncState({ task }: { task: Task }) {
  const { collaboration, setActiveTab } = useMicro();
  return <MobileScroll className="app-screen route-scroll"><div className="route-page route-bottom-pad"><section className="success-view compact-success" role="status" aria-live="polite"><span className="success-seal purple"><ShieldCheck size={42} weight="fill" /></span><p className="eyebrow">Protected match check</p><h1>{collaboration.loading ? "Loading your live role…" : "Live controls are locked."}</h1><p>{collaboration.loading ? "Micro is confirming whether this account is the requester or helper." : "The server assignment did not load, so Micro will not substitute browser-only requester or helper controls."}</p>{collaboration.error ? <p className="form-error" role="alert">{collaboration.error}</p> : null}<div className="success-actions"><button className="primary-button" disabled={collaboration.loading} onClick={() => { void collaboration.refresh(); }}>{collaboration.loading ? "Checking…" : "Retry protected match"}</button><button className="secondary-button" onClick={() => setActiveTab("messages")}>Open Messages</button></div><p className="fine-print">Task: {task.title}</p></section></div></MobileScroll>;
}

/**
 * A real two-account match never exposes the fixture perspective switch or
 * browser-only completion controls. Each person gets only the action their
 * server role permits, and the other device observes the RPC through Realtime.
 */
function LiveAssignmentJourney({ task, assignment }: { task: Task; assignment: TaskAssignment }) {
  const flow = useFlow();
  const auth = useAuth();
  const { collaboration, setActiveTab, setAcceptedTaskIds, setClosedTaskIds, setCommunityStage, setPaidStage, setTaskEvents } = useMicro();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const userId = auth.session?.user.id ?? null;
  const isRequester = assignment.requesterId === userId;
  const isHelper = assignment.helperId === userId;
  const active = assignment.status === "accepted";
  const statusLabel = assignment.status === "completed" ? "Completed" : assignment.status === "withdrawn" ? "Commitment ended" : "Matched";
  const roleLabel = isRequester ? "Requester" : isHelper ? (task.mode === "community" ? "Volunteer" : "Helper") : "Participant";

  const settle = async () => {
    if (!active || busy || (!isRequester && !isHelper)) return;
    setBusy(true);
    setError("");
    const result = isRequester
      ? await collaboration.completeAssignment(assignment.id)
      : await collaboration.withdrawAssignment(assignment.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "Micro could not update this match.");
      return;
    }
    setAcceptedTaskIds((current) => current.filter((id) => id !== task.id));
    if (isRequester) {
      setClosedTaskIds((current) => current.includes(task.id) ? current : [task.id, ...current]);
      if (task.mode === "community") setCommunityStage("Completed");
      else setPaidStage("Completed");
      appendTaskEvent(setTaskEvents, task.id, "Requester marked the live match complete. The listing was paused and the participant thread retained.");
    } else {
      if (task.mode === "community") setCommunityStage("Canceled");
      else setPaidStage("Reopened");
      appendTaskEvent(setTaskEvents, task.id, "Helper withdrew from the live match. The listing is available for a new eligible helper and the participant thread is retained read-only.");
    }
    setConfirmOpen(false);
  };

  return <MobileScroll className="app-screen route-scroll"><div className="route-page route-bottom-pad">
    <div className="activity-hero"><div className={`status-badge ${task.mode === "community" ? "community-status" : ""}`}>{task.mode === "community" ? <HandHeart size={14} weight="fill" /> : <ShieldCheck size={14} weight="fill" />} {statusLabel}</div><h1>{task.title}</h1><p>{roleLabel} · {task.time} · {task.area}</p></div>
    <div className="truth-card"><ShieldCheck size={22} weight="fill" /><div><strong>Live two-account match</strong><span>The assignment and private thread are stored in Supabase. This screen is locked to your actual role; no payment service is connected.</span></div></div>
    <section className="commitment-brief"><div><span>Agreed scope</span><strong>{task.included}</strong></div><div><span>Not included</span><strong>{task.excluded}</strong></div><div><span>Protected meeting place</span><strong>{task.privateAddress || "Open the matched task details before traveling"}</strong></div></section>
    <section className="workflow-card"><p className="eyebrow">{active ? "Coordinate safely" : "Retained task record"}</p><h2>{active ? `You are the ${roleLabel.toLowerCase()} in this match.` : assignment.status === "completed" ? "The requester closed this match." : "The helper ended this commitment."}</h2><p>{active ? "Keep timing, scope changes, and arrival context in the protected task thread." : "The participant thread remains readable for both accounts, but new messages and task actions are closed."}</p></section>
    <button className="secondary-button workflow-message" onClick={() => { setActiveTab("messages"); flow.pop(); }}>Open protected messages</button>
    {active && (isRequester || isHelper) ? <>
      <button className="quiet-action route-quiet-action" onClick={() => setConfirmOpen((current) => !current)}>{confirmOpen ? <X size={18} /> : isRequester ? <CheckCircle size={18} weight="fill" /> : <Warning size={18} />} {confirmOpen ? "Keep this match active" : isRequester ? "Mark this match complete" : "Withdraw from this commitment"}</button>
      {confirmOpen ? <section className="cancellation-card"><strong>{isRequester ? "Complete this live match?" : "Withdraw from this live match?"}</strong><p>{isRequester ? "The listing will be paused, both participants will keep a read-only thread, and this cannot be undone in the app." : "The listing will reopen for another eligible helper. Both participants keep this thread as a read-only record."}</p><button className={isRequester ? "primary-button" : "danger-button"} disabled={busy} onClick={() => { void settle(); }}>{busy ? "Updating…" : isRequester ? "Confirm completion" : "Confirm withdrawal"}</button></section> : null}
    </> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
  </div></MobileScroll>;
}

function CommunityJourney({ task }: { task: Task }) {
  const flow = useFlow();
  const keyboard = useKeyboard();
  const auth = useAuth();
  const { communityStage, setCommunityStage, communityChecks, setCommunityChecks, setActiveTab, reportedTaskIds, setReportedTaskIds, reportReasons, setReportReasons, moderationHolds, setModerationHolds, taskEvents, setTaskEvents, activityPerspective, setActivityPerspective, setAcceptedTaskIds, setClosedTaskIds, persona, setGuardianSupervisionStatus, completionSubmissions, setCompletionSubmissions, taskReviews, setTaskReviews, collaboration } = useMicro();
  const [arrivalOpen, setArrivalOpen] = useState(false);
  const [arrivalChecks, setArrivalChecks] = useState([false, false]);
  const serverAssignment = task.ownerId ? participantAssignmentFor(collaboration, task.id, auth.session?.user.id ?? null) : null;
  if (task.ownerId) return serverAssignment ? <LiveAssignmentJourney task={task} assignment={serverAssignment} /> : <LiveAssignmentSyncState task={task} />;
  const submission = completionSubmissions[task.id] ?? { note: "", evidencePreview: "" };
  const completionNote = submission.note;
  const setCompletionNote = (note: string) => setCompletionSubmissions((current) => ({ ...current, [task.id]: { ...(current[task.id] ?? { note: "", evidencePreview: "" }), note } }));
  const reviewState = taskReviews[task.id] ?? emptyTaskReview();
  const communityRatings = { helper: reviewState.helper.rating, requester: reviewState.requester.rating };
  const communityReviewTags = { helper: reviewState.helper.tags, requester: reviewState.requester.tags };
  const savedCommunityReviews = (["helper", "requester"] as const).filter((role) => reviewState[role].saved);
  const setCommunityRatings = (update: SetStateAction<Record<"helper" | "requester", number>>) => {
    const currentRatings = { helper: reviewState.helper.rating, requester: reviewState.requester.rating };
    const nextRatings = typeof update === "function" ? update(currentRatings) : update;
    setTaskReviews((current) => {
      const existing = current[task.id] ?? emptyTaskReview();
      return { ...current, [task.id]: { helper: { ...existing.helper, rating: nextRatings.helper }, requester: { ...existing.requester, rating: nextRatings.requester } } };
    });
  };
  const setCommunityReviewTags = (update: SetStateAction<Record<"helper" | "requester", string[]>>) => {
    const currentTags = { helper: reviewState.helper.tags, requester: reviewState.requester.tags };
    const nextTags = typeof update === "function" ? update(currentTags) : update;
    setTaskReviews((current) => {
      const existing = current[task.id] ?? emptyTaskReview();
      return { ...current, [task.id]: { helper: { ...existing.helper, tags: nextTags.helper }, requester: { ...existing.requester, tags: nextTags.requester } } };
    });
  };
  const reported = reportedTaskIds.includes(task.id) || Boolean(moderationHolds[task.id]);
  const helperView = activityPerspective === "helper";
  const reviewRole = helperView ? "helper" : "requester";
  const endCommitment = (event: string) => {
    setAcceptedTaskIds((current) => current.filter((id) => id !== task.id));
    setCommunityStage("Canceled");
    appendTaskEvent(setTaskEvents, task.id, event);
    if (persona === "youth") setGuardianSupervisionStatus("Sam’s Community Help commitment closed before completion. No payment state existed.");
    setArrivalOpen(false);
  };
  const reportIssue = () => {
    const reason = "Standard priority · Community Help scope or safety concern · no evidence attached";
    setReportedTaskIds((current) => current.includes(task.id) ? current : [...current, task.id]);
    setReportReasons((current) => ({ ...current, [task.id]: reason }));
    setModerationHolds((current) => ({ ...current, [task.id]: "Task actions are paused for support review." }));
    appendTaskEvent(setTaskEvents, task.id, "Community Help issue reported; completion review paused for support.");
    if (persona === "youth") setGuardianSupervisionStatus("Sam’s Community Help task is paused for support review.");
  };
  const action = () => {
    keyboard.hide();
    if (helperView && communityStage === "Committed") {
      setCommunityStage("Checked in");
      appendTaskEvent(setTaskEvents, task.id, "Volunteer checked in at the shared public location.");
      if (persona === "youth") setGuardianSupervisionStatus("Sam checked in for the guardian-approved Community Help task.");
    }
    else if (helperView && communityStage === "Checked in" && communityChecks.every(Boolean) && completionNote.trim().length >= 8) {
      setCommunityStage("Completion pending");
      appendTaskEvent(setTaskEvents, task.id, `Volunteer submitted completion: ${completionNote.trim()}`);
      if (persona === "youth") setGuardianSupervisionStatus("Sam submitted Community Help completion and is waiting for requester confirmation.");
    }
    else if (helperView && communityStage === "Completion pending") setActivityPerspective("requester");
    else if (!helperView && communityStage === "Completion pending" && !reported) {
      setCommunityStage("Completed");
      setAcceptedTaskIds((current) => current.filter((id) => id !== task.id));
      setClosedTaskIds((current) => current.includes(task.id) ? current : [...current, task.id]);
      appendTaskEvent(setTaskEvents, task.id, "Requester confirmed completion. Volunteer service time was added; no payment state was created.");
      if (persona === "youth") setGuardianSupervisionStatus("Sam’s Community Help task was confirmed complete and service time was added.");
    }
  };
  const saveCommunityReview = () => {
    const rating = communityRatings[reviewRole];
    const tags = communityReviewTags[reviewRole];
    if (!rating || !tags.length || savedCommunityReviews.includes(reviewRole)) return;
    setTaskReviews((current) => {
      const existing = current[task.id] ?? emptyTaskReview();
      return { ...current, [task.id]: { ...existing, [reviewRole]: { ...existing[reviewRole], saved: true } } };
    });
    appendTaskEvent(setTaskEvents, task.id, `${helperView ? "Volunteer" : "Requester"} saved a ${rating}-star Community Help review with ${tags.join(", ").toLowerCase()} tags.`);
    if (persona === "youth") setGuardianSupervisionStatus(`Sam’s Community Help task is complete; the ${helperView ? "volunteer" : "requester"} review was saved.`);
  };
  const actionLabel = communityStage === "Committed" ? helperView ? "Check in for volunteer task" : "Switch to volunteer check-in" : communityStage === "Checked in" ? helperView ? "Submit volunteer completion" : "Switch to volunteer checklist" : helperView ? "Switch to requester review" : "Confirm volunteer completion";
  const actionDisabled = reported || (helperView && communityStage === "Checked in" && (!communityChecks.every(Boolean) || completionNote.trim().length < 8));
  return <MobileScroll className="app-screen route-scroll"><div className="route-page route-bottom-pad"><div className="activity-hero"><div className="status-badge community-status"><HandHeart size={14} weight="fill" /> {reported ? "Support review" : communityStage}</div><h1>{task.title}</h1><p>{task.time} · {task.area}</p></div><fieldset className="perspective-switch route-perspective"><legend>Viewing this matched task as</legend><div className="segmented-row two-segments"><button aria-pressed={helperView} data-active={helperView ? "true" : "false"} onClick={() => setActivityPerspective("helper")}>Volunteer</button><button aria-pressed={!helperView} data-active={!helperView ? "true" : "false"} onClick={() => setActivityPerspective("requester")}>Requester</button></div></fieldset><div className="notice-card community-notice"><HandHeart size={22} weight="fill" /><div><strong>No payment or payout steps</strong><span>This is a Community Help commitment. Check-in, scope, messages, review, and safety tools remain available.</span></div></div><section className="commitment-brief"><div><span>Agreed scope</span><strong>{task.included}</strong></div><div><span>Not included</span><strong>{task.excluded}</strong></div><div><span>Meeting place</span><strong>{getTaskDetails(task).address}</strong></div></section>{communityStage === "Committed" ? <section className="workflow-card"><p className="eyebrow">{helperView ? "Arrive together" : "Waiting for volunteer"}</p><h2>{helperView ? "Check in at the shared public place." : "The volunteer has not checked in yet."}</h2><p>{helperView ? "Only check in after both people agree the task still matches the posted scope." : "Use the task thread for timing changes. Requester confirmation comes only after a completion submission."}</p></section> : null}{communityStage === "Committed" ? <><button className="quiet-action route-quiet-action" onClick={() => setArrivalOpen((current) => !current)}>{arrivalOpen ? <X size={18} /> : <Warning size={18} />} {arrivalOpen ? "Keep this commitment" : "Cancel or report an arrival issue"}</button>{arrivalOpen ? <section className="cancellation-card"><strong>End this volunteer commitment?</strong><p>Community Help never creates a payment or show-up fee. A cancellation or verified no-show releases this commitment and keeps its task record.</p><button className="secondary-button" onClick={() => endCommitment(`${helperView ? "Volunteer" : "Requester"} canceled the Community Help commitment before check-in; no payment state existed.`)}>Cancel commitment</button>{["I was at the agreed place and time", "I messaged in the task thread and waited 15 minutes"].map((label, index) => <button key={label} className="check-choice" aria-pressed={arrivalChecks[index]} onClick={() => setArrivalChecks((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value))}><span className="checkbox">{arrivalChecks[index] ? <Check size={14} weight="bold" /> : null}</span>{label}</button>)}<button className="danger-button" disabled={!arrivalChecks.every(Boolean)} onClick={() => endCommitment(helperView ? "Volunteer reported requester unavailable after arrival, a task-thread message, and the 15-minute grace period; no payment state existed." : "Requester reported volunteer no-show after a task-thread message and the 15-minute grace period; no payment state existed.")}>Record {helperView ? "requester unavailable" : "volunteer no-show"}</button></section> : null}</> : null}{communityStage === "Checked in" ? <section className="workflow-card"><p className="eyebrow">{helperView ? "Before submitting" : "Volunteer checked in"}</p><h2>{helperView ? "Volunteer completion checklist" : "The volunteer is working within the agreed scope."}</h2>{helperView ? <>{["The posted scope is finished", "The area is tidy and any borrowed items are returned"].map((label,index) => <button key={label} className="check-choice" aria-pressed={communityChecks[index]} onClick={() => setCommunityChecks((current) => current.map((value,itemIndex) => itemIndex === index ? !value : value))}><span className="checkbox">{communityChecks[index] ? <Check size={14} weight="bold" /> : null}</span>{label}</button>)}<label className="field-label-block completion-note">Completion note<KeyboardTextarea rows={3} value={completionNote} onChange={(event) => setCompletionNote(event.target.value)} onBlur={() => keyboard.hide()} placeholder="What was completed or left for the requester?" /></label></> : <p>Requester confirmation is not available until the volunteer submits the checklist and note.</p>}</section> : null}{communityStage === "Checked in" && !reported ? <button className="quiet-action route-quiet-action" onClick={reportIssue}><Warning size={18} /> Pause for a safety or scope issue</button> : null}{communityStage === "Completion pending" ? <section className="workflow-card" role="status"><CheckCircle size={31} weight="fill" /><h2>{reported ? "Community review paused" : helperView ? "Waiting for requester confirmation" : "Review the volunteer’s completion"}</h2><p>{reported ? "A safety or scope report is open. Only support authority can resume this local workflow." : helperView ? "You cannot confirm your own work. Switch to the seeded requester view to test the handoff." : `Completion criteria: ${task.completion ?? "The posted scope is complete."}`}</p>{(reportReasons[task.id] ?? moderationHolds[task.id]) ? <p className="fine-print">Recorded issue: {reportReasons[task.id] ?? moderationHolds[task.id]}</p> : null}{reported ? <div className="status-receipt"><ShieldCheck size={18} weight="fill" /> Awaiting support review; participants cannot clear their own report.</div> : <button className="secondary-button issue-button" onClick={reportIssue}><Warning size={18} /> Report an issue</button>}</section> : null}{communityStage === "Completed" ? <><section className="success-view compact-success" role="status"><span className="success-seal"><CheckCircle size={42} weight="fill" /></span><h2>Volunteer commitment complete.</h2><p>The task moved to service history. No payment or payout state was created.</p><div className="status-receipt"><Clock size={18} /> {task.duration} added to the local service-hours record.</div></section><section className="workflow-card community-review-card"><p className="eyebrow">{helperView ? "Volunteer reflection" : "Requester reflection"}</p><h2>Leave a task-specific review.</h2><p>The other participant’s review stays separate. Switch perspectives to test both sides.</p>{savedCommunityReviews.includes(reviewRole) ? <div className="status-receipt"><CheckCircle size={18} weight="fill" /> {helperView ? "Volunteer" : "Requester"} review saved in this local session.</div> : <><div className="star-row" role="radiogroup" aria-label={`${helperView ? "Volunteer" : "Requester"} review rating`}>{[1,2,3,4,5].map((star) => <button key={star} role="radio" aria-checked={communityRatings[reviewRole] === star} aria-label={`${star} stars`} onClick={() => setCommunityRatings((current) => ({ ...current, [reviewRole]: star }))}><Star size={25} weight={communityRatings[reviewRole] >= star ? "fill" : "regular"} /></button>)}</div><div className="review-tag-row">{(helperView ? ["Clear scope", "Kind requester", "Safe setting"] : ["On time", "Careful help", "Good communication"]).map((tag) => <button key={tag} aria-pressed={communityReviewTags[reviewRole].includes(tag)} data-active={communityReviewTags[reviewRole].includes(tag) ? "true" : "false"} onClick={() => setCommunityReviewTags((current) => ({ ...current, [reviewRole]: current[reviewRole].includes(tag) ? current[reviewRole].filter((item) => item !== tag) : [...current[reviewRole], tag] }))}>{communityReviewTags[reviewRole].includes(tag) ? <Check size={13} weight="bold" /> : null}{tag}</button>)}</div><button className="primary-button community-review-save" disabled={!communityRatings[reviewRole] || !communityReviewTags[reviewRole].length} onClick={saveCommunityReview}>Save {helperView ? "volunteer" : "requester"} review</button></>}</section></> : null}{communityStage === "Canceled" ? <section className="success-view compact-success" role="status"><span className="success-seal"><HandHeart size={42} weight="fill" /></span><h2>Volunteer commitment closed.</h2><p>The task record remains available in Messages. No payment, payout, or show-up fee was created.</p></section> : null}{taskEvents[task.id]?.length ? <section className="task-event-list compact-events"><span>Latest task record</span><p><Clock size={16} /> {taskEvents[task.id][taskEvents[task.id].length - 1].text}</p></section> : null}<button className="secondary-button workflow-message" onClick={() => { setActiveTab("messages"); flow.pop(); }}>Go to task messages</button>{communityStage !== "Completed" && communityStage !== "Canceled" ? <button className="primary-button workflow-cta" disabled={actionDisabled} onClick={action}>{actionLabel}</button> : null}</div></MobileScroll>;
}

function makeActivityJourneyScreen(task: Task): FlowScreen {
  return {
    id: "activity-journey",
    headerHeight: 66,
    header: (flow) => <RouteHeader title="Task activity" onBack={flow.pop} />,
    render: () => <ActivityJourney task={task} />,
  };
}

function ActivityJourney({ task }: { task: Task }) {
  const flow = useFlow();
  const keyboard = useKeyboard();
  const auth = useAuth();
  const { paidStage, setPaidStage, setActiveTab, reportedTaskIds, setReportedTaskIds, reportReasons, setReportReasons, moderationHolds, setModerationHolds, taskEvents, setTaskEvents, activityPerspective, setActivityPerspective, setAcceptedTaskIds, setClosedTaskIds, persona, setGuardianSupervisionStatus, completionSubmissions, setCompletionSubmissions, taskReviews, setTaskReviews, collaboration } = useMicro();
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [checks, setChecks] = useState([false, false]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const serverAssignment = task.ownerId ? participantAssignmentFor(collaboration, task.id, auth.session?.user.id ?? null) : null;
  if (task.ownerId) return serverAssignment ? <LiveAssignmentJourney task={task} assignment={serverAssignment} /> : <LiveAssignmentSyncState task={task} />;
  const issueReported = reportedTaskIds.includes(task.id) || Boolean(moderationHolds[task.id]);
  const helperView = activityPerspective === "helper";
  const reviewRole = helperView ? "helper" : "requester";
  const submission = completionSubmissions[task.id] ?? { note: "", evidencePreview: "" };
  const completionNote = submission.note;
  const evidencePreview = submission.evidencePreview;
  const updateSubmission = (patch: Partial<CompletionSubmission>) => setCompletionSubmissions((current) => ({ ...current, [task.id]: { ...(current[task.id] ?? { note: "", evidencePreview: "" }), ...patch } }));
  const setCompletionNote = (note: string) => updateSubmission({ note });
  const setEvidencePreview = (preview: string) => updateSubmission({ evidencePreview: preview });
  const currentReview = (taskReviews[task.id] ?? emptyTaskReview())[reviewRole];
  const rating = currentReview.rating;
  const reviewTags = currentReview.tags;
  const setRating = (nextRating: number) => setTaskReviews((current) => {
    const existing = current[task.id] ?? emptyTaskReview();
    return { ...current, [task.id]: { ...existing, [reviewRole]: { ...existing[reviewRole], rating: nextRating } } };
  });
  const setReviewTags = (update: SetStateAction<string[]>) => setTaskReviews((current) => {
    const existing = current[task.id] ?? emptyTaskReview();
    const existingTags = existing[reviewRole].tags;
    const nextTags = typeof update === "function" ? update(existingTags) : update;
    return { ...current, [task.id]: { ...existing, [reviewRole]: { ...existing[reviewRole], tags: nextTags } } };
  });
  const reportIssue = () => {
    const reason = `Urgent workflow pause · scope or safety concern · ${evidencePreview ? "photo evidence attached in local session" : "no evidence attached"}`;
    setReportedTaskIds((current) => current.includes(task.id) ? current : [...current, task.id]);
    setReportReasons((current) => ({ ...current, [task.id]: reason }));
    setModerationHolds((current) => ({ ...current, [task.id]: "Task actions are paused for support review." }));
    appendTaskEvent(setTaskEvents, task.id, "Task issue reported; start or payout review paused for support.");
    if (persona === "youth") setGuardianSupervisionStatus("Sam’s paid task is paused for support review.");
  };
  const stages: PaidStage[] = ["Payment secured", "In progress", "Completion pending", "Payout released", "Completed"];
  const currentIndex = Math.max(0, stages.indexOf(paidStage));

  const nextAction = () => {
    keyboard.hide();
    if (!helperView && (paidStage === "Payment secured" || paidStage === "In progress")) {
      setActivityPerspective("helper");
      return;
    }
    if (helperView && paidStage === "Payment secured") {
      if (pin !== "4821") { setPinError("That demo PIN does not match. Ask the requester or use 4821."); return; }
      setPinError("");
      setPaidStage("In progress");
      appendTaskEvent(setTaskEvents, task.id, "Start PIN confirmed. Test payment capture recorded; no real money moved.");
      if (persona === "youth") setGuardianSupervisionStatus("Sam started the guardian-approved task. Test payment capture was recorded.");
    }
    else if (helperView && paidStage === "In progress") {
      setPaidStage("Completion pending");
      appendTaskEvent(setTaskEvents, task.id, `Helper submitted completion: ${completionNote.trim()}${evidencePreview ? " Evidence preview attached." : ""}`);
      if (persona === "youth") setGuardianSupervisionStatus("Sam submitted completion and is waiting for requester confirmation.");
    }
    else if (helperView && paidStage === "Completion pending") setActivityPerspective("requester");
    else if (!helperView && paidStage === "Completion pending" && !issueReported) {
      setPaidStage("Payout released");
      appendTaskEvent(setTaskEvents, task.id, `Requester confirmed completion. $${task.earning ?? 0} test payout released.`);
      if (persona === "youth") setGuardianSupervisionStatus(`Sam’s completion was confirmed; a $${task.earning ?? 0} test payout was recorded.`);
    }
    else if (paidStage === "Payout released" && rating > 0 && reviewTags.length > 0) {
      setTaskReviews((current) => {
        const existing = current[task.id] ?? emptyTaskReview();
        return { ...current, [task.id]: { ...existing, [reviewRole]: { ...existing[reviewRole], saved: true } } };
      });
      setPaidStage("Completed");
      setAcceptedTaskIds((current) => current.filter((id) => id !== task.id));
      setClosedTaskIds((current) => current.includes(task.id) ? current : [...current, task.id]);
      appendTaskEvent(setTaskEvents, task.id, `${helperView ? "Helper" : "Requester"} left a ${rating}-star review with ${reviewTags.join(", ").toLowerCase()} tags. Task closed.`);
      if (persona === "youth") setGuardianSupervisionStatus("Sam’s guardian-approved task is complete and closed.");
    }
  };
  const actionLabel = paidStage === "Payment secured" ? helperView ? "Start task" : "Switch to helper start" : paidStage === "In progress" ? helperView ? "Submit completion" : "Switch to helper work" : paidStage === "Completion pending" ? helperView ? "Switch to requester review" : "Confirm completion & release payout" : paidStage === "Payout released" ? "Finish review" : "Task completed";
  const actionDisabled = issueReported || (helperView && paidStage === "Payment secured" ? pin.length !== 4 : helperView && paidStage === "In progress" ? !checks.every(Boolean) || completionNote.trim().length < 8 : paidStage === "Payout released" ? rating === 0 || reviewTags.length === 0 : false);

  if (paidStage === "Reopened") return <MobileScroll className="app-screen route-scroll"><div className="route-page route-bottom-pad"><section className="success-view reopened-view" role="status" aria-live="polite"><span className="success-seal"><Warning size={42} weight="fill" /></span><p className="eyebrow">Needs a new match</p><h1>The task was reopened.</h1><p>The test payment hold was released after the reported no-show. No helper is currently assigned.</p><div className="truth-card"><Info size={22} /><div><strong>No real charge or refund occurred</strong><span>The listing can be matched again from Nearby.</span></div></div><button className="primary-button" onClick={() => { flow.pop(); }}>Back to Activity</button></section></div></MobileScroll>;

  return (
    <MobileScroll className="app-screen route-scroll">
      <div className="route-page route-bottom-pad">
        <div className="activity-hero"><div className="status-badge"><ShieldCheck size={14} weight="fill" /> {issueReported ? "Support review" : paidStage}</div><h1>{task.title}</h1><p>{task.time} · {task.area}</p></div>
        <fieldset className="perspective-switch route-perspective"><legend>Viewing this matched task as</legend><div className="segmented-row two-segments"><button aria-pressed={helperView} data-active={helperView ? "true" : "false"} onClick={() => setActivityPerspective("helper")}>Helper</button><button aria-pressed={!helperView} data-active={!helperView ? "true" : "false"} onClick={() => setActivityPerspective("requester")}>Requester</button></div></fieldset>
        <div className="test-mode-banner"><Info size={19} /><span><strong>Test mode:</strong> no real money moves.</span></div>
        {issueReported ? <div className="status-receipt" role="status"><Warning size={18} weight="fill" /> A task report is open. Starting and automatic payout review are paused.</div> : null}
        <section className="commitment-brief"><div><span>Agreed scope</span><strong>{task.included}</strong></div><div><span>Not included</span><strong>{task.excluded}</strong></div><div><span>Protected meeting place</span><strong>{getTaskDetails(task).address}</strong></div></section>
        <section className="timeline" aria-label="Task status timeline">
          {stages.map((stage, index) => (
            <div key={stage} className="timeline-row" data-complete={index <= currentIndex ? "true" : "false"}>
              <span className="timeline-dot">{index < currentIndex ? <Check size={12} weight="bold" /> : null}</span>
              <div><strong>{stage}</strong><span>{index === currentIndex ? "Current status" : index < currentIndex ? "Complete" : "Not yet"}</span></div>
            </div>
          ))}
        </section>
        {paidStage === "Payment secured" ? <section className="workflow-card"><p className="eyebrow">{helperView ? "Start together" : "Waiting for arrival"}</p><h2>{helperView ? "Enter the requester’s 4-digit PIN" : "The helper has not started yet."}</h2><p>{helperView ? "Only enter the PIN after you arrive and both agree the task matches the posted scope." : "Keep timing changes in the task thread. If the helper is absent after the grace period, use arrival support."}</p>{helperView ? <div className="pin-row"><KeyboardInput aria-label="Four digit start PIN" inputMode="numeric" maxLength={4} value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(""); }} onBlur={() => keyboard.hide()} placeholder="••••" /><button className="text-button" onClick={() => { keyboard.hide(); setPin("4821"); }}>Use demo PIN</button></div> : <button className="secondary-button issue-button" onClick={() => flow.push(makeNoShowScreen())}><Warning size={18} /> Open helper no-show support</button>}{pinError ? <p className="form-error" role="alert">{pinError}</p> : null}</section> : null}
        {paidStage === "In progress" ? <><div className="status-receipt" role="status"><CheckCircle size={18} weight="fill" /> Test payment capture confirmed. No real money moved.</div><section className="workflow-card"><p className="eyebrow">{helperView ? "Before submitting" : "Work in progress"}</p><h2>{helperView ? "Completion checklist" : "The helper is working within the agreed scope."}</h2>{helperView ? <>{["The posted scope is finished", "The area is tidy and tools are returned"].map((label, index) => <button key={label} className="check-choice" aria-pressed={checks[index]} onClick={() => setChecks((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value))}><span className="checkbox">{checks[index] ? <Check size={14} weight="bold" /> : null}</span>{label}</button>)}<label className="field-label-block completion-note">Completion note<KeyboardTextarea rows={3} value={completionNote} onChange={(event) => setCompletionNote(event.target.value)} onBlur={() => keyboard.hide()} placeholder="What was completed or left for the requester?" /></label><div className="photo-upload-block evidence-upload"><div><strong>Optional completion evidence</strong><span>Add a privacy-safe photo only when it helps confirm the posted scope.</span></div>{evidencePreview ? <figure className="post-photo-preview"><img src={evidencePreview} alt="Selected completion evidence preview" /><button className="text-button" onClick={() => setEvidencePreview("")}>Remove evidence</button></figure> : <label className="photo-upload-button"><Plus size={18} weight="bold" /> Add evidence<input type="file" accept="image/*" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setEvidencePreview(typeof reader.result === "string" ? reader.result : ""); reader.readAsDataURL(file); }} /></label>}</div><p className="fine-print">Completion submission begins the requester’s 24-hour review window.</p></> : <p>Requester confirmation is unavailable until the helper submits the checklist and completion note.</p>}</section></> : null}
        {(paidStage === "Payment secured" || paidStage === "In progress") && !issueReported ? <button className="quiet-action route-quiet-action" onClick={reportIssue}><Warning size={18} /> Pause for a safety or scope issue</button> : null}
        {paidStage === "Completion pending" ? <section className="workflow-card" role="status" aria-live="polite"><CheckCircle size={31} weight="fill" /><h2>{issueReported ? "Review paused" : helperView ? "Waiting for requester confirmation" : "Review the helper’s completion"}</h2><p>{issueReported ? "An issue was recorded in this local prototype. Only support authority can resume payout review." : helperView ? "You cannot confirm your own work. Switch to the seeded requester view to test the protected handoff." : `Completion criteria: ${task.completion ?? "The posted scope is complete."}`}</p>{completionNote ? <div className="submission-note"><span>Helper note</span><strong>{completionNote}</strong>{evidencePreview ? <small>Privacy-safe evidence preview attached</small> : <small>No photo evidence attached</small>}</div> : null}{(reportReasons[task.id] ?? moderationHolds[task.id]) ? <p className="fine-print">Recorded issue: {reportReasons[task.id] ?? moderationHolds[task.id]}</p> : null}{issueReported ? <div className="status-receipt"><ShieldCheck size={18} weight="fill" /> Awaiting support review; participants cannot clear their own report.</div> : <button className="secondary-button issue-button" onClick={reportIssue}><Warning size={18} /> Report an issue</button>}</section> : null}
        {paidStage === "Payout released" ? <section className="workflow-card"><CurrencyDollar size={31} weight="fill" /><h2>${task.earning ?? 0} payout released</h2><p>This is a simulated payout state. Leave a task-specific review as the {helperView ? "helper" : "requester"}; the other participant’s review remains separate.</p><div className="star-row" role="radiogroup" aria-label="Review rating">{[1,2,3,4,5].map((star) => <button key={star} role="radio" aria-checked={rating === star} aria-label={`${star} stars`} onClick={() => setRating(star)}><Star size={25} weight={rating >= star ? "fill" : "regular"} /></button>)}</div><div className="review-tag-row">{(helperView ? ["Clear scope", "Kind requester", "Easy coordination"] : ["On time", "Careful work", "Good communication"]).map((tag) => <button key={tag} aria-pressed={reviewTags.includes(tag)} data-active={reviewTags.includes(tag) ? "true" : "false"} onClick={() => setReviewTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])}>{reviewTags.includes(tag) ? <Check size={13} weight="bold" /> : null}{tag}</button>)}</div>{rating === 0 || !reviewTags.length ? <p className="fine-print">Choose a rating and at least one specific tag to finish.</p> : null}</section> : null}
        {paidStage === "Completed" ? <section className="success-view compact-success"><span className="success-seal"><CheckCircle size={42} weight="fill" /></span><h2>Small task, fully closed.</h2><p>Your private task thread remains available for records and support.</p>{currentReview.saved ? <div className="status-receipt"><Star size={18} weight="fill" /> {rating}-star {helperView ? "helper" : "requester"} review saved · {reviewTags.join(" · ")}</div> : null}</section> : null}
        {taskEvents[task.id]?.length ? <section className="task-event-list compact-events"><span>Latest task record</span><p><Clock size={16} /> {taskEvents[task.id][taskEvents[task.id].length - 1].text}</p></section> : null}
        <button className="secondary-button workflow-message" onClick={() => { setActiveTab("messages"); flow.pop(); }}>Go to task messages</button>
        {paidStage === "Payment secured" && !issueReported ? <button className="quiet-action route-quiet-action" onClick={() => setCancelOpen((current) => !current)}>{cancelOpen ? <X size={18} /> : <Warning size={18} />} {cancelOpen ? "Keep commitment" : "Cancel this commitment"}</button> : null}
        {cancelOpen ? <section className="cancellation-card"><strong>Cancel before the task starts?</strong><p>The local payment hold will be released, the helper assignment removed, and the listing reopened.</p><button className="danger-button" onClick={() => { setAcceptedTaskIds((current) => current.filter((id) => id !== task.id)); setPaidStage("Reopened"); appendTaskEvent(setTaskEvents, task.id, `${helperView ? "Helper" : "Requester"} canceled before start; test hold released and listing reopened.`); if (persona === "youth") setGuardianSupervisionStatus("Sam’s task was canceled before start; the test hold was released and the listing reopened."); setCancelOpen(false); }}>Confirm cancellation</button></section> : null}
        {paidStage !== "Completed" ? <button className="primary-button workflow-cta" disabled={actionDisabled} onClick={nextAction}>{actionLabel}</button> : null}
      </div>
    </MobileScroll>
  );
}

function makeNoShowScreen(): FlowScreen {
  return { id: "no-show", headerHeight: 66, header: (flow) => <RouteHeader title="Arrival issue" onBack={flow.pop} />, render: (flow) => <NoShowScreen onDone={flow.pop} /> };
}

function NoShowScreen({ onDone }: { onDone: () => void }) {
  const { setPaidStage, activeTask, setAcceptedTaskIds, setTaskEvents, persona, setGuardianSupervisionStatus } = useMicro();
  const [reported, setReported] = useState(false);
  const [graceConfirmed, setGraceConfirmed] = useState(false);
  return (
    <MobileScroll className="app-screen route-scroll">
      <div className="route-page route-bottom-pad">
        {!reported ? <>
          <div className="alert-illustration"><Clock size={38} weight="duotone" /></div><p className="eyebrow">Arrival support</p><h1>The helper hasn’t arrived.</h1><p className="lead">First, check the task thread. If the 15-minute grace period has passed, you can report a no-show.</p>
          <div className="review-list"><ReviewRow icon={ChatCircle} title="Message once" text="Ask if they are delayed. Keep contact inside the task thread." /><ReviewRow icon={Clock} title="Wait 15 minutes" text="A short grace period prevents accidental reports." /><ReviewRow icon={ShieldCheck} title="Release the hold" text="Reporting a confirmed no-show releases the test payment hold and reopens the task." /></div>
          <button className="choice-row safety-confirm" aria-pressed={graceConfirmed} data-selected={graceConfirmed ? "true" : "false"} onClick={() => setGraceConfirmed((current) => !current)}><span><strong>I messaged once and waited 15 minutes</strong><small>This confirmation is required before reopening.</small></span><span className="checkbox">{graceConfirmed ? <Check size={14} weight="bold" /> : null}</span></button>
          <button className="danger-button" disabled={!graceConfirmed} onClick={() => { setAcceptedTaskIds((current) => current.filter((id) => id !== activeTask.id)); setPaidStage("Reopened"); appendTaskEvent(setTaskEvents, activeTask.id, "Requester reported helper no-show after the message and 15-minute grace checks. Test hold released; task reopened."); if (persona === "youth") setGuardianSupervisionStatus("Sam’s task was reopened after a helper no-show report; the test hold was released."); setReported(true); }}>Report no-show &amp; reopen</button>
        </> : <section className="success-view"><span className="success-seal"><CheckCircle size={46} weight="fill" /></span><p className="eyebrow">Task reopened</p><h1>The payment hold was released.</h1><p>The no-show is recorded in this prototype, and the task is available to match again.</p><div className="truth-card"><Info size={22} /><div><strong>Test mode</strong><span>No real charge or refund occurred.</span></div></div><button className="primary-button" onClick={onDone}>Back to Activity</button></section>}
      </div>
    </MobileScroll>
  );
}

function makeRequesterNoShowScreen(task: Task): FlowScreen {
  return { id: "requester-no-show", headerHeight: 66, header: (flow) => <RouteHeader title="Requester unavailable" onBack={flow.pop} />, render: (flow) => <RequesterNoShowScreen task={task} onDone={flow.pop} /> };
}

function RequesterNoShowScreen({ task, onDone }: { task: Task; onDone: () => void }) {
  const { setPaidStage, setAcceptedTaskIds, setTaskEvents, persona, setGuardianSupervisionStatus } = useMicro();
  const [arrived, setArrived] = useState(false);
  const [contacted, setContacted] = useState(false);
  const [reported, setReported] = useState(false);
  const showUpAmount = Math.min(8, task.earning ?? 8);
  if (reported) return <MobileScroll className="app-screen route-scroll"><div className="route-page route-bottom-pad"><section className="success-view"><span className="success-seal"><CheckCircle size={46} weight="fill" /></span><p className="eyebrow">Arrival record saved</p><h1>${showUpAmount} show-up payment recorded.</h1><p>The remaining test hold was released and the listing reopened without blaming the helper.</p><div className="truth-card"><Info size={22} /><div><strong>Simulated receipt</strong><span>No real charge, payout, or refund occurred.</span></div></div><button className="primary-button" onClick={onDone}>Back to Activity</button></section></div></MobileScroll>;
  return <MobileScroll className="app-screen route-scroll"><div className="route-page route-bottom-pad"><div className="alert-illustration"><MapPin size={38} weight="duotone" /></div><p className="eyebrow">Helper arrival protection</p><h1>The requester isn’t available.</h1><p className="lead">Use this only after reaching the agreed place and trying the protected task thread.</p><div className="review-list"><ReviewRow icon={MapPin} title="Arrive at the agreed place" text={getTaskDetails(task).address} /><ReviewRow icon={ChatCircle} title="Message in the task thread" text="Give the requester a reasonable chance to respond without moving contact off-platform." /><ReviewRow icon={CurrencyDollar} title="Show-up protection" text={`The UI records a $${showUpAmount} helper show-up payment and releases the remaining test hold.`} /></div><button className="choice-row safety-confirm" aria-pressed={arrived} data-selected={arrived ? "true" : "false"} onClick={() => setArrived((current) => !current)}><span><strong>I arrived at the agreed place and time</strong><small>Location is a protected local fixture.</small></span><span className="checkbox">{arrived ? <Check size={14} weight="bold" /> : null}</span></button><button className="choice-row safety-confirm" aria-pressed={contacted} data-selected={contacted ? "true" : "false"} onClick={() => setContacted((current) => !current)}><span><strong>I messaged in the task thread and waited 15 minutes</strong><small>Both checks are required for the local receipt.</small></span><span className="checkbox">{contacted ? <Check size={14} weight="bold" /> : null}</span></button><button className="danger-button" disabled={!arrived || !contacted} onClick={() => { setAcceptedTaskIds((current) => current.filter((id) => id !== task.id)); setPaidStage("Reopened"); appendTaskEvent(setTaskEvents, task.id, `Helper reported requester no-show after arrival and grace checks. $${showUpAmount} test show-up payment recorded; remainder released.`); if (persona === "youth") setGuardianSupervisionStatus(`Sam reported the requester unavailable; a $${showUpAmount} test show-up payment was recorded and the task reopened.`); setReported(true); }}>Record requester no-show</button></div></MobileScroll>;
}

function makeOrganizationWorkspaceScreen(): FlowScreen {
  return { id: "organization-workspace", headerHeight: 66, header: (flow) => <RouteHeader title="Sponsorships" onBack={flow.pop} />, render: () => <OrganizationWorkspaceScreen /> };
}

function OrganizationWorkspaceScreen() {
  const flow = useFlow();
  const auth = useAuth();
  const { sponsorFunded, setActiveTab } = useMicro();
  const distanceLabel = useTaskDistanceLabel();
  const isLiveNonprofit = Boolean(auth.session && auth.organization && auth.accountType === "nonprofit");
  const canReviewRequests = auth.capabilities.can_receive_sponsorship_requests;
  const canFund = canReviewRequests && auth.capabilities.can_sponsor_tasks;
  const organizationAccess = organizationAccessDetails(auth);
  const openRequests = canReviewRequests && !sponsorFunded ? 1 : 0;

  if (!isLiveNonprofit || !auth.organization) {
    return <MobileScroll className="app-screen route-scroll"><div className="route-page route-bottom-pad"><section className="empty-state organization-guard"><LockKey size={28} weight="fill" /><h1>Organization workspace unavailable</h1><p>This route is reserved for signed-in nonprofit organization accounts. Your regular task experience is unchanged.</p><button className="secondary-button" onClick={flow.pop}>Back to Activity</button></section></div></MobileScroll>;
  }

  const openSponsoredPost = () => {
    if (!auth.capabilities.can_sponsor_tasks) return;
    setActiveTab("post");
    flow.pop();
  };

  return (
    <MobileScroll className="app-screen route-scroll">
      <div className="route-page route-bottom-pad organization-workspace-page">
        <section className="organization-workspace-hero" data-status={organizationAccess.status} aria-labelledby="organization-workspace-title">
          <div className="organization-workspace-identity">
            <span className="organization-workspace-mark"><Buildings size={27} weight="fill" /></span>
            <div><p className="eyebrow">Sponsorship workspace</p><h1 id="organization-workspace-title">{auth.organization.name}</h1><p>{auth.organization.role === "owner" ? "Organization owner" : auth.organization.role === "admin" ? "Organization admin" : "Organization member"}</p></div>
            <span className="organization-status" data-status={organizationAccess.status}>{organizationAccess.statusLabel}</span>
          </div>
          <p className="organization-workspace-summary">{organizationAccess.copy}</p>
          {canReviewRequests ? <dl className="organization-workspace-metrics" aria-label="Local sponsorship preview summary">
            <div><dt>Open requests</dt><dd>{openRequests}</dd></div>
            <div><dt>Sponsored</dt><dd>{sponsorFunded ? 1 : 0}</dd></div>
            <div><dt>Recipient total</dt><dd>$0</dd></div>
          </dl> : null}
        </section>

        <section className="activity-group" aria-labelledby="sponsorship-requests-title">
          <div className="section-heading"><h2 id="sponsorship-requests-title">{sponsorFunded ? "Recently sponsored" : "Requests to review"}</h2><span>{canReviewRequests ? 1 : 0}</span></div>
          {canReviewRequests ? <article className="sponsorship-request-card">
            <div className="sponsorship-request-top"><span className="status-badge sponsored-request-status"><Sparkle size={14} weight="fill" /> {sponsorFunded ? "Funded in preview" : "New request · preview"}</span><strong>$26 total</strong></div>
            <h3>Grocery pickup for a neighbor</h3>
            <p>A helper would pick up a prepaid grocery order and carry it to the front door. Recipient details stay protected until a safe match.</p>
            <div className="task-facts"><span><MapPin size={17} /> {sponsoredFixtureTask.area} · {distanceLabel(sponsoredFixtureTask)}</span><span><Clock size={17} /> About 45 min</span></div>
            <div className="sponsorship-request-money"><span><strong>$24</strong><small>Helper receives</small></span><span><strong>$0</strong><small>Recipient pays</small></span></div>
            <button className={canFund && !sponsorFunded ? "primary-button" : "secondary-button"} onClick={() => {
              if (!auth.capabilities.can_receive_sponsorship_requests) return;
              flow.push(makeSponsorScreen());
            }}>{sponsorFunded ? "View sponsored task" : canFund ? "Review and fund" : "View request"}</button>
          </article> : <section className="sponsorship-locked-card" aria-labelledby="sponsorship-locked-title"><span><LockKey size={23} weight="fill" /></span><div><strong id="sponsorship-locked-title">Sponsorship requests are locked</strong><p>{organizationAccess.copy}</p></div></section>}
        </section>

        {!canFund ? <section className="organization-capabilities" aria-labelledby="organization-access-title">
          <div className="section-heading"><h2 id="organization-access-title">Access details</h2></div>
          <div className="organization-capability-row" data-enabled={auth.capabilities.can_post_tasks && auth.capabilities.can_accept_tasks ? "true" : "false"}><span>{auth.capabilities.can_post_tasks && auth.capabilities.can_accept_tasks ? <CheckCircle size={19} weight="fill" /> : <LockKey size={19} weight="fill" />}</span><div><strong>Regular task features</strong><small>{auth.capabilities.can_post_tasks && auth.capabilities.can_accept_tasks ? "Posting and accepting are available for this account." : "Account permissions need to be refreshed."}</small></div></div>
          <div className="organization-capability-row" data-enabled={canReviewRequests ? "true" : "false"}><span>{canReviewRequests ? <CheckCircle size={19} weight="fill" /> : <LockKey size={19} weight="fill" />}</span><div><strong>Sponsorship requests</strong><small>{canReviewRequests ? "Review is enabled for this verified organization role." : "Unlocks only after verified organization access."}</small></div></div>
          <div className="organization-capability-row" data-enabled="false"><span><LockKey size={19} weight="fill" /></span><div><strong>Sponsorship funding</strong><small>Funding stays locked until sponsorship is enabled.</small></div></div>
        </section> : null}

        {canFund ? <section className="organization-post-card" data-enabled="true">
          <span><HandHeart size={23} weight="fill" /></span>
          <div><strong>Post a sponsored task</strong><p>Open the reviewed catalog, then choose Sponsored when the selected task supports it.</p></div>
          <button className="secondary-button" onClick={openSponsoredPost}>Open Post</button>
        </section> : null}

        <div className="truth-card organization-truth"><Info size={21} /><div><strong>Live access, local request fixtures</strong><span>Supabase controls the organization and capabilities shown here. Requests, payments, and task status remain in this browser preview; no real sponsorship or recipient record is created.</span></div></div>
      </div>
    </MobileScroll>
  );
}

function makeSponsorScreen(): FlowScreen {
  return { id: "sponsor", headerHeight: 66, header: (flow) => <RouteHeader title="Sponsor help" onBack={flow.pop} />, render: () => <SponsorScreen /> };
}

function SponsorScreen() {
  const auth = useAuth();
  const { sponsorFunded, setSponsorFunded, sponsorSeeking, setSponsorSeeking } = useMicro();
  const distanceLabel = useTaskDistanceLabel();
  const isLiveNonprofit = Boolean(auth.session && auth.organization && auth.accountType === "nonprofit");
  const canReviewRequest = auth.demoMode || (isLiveNonprofit && auth.capabilities.can_receive_sponsorship_requests);
  const canFund = auth.demoMode || (canReviewRequest && auth.capabilities.can_sponsor_tasks);
  const requestSubmitted = isLiveNonprofit || sponsorSeeking;
  const requestTitle = isLiveNonprofit ? "Grocery pickup for a neighbor" : "Grocery pickup for Ana";

  if (!canReviewRequest) {
    const organizationAccess = organizationAccessDetails(auth);
    return <MobileScroll className="app-screen route-scroll"><div className="route-page route-bottom-pad"><section className="empty-state organization-guard"><LockKey size={28} weight="fill" /><h1>Sponsorship request unavailable</h1><p>{isLiveNonprofit ? organizationAccess.copy : "Only an eligible nonprofit organization can review this local sponsorship request fixture."}</p><div className="truth-card"><ShieldCheck size={21} weight="fill" /><div><strong>Request details stay protected</strong><span>Opening a route never grants sponsorship access; Micro checks the current database capability again here.</span></div></div></section></div></MobileScroll>;
  }
  return (
    <MobileScroll className="app-screen route-scroll">
      <div className="route-page route-bottom-pad">
        {sponsorFunded ? <section className="success-view" role="status"><span className="success-seal purple"><Sparkle size={42} weight="fill" /></span><p className="eyebrow">Sponsored in test mode</p><h1>The task can now pay a helper.</h1><p>The public task shows “Sponsored” and “helper receives $24.” The recipient’s total remains $0.</p><div className="truth-card"><Info size={22} /><div><strong>No real payment was taken</strong><span>This confirms only the intended local UI state.</span></div></div></section> : <>
          <p className="eyebrow">Turn a request into paid help</p><h1>Sponsor one small task.</h1><p className="lead">Fund the helper without exposing or labeling the person receiving help.</p>
          <article className="sponsor-feature"><div className="mode-badge"><HandHeart size={14} weight="fill" /> {requestSubmitted ? "Seeking Sponsor" : "Community Help request"}</div><h2>{requestTitle}</h2><p>{requestSubmitted ? "A protected local request is ready for nonprofit review. Funding would turn it into paid help." : "Pick up a prepaid grocery order and carry it to the front door."}</p><div className="task-facts"><span><MapPin size={17} /> {sponsoredFixtureTask.area} · {distanceLabel(sponsoredFixtureTask)}</span><span><Clock size={17} /> About 45 min</span></div></article>
          <dl className="sponsor-breakdown" aria-label="Local sponsorship preview amounts"><div><dt>Helper receives</dt><dd>$24</dd></div><div><dt>Prototype fee</dt><dd>$2</dd></div><div><dt>Sponsor total</dt><dd>$26</dd></div><div><dt>Recipient pays</dt><dd>$0</dd></div></dl>
          <div className="privacy-note"><ShieldCheck size={20} /><span>Sponsor identity is private by default. The public task only shows that an organization funded it.</span></div>
          {isLiveNonprofit ? canFund ? <button className="primary-button" onClick={() => { if (!auth.capabilities.can_sponsor_tasks) return; setSponsorFunded(true); }}>Fund $26 in test mode</button> : <div className="truth-card"><LockKey size={21} /><div><strong>Sponsorship funding is locked</strong><span>Your nonprofit can review this request, but funding requires database-enabled sponsor access.</span></div></div> : !sponsorSeeking ? <button className="secondary-button" onClick={() => setSponsorSeeking(true)}>Volunteer window ended — seek a sponsor</button> : <button className="primary-button" onClick={() => { if (!auth.demoMode) return; setSponsorFunded(true); }}>Fund $26 in test mode</button>}
        </>}
      </div>
    </MobileScroll>
  );
}

function getThreadSeed(task: Task): MessageItem[] {
  const seeds: Record<string, MessageItem[]> = {
    leaves: [
      { id: 1, mine: false, text: "Hi! The green bags and rake will be by the side gate." },
      { id: 2, mine: true, text: "Perfect — I’ll arrive around 2:55 and message when I’m outside." },
      { id: 3, mine: false, text: "Thank you. I’ll share the start PIN once you arrive." },
    ],
    boxes: [
      { id: 1, mine: false, text: "The two lamp boxes are sealed and waiting on the porch." },
      { id: 2, mine: true, text: "Tomorrow at 10 works. I’ll message when I reach the garage." },
    ],
    tablet: [
      { id: 1, mine: false, text: "I reserved the public library meeting room near the front desk." },
      { id: 2, mine: true, text: "Great — we’ll only adjust display settings and the video-call shortcut." },
    ],
    pantry: [
      { id: 1, mine: false, text: "A pantry coordinator will meet you at the community-center front desk." },
      { id: 2, mine: true, text: "Thanks. I’ll arrive with Maya and stay within the posted packing scope." },
    ],
    "grocery-sponsored": [
      { id: 1, mine: false, text: "The grocery order is prepaid and the pickup name is in the protected details." },
      { id: 2, mine: true, text: "Understood — I won’t make purchases or substitutions." },
    ],
  };
  const seedId = task.id.replace(/-history$/, "");
  return seeds[seedId] ?? [
    { id: 1, mine: false, text: `Thanks for helping with “${task.title}.” The posted scope is still accurate.` },
    { id: 2, mine: true, text: "Thanks — I’ll keep any timing or scope changes in this task thread." },
  ];
}

type MessageThreadDescriptor = {
  key: string;
  task: Task;
  assignment: TaskAssignment | null;
};

/**
 * A settled assignment can outlive its task row. Preserve the immutable title
 * and participant names from the assignment instead of dropping its retained
 * transcript or borrowing the details from a later rematch.
 */
function archivedTaskForAssignment(assignment: TaskAssignment): Task {
  const fallbackArea = areaById("all");
  return {
    id: assignment.taskId ?? `archived-${assignment.id}`,
    title: assignment.taskTitle,
    description: "The original listing is no longer available. This participant record remains for task history.",
    mode: "paid",
    coords: fallbackArea.center,
    areaId: fallbackArea.id,
    area: "Archived task record",
    time: assignment.status === "completed" ? "Completed" : assignment.status === "withdrawn" ? "Commitment ended" : "Matched",
    duration: "Retained record",
    icon: ListChecks,
    included: "Original scope unavailable after task deletion",
    excluded: "No new task actions are available from this retained record",
    requesterName: assignment.requesterName,
    requesterInitials: initialsFromName(assignment.requesterName),
    ownerId: assignment.requesterId ?? undefined,
  };
}

/**
 * Server threads are resolved only by their immutable assignment ID. Local
 * fixture threads keep their task-keyed seeds, but a live rematch can never
 * inherit messages from an earlier helper on the same task.
 */
function resolveThread(
  task: Task,
  assignment: TaskAssignment | null,
  localThreads: Record<string, MessageItem[]>,
  collaboration: CollaborationState,
  signedInUserId: string | null,
): { items: MessageItem[]; server: boolean } {
  if (assignment) {
    const serverThread = collaboration.messagesByAssignment[assignment.id] ?? [];
    return {
      items: serverThread.map((message) => ({
        id: message.id,
        mine: message.senderId === signedInUserId,
        text: message.body,
        createdAt: message.createdAt,
      })),
      server: true,
    };
  }
  return { items: localThreads[task.id] ?? getThreadSeed(task), server: false };
}

/** The other person's name on a server thread, from whichever side you are on. */
function counterpartName(assignment: TaskAssignment | null, signedInUserId: string | null): string | null {
  if (!assignment) return null;
  if (assignment.requesterId === signedInUserId) return assignment.helperName;
  if (assignment.helperId === signedInUserId) return assignment.requesterName;
  return "Task participant";
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatMessageDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "today";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "today";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function MessagesScreen() {
  const flow = useFlow();
  const auth = useAuth();
  const { activeTask, communityTask, persona, blockedThreadIds, blockedRequesterNames, reportedTaskIds, moderationHolds, threadMessages, acceptedTaskIds, acceptedTaskActors, taskEvents, accessTermsAccepted, guardianLinked, youthAge, youthApprovalTaskId, youthApprovedTaskId, guardianSupervisedTaskId, collaboration, remoteTasks, ownedTasks, threadReadAt, markThreadRead } = useMicro();
  const signedInUserId = auth.session?.user.id ?? null;
  // Every server assignment is its own conversation, including settled history
  // and rematches on the same task. The task is display context only; assignment
  // ID is the identity and authorization boundary for the thread.
  const serverThreads = useMemo<MessageThreadDescriptor[]>(() => {
    const pool = new Map([...remoteTasks, ...ownedTasks].map((task) => [task.id, task] as const));
    return collaboration.assignments.map((assignment) => ({
      key: `assignment-${assignment.id}`,
      assignment,
      task: assignment.task
        ?? (assignment.taskId ? pool.get(assignment.taskId) : undefined)
        ?? archivedTaskForAssignment(assignment),
    }));
  }, [collaboration.assignments, ownedTasks, remoteTasks]);
  const participationReady = accessTermsAccepted && (persona !== "youth" || (youthAge >= 15 && guardianLinked));
  const actor = persona === "adult" ? "adult" : persona === "youth" ? "youth" : null;
  const paidInScope = Boolean(actor && acceptedTaskActors[activeTask.id] === actor && (acceptedTaskIds.includes(activeTask.id) || taskEvents[activeTask.id]?.length));
  const communityInScope = Boolean(actor && communityTask && acceptedTaskActors[communityTask.id] === actor && (acceptedTaskIds.includes(communityTask.id) || taskEvents[communityTask.id]?.length));
  const liveTasks = [paidInScope ? activeTask : null, communityInScope && communityTask ? communityTask : null].filter((task): task is Task => Boolean(task));
  const youthReviewId = youthApprovalTaskId ?? youthApprovedTaskId ?? guardianSupervisedTaskId;
  const youthReviewTask = youthReviewId ? [...tasks, sponsoredFixtureTask].find((task) => task.id === youthReviewId) ?? null : null;
  // Server threads lead. A local fixture for the same task stays out of the list
  // so it cannot masquerade as a second copy of a real conversation.
  const previewInScope = persona === "adult" ? [...liveTasks, ...pastThreadTasks] : persona === "youth" ? [...liveTasks.filter((task) => task.youthEligible), ...(youthReviewTask ? [youthReviewTask] : [])] : youthReviewTask ? [youthReviewTask] : [];
  const serverTaskIds = new Set(serverThreads.flatMap(({ assignment }) => assignment?.taskId ? [assignment.taskId] : []));
  const previewThreads: MessageThreadDescriptor[] = previewInScope
    .filter((task) => !serverTaskIds.has(task.id))
    .map((task) => ({ key: `local-${task.id}`, task, assignment: null }));
  const inScope = auth.session && !auth.demoMode ? serverThreads : [...serverThreads, ...previewThreads];
  const recordsWhilePaused = inScope.filter(({ task, assignment }) => assignment
    || task.id.endsWith("-history")
    || Boolean(taskEvents[task.id]?.length)
    || Boolean(threadMessages[task.id]?.length)
    || task.id === youthReviewTask?.id
    || blockedThreadIds.includes(task.id)
    || reportedTaskIds.includes(task.id)
    || Boolean(moderationHolds[task.id]));
  const threadDescriptors = Array.from(new Map(
    (participationReady ? inScope : recordsWhilePaused).map((descriptor) => [descriptor.key, descriptor]),
  ).values());

  return (
    <MobileScroll className="app-screen tab-scroll">
      <div className="standard-page nav-padded">
        <PageTitle eyebrow="Task-bound conversations" title="Messages" subtitle="Private threads keep scope, arrival, and safety context together." />
        <div className="privacy-banner"><ShieldCheck size={20} weight="fill" /><span>Keep phone numbers, emails, entry codes, and payment details out of messages.</span></div>
        {collaboration.error ? <div className="test-mode-banner" role="alert"><Warning size={19} /><span><strong>Live messages could not sync.</strong> {collaboration.error}</span></div> : null}
        {!participationReady && threadDescriptors.length ? <div className="persona-scope-note" role="status"><Info size={18} weight="fill" /><span>Participation is paused. Existing task records stay visible, but sending is disabled until Profile requirements are restored.</span></div> : null}
        {persona !== "adult" ? <div className="persona-scope-note"><ShieldCheck size={18} weight="fill" /><span>{persona === "youth" ? "Only task-specific, Youth Mode eligible threads are shown." : "Guardian view only shows the youth task under review."}</span></div> : null}
        <section className="thread-list" aria-label="Task messages">
          {auth.session && !auth.demoMode ? <div className="section-heading"><h2>Task threads</h2><span>{threadDescriptors.length}</span></div> : null}
          {threadDescriptors.map(({ key, task, assignment }, index) => {
            const detail = getTaskDetails(task);
            const { items: messages, server } = resolveThread(task, assignment, threadMessages, collaboration, signedInUserId);
            const other = counterpartName(assignment, signedInUserId) ?? detail.requester;
            const last = messages[messages.length - 1];
            const blocked = !server && (blockedThreadIds.includes(task.id) || blockedRequesterNames.includes(detail.requester));
            const reported = !server && (reportedTaskIds.includes(task.id) || Boolean(moderationHolds[task.id]));
            const assigned = Boolean(assignment) || Boolean(actor && acceptedTaskActors[task.id] === actor && acceptedTaskIds.includes(task.id));
            const reviewOnly = !task.id.endsWith("-history") && !assigned && (persona === "guardian" || persona === "youth");
            const settled = Boolean(assignment && assignment.status !== "accepted");
            const preview = blocked
              ? "Messaging blocked in this local fixture."
              : reported
                ? "Support review is open for this task."
                : reviewOnly
                  ? "Guardian review only · no assignment or messages yet."
                  : last
                    ? `${last.mine ? "You" : other.split(" ")[0]}: ${last.text}`
                    : assignment?.status === "completed"
                      ? "Match completed · retained participant record"
                      : assignment?.status === "withdrawn"
                        ? "Commitment ended · retained participant record"
                        : "Match confirmed · send the first task message";
            const readAt = threadReadAt[key] ?? 0;
            const unreadCount = participationReady && !settled && !blocked && !reviewOnly
              ? messages.filter((m) => !m.mine && (m.createdAt ? Date.parse(m.createdAt) : Date.now()) > readAt).length
              : 0;
            const unread = unreadCount > 0;
            const serverStatus = assignment?.status === "completed" ? "Completed" : assignment?.status === "withdrawn" ? "Ended" : "Live";
            const metadata = server
              ? settled ? `${serverStatus} · read-only · Retained` : `Live · ${task.time}`
              : `${auth.session ? "Preview · local only" : modeMeta[task.mode].label} · ${blocked ? "Blocked" : reported ? "In review" : reviewOnly ? "Not assigned" : task.time}`;
            return <button key={key} className={`thread-row ${unread ? "unread" : ""}`} onClick={() => { markThreadRead(key); flow.push(makeMessageScreen(task, other, assignment)); }}><span className={`avatar ${task.mode === "community" ? "community-avatar" : ""}`}>{task.mode === "community" ? <HandHeart size={20} weight="fill" /> : detail.initials}</span><span className="thread-copy"><span><strong>{task.title}</strong><time>{reviewOnly ? "Review" : last?.createdAt ? formatMessageTime(last.createdAt) : assignment?.settledAt ? formatMessageDate(assignment.settledAt) : server ? "New" : index === 0 ? "2m" : "Tue"}</time></span><b>{preview}</b><small>{metadata}</small></span>{unreadCount ? <span className="thread-unread-count" aria-label={`${unreadCount} unread ${unreadCount === 1 ? "message" : "messages"}`}>{unreadCount > 9 ? "9+" : unreadCount}</span> : null}</button>;
          })}
          {!threadDescriptors.length ? <div className="empty-state message-empty"><ShieldCheck size={34} weight="duotone" /><h2>{participationReady ? "No task threads yet." : "Participation is paused."}</h2><p>{participationReady ? "Accept an eligible task or request a guardian review to start a protected thread." : "Update the age, terms, or guardian link in Profile before messaging."}</p></div> : null}
        </section>
      </div>
    </MobileScroll>
  );
}

function makeMessageScreen(task: Task, counterpartName?: string, assignment: TaskAssignment | null = null): FlowScreen {
  const detail = getTaskDetails(task);
  return { id: `thread-${assignment?.id ?? task.id}`, headerHeight: 88, header: (flow) => <RouteHeader wrap title={`${counterpartName ?? detail.requester} · ${task.title}`} onBack={flow.pop} right={<ShieldCheck size={21} weight="fill" aria-label="Protected task thread" />} />, render: () => <MessageThread task={task} assignment={assignment} /> };
}

function MessageThread({ task, assignment }: { task: Task; assignment: TaskAssignment | null }) {
  const keyboard = useKeyboard();
  const { bottomInset } = useKeyboardInsets();
  const auth = useAuth();
  const { threadMessages, setThreadMessages, blockedThreadIds, setBlockedThreadIds, blockedRequesterNames, setBlockedRequesterNames, reportedTaskIds, setReportedTaskIds, reportReasons, setReportReasons, moderationHolds, setModerationHolds, taskEvents, setTaskEvents, acceptedTaskIds, acceptedTaskActors, persona, accessTermsAccepted, guardianLinked, youthAge, youthApprovalTaskId, youthApprovedTaskId, guardianSupervisedTaskId, guardianSupervisionStatus, setGuardianSupervisionStatus, collaboration } = useMicro();
  const detail = getTaskDetails(task);
  const signedInUserId = auth.session?.user.id ?? null;
  const person = counterpartName(assignment, signedInUserId) ?? detail.requester;
  const { items: messages, server: serverThread } = resolveThread(task, assignment, threadMessages, collaboration, signedInUserId);
  const blocked = !serverThread && (blockedThreadIds.includes(task.id) || blockedRequesterNames.includes(person));
  const reported = !serverThread && (reportedTaskIds.includes(task.id) || Boolean(moderationHolds[task.id]));
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyState, setSafetyState] = useState<"menu" | "reasons" | "reported" | "blocked">("menu");
  const [reason, setReason] = useState(reportReasons[task.id] ?? moderationHolds[task.id] ?? "Scope or safety concern");
  const [severity, setSeverity] = useState<"standard" | "urgent">("standard");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sentStatus, setSentStatus] = useState("");
  const [sendError, setSendError] = useState("");
  const isHistory = task.id.endsWith("-history") || Boolean(assignment && assignment.status !== "accepted");
  const participationReady = accessTermsAccepted && (persona !== "youth" || (youthAge >= 15 && guardianLinked));
  const actor = persona === "adult" ? "adult" : persona === "youth" ? "youth" : null;
  const assigned = Boolean(assignment) || Boolean(actor && acceptedTaskActors[task.id] === actor && acceptedTaskIds.includes(task.id));
  const readOnlyReview = !assignment && !isHistory && !assigned && (persona === "guardian" || persona === "youth");
  const recordOnly = isHistory || !participationReady;
  const composerLocked = blocked || readOnlyReview || recordOnly || (Boolean(task.ownerId) && !serverThread);
  const displayMessages = readOnlyReview ? [] : messages;
  const reviewCopy = task.mode === "community" ? "Community completion stays paused while the task is reviewed." : "Starting and payout review stay paused while the task is reviewed.";
  const recordedEvents: TaskEvent[] = serverThread && assignment
    ? [{ id: 1, text: assignment.status === "accepted"
      ? `Live match confirmed ${formatMessageDate(assignment.createdAt)}. Only the requester and helper can read this thread.`
      : assignment.status === "completed"
        ? `Match completed ${formatMessageDate(assignment.settledAt ?? assignment.createdAt)}. This assignment-specific thread is retained read-only for its two participants.`
        : `Commitment ended ${formatMessageDate(assignment.settledAt ?? assignment.createdAt)}. This assignment-specific thread is retained read-only for its two participants.` }]
    : isHistory
    ? [{ id: 1, text: task.mode === "community" ? "Volunteer commitment completed — no payment state was created." : "Task completed — test payment record retained." }]
    : taskEvents[task.id]?.length
      ? taskEvents[task.id]
      : moderationHolds[task.id]
        ? [{ id: 1, text: "A task report is awaiting support review. Assignment, start, and completion actions remain paused." }]
        : guardianSupervisedTaskId === task.id && persona === "guardian"
          ? [{ id: 1, text: guardianSupervisionStatus || "This guardian-approved youth task has an active lifecycle record." }]
        : youthApprovalTaskId === task.id
        ? [{ id: 1, text: "Guardian approval pending. The task is not assigned and protected address details are unavailable." }]
        : youthApprovedTaskId === task.id
          ? [{ id: 1, text: "Guardian approved this exact scope and time. The youth participant still needs to accept the task." }]
          : [{ id: 1, text: "No assignment event has been recorded for this local task." }];

  const send = async () => {
    if (!draft.trim() || composerLocked || sending) return;
    // A thread with a real counterpart goes to Supabase, and the realtime
    // reload is what puts it on screen — writing it locally too would show the
    // line twice and, worse, show it even when the insert was refused.
    if (serverThread && assignment?.status === "accepted") {
      setSending(true);
      setSendError("");
      const result = await collaboration.sendMessage(assignment.id, draft.trim());
      setSending(false);
      if (!result.ok) {
        setSendError(result.message ?? "We couldn't send that message.");
        return;
      }
      setDraft("");
      setSentStatus("Message stored and shared with the matched participant.");
      keyboard.hide();
      return;
    }
    const item = { id: Date.now(), mine: true, text: draft.trim() };
    setThreadMessages((current) => ({ ...current, [task.id]: [...(current[task.id] ?? getThreadSeed(task)), item] }));
    setDraft("");
    setSentStatus("Message sent in this local prototype.");
    keyboard.hide();
  };
  const openSafety = () => {
    setSafetyState(blocked ? "blocked" : reported ? "reported" : "menu");
    setSafetyOpen(true);
  };
  const blockPerson = () => {
    setBlockedThreadIds((current) => current.includes(task.id) ? current : [...current, task.id]);
    setBlockedRequesterNames((current) => current.includes(person) ? current : [...current, person]);
    setDraft("");
    keyboard.hide();
    setSafetyState("blocked");
  };
  const submitReport = () => {
    const recordedReason = `${severity === "urgent" ? "Urgent" : "Standard"} priority · ${reason} · ${evidenceNote.trim() || "no evidence note attached"}`;
    setReportedTaskIds((current) => current.includes(task.id) ? current : [...current, task.id]);
    setReportReasons((current) => ({ ...current, [task.id]: recordedReason }));
    setModerationHolds((current) => ({ ...current, [task.id]: "Task actions are paused for support review." }));
    appendTaskEvent(setTaskEvents, task.id, `${severity === "urgent" ? "Urgent" : "Standard"} task report recorded from the protected thread; workflow review paused.`);
    if (guardianSupervisedTaskId === task.id) setGuardianSupervisionStatus("Sam’s task is paused for support review. Report details remain private to the reporter and support.");
    setSafetyState("reported");
  };

  return (
    <div className="message-route">
      <MobileScroll className="app-screen route-scroll">
        <div className="message-page">
          <section className="task-event-list" aria-label="Immutable task events"><span>Task history</span>{recordedEvents.map((event) => <p key={event.id}><ShieldCheck size={16} weight="fill" /> {event.text}</p>)}</section>
          {reported ? <div className="status-receipt"><Warning size={18} weight="fill" /> {reviewCopy}</div> : null}
          {blocked ? <div className="blocked-message-notice"><ShieldCheck size={18} weight="fill" /><span><strong>Messaging blocked</strong> This thread remains visible for records and support.</span></div> : null}
          {readOnlyReview ? <div className="blocked-message-notice guardian-readonly"><ShieldCheck size={18} weight="fill" /><span><strong>Review-only thread</strong> A guardian decision or youth approval does not release an address or create an assignment.</span></div> : null}
          {recordOnly && !blocked && !readOnlyReview ? <div className="blocked-message-notice guardian-readonly"><Info size={18} weight="fill" /><span><strong>{assignment?.status === "withdrawn" ? "Ended commitment record" : isHistory ? "Completed task record" : "Participation paused"}</strong> {isHistory ? "This assignment-specific conversation is retained for its participants and cannot receive new messages." : "Previous messages remain visible, but sending is disabled until participation requirements are restored."}</span></div> : null}
          <div className="message-date">{serverThread && messages[0]?.createdAt ? formatMessageDate(messages[0].createdAt) : "Today"}</div>
          {serverThread && !displayMessages.length ? <div className="empty-thread-prompt"><ChatCircle size={25} weight="duotone" /><strong>{isHistory ? "No messages in this retained thread." : "Start with the task."}</strong><span>{isHistory ? "The participant record remains separate from every later rematch." : "Confirm timing, scope, or arrival details without sharing sensitive information."}</span></div> : null}
          {displayMessages.map((message) => <div key={message.id} className="message-bubble" data-mine={message.mine ? "true" : "false"}>{message.text}<span>{message.createdAt ? formatMessageTime(message.createdAt) : message.mine ? "Sent" : "2:12 PM"}</span></div>)}
          {sendError ? <p className="form-error" role="alert">{sendError}</p> : null}
          <span className="sr-only" role="status" aria-live="polite">{sentStatus}</span>
        </div>
      </MobileScroll>
      <div className="message-composer" data-blocked={composerLocked ? "true" : "false"} style={{ bottom: bottomInset }}>
        <KeyboardInput aria-label="Message" value={draft} maxLength={2000} disabled={composerLocked || sending} onChange={(event) => { setDraft(event.target.value); setSendError(""); }} onBlur={() => keyboard.hide()} placeholder={blocked ? "Messaging blocked" : readOnlyReview ? "Available after task acceptance" : isHistory ? "Read-only task record" : !participationReady ? "Participation paused" : serverThread ? `Message ${person} about this task` : "Message about this task"} />
        <button className="send-button" aria-label="Send message" disabled={composerLocked || sending || !draft.trim()} onClick={() => void send()}><PaperPlaneTilt size={21} weight="fill" /></button>
      </div>
      <BottomSheet open={safetyOpen} onOpenChange={setSafetyOpen} title={safetyState === "reported" ? "Report recorded" : safetyState === "blocked" ? `${person} blocked` : safetyState === "reasons" ? "Report this task" : "Safety options"} description={safetyState === "reported" ? reviewCopy : safetyState === "blocked" ? "Future direct contact is stopped in this local fixture." : reviewCopy} snap={safetyState === "reasons" ? 0.74 : 0.46}>
        {safetyState === "menu" ? <div className="sheet-form"><button className="choice-row danger-copy" onClick={() => setSafetyState("reasons")}><span><strong>Report this task</strong><small>Share the issue with support</small></span><ArrowRight size={18} /></button><button className="choice-row danger-copy" onClick={blockPerson}><span><strong>Block {person}</strong><small>Stop future direct contact</small></span><ArrowRight size={18} /></button><button className="secondary-button" onClick={() => setSafetyOpen(false)}>Cancel</button></div> : null}
        {safetyState === "reasons" ? <div className="sheet-form"><fieldset className="choice-fieldset"><legend>What happened?</legend>{["Scope or safety concern", "Harassment or inappropriate message", "Pressure to move off-platform"].map((value) => <button key={value} className="choice-row" aria-pressed={reason === value} data-selected={reason === value ? "true" : "false"} onClick={() => setReason(value)}><span>{value}</span><span className="radio-mark">{reason === value ? <Check size={15} weight="bold" /> : null}</span></button>)}</fieldset><fieldset className="choice-fieldset inline-filter-fieldset"><legend>Priority</legend><div className="segmented-row two-segments"><button aria-pressed={severity === "standard"} data-active={severity === "standard" ? "true" : "false"} onClick={() => setSeverity("standard")}>Standard</button><button aria-pressed={severity === "urgent"} data-active={severity === "urgent" ? "true" : "false"} onClick={() => setSeverity("urgent")}>Urgent safety</button></div></fieldset><label className="field-label-block">Evidence or context (optional)<KeyboardTextarea rows={3} value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} onBlur={() => keyboard.hide()} placeholder="What happened, when, and what should support review?" /></label><button className="danger-button" onClick={submitReport}>Submit test report</button><button className="secondary-button" onClick={() => setSafetyState("menu")}>Back</button></div> : null}
        {safetyState === "reported" || safetyState === "blocked" ? <div className="sheet-form"><div className="status-receipt" role="status"><CheckCircle size={19} weight="fill" /> {safetyState === "reported" ? `${severity === "urgent" ? "Urgent" : "Standard"} ${reason.toLowerCase()} was recorded. No live support ticket was created.` : `${person} is blocked in this prototype. No backend account was changed.`}</div><button className="primary-button" onClick={() => setSafetyOpen(false)}>Done</button></div> : null}
      </BottomSheet>
    </div>
  );
}

type ProfileInfoKind = "saved" | "payments" | "blocked" | "support";

const profileInfoTitles: Record<ProfileInfoKind, string> = {
  saved: "Saved tasks",
  payments: "Payments & payouts",
  blocked: "Blocked people",
  support: "Help & support",
};

function ProfileScreen() {
  const flow = useFlow();
  const auth = useAuth();
  const { youthApprovedTaskId, youthApprovalTaskId, guardianSupervisedTaskId, guardianSupervisionStatus, persona, guardianLinked, blockedRequesterNames, reportedTaskIds, savedTaskIds, ownedTasks, remoteTasks, collaboration, acceptedTaskIds, closedTaskIds, activeTask, communityTask, sponsorFunded, notificationsEnabled, setNotificationsEnabled, profileAreaId, setProfileAreaId, profilePhotos, setProfilePhotos, setActiveTab } = useMicro();
  const profileArea = areaById(profileAreaId).label;
  const activeCommitments = acceptedTaskIds.filter((id) => !closedTaskIds.includes(id)).length;
  const ownedByYou = Array.from(new Map([
    ...collaboration.assignments.filter((assignment) => assignment.requesterId === auth.session?.user.id && assignment.task).map((assignment) => assignment.task as Task),
    ...remoteTasks.filter((task) => task.ownerId === auth.session?.user.id),
    ...ownedTasks.filter((task) => task.ownerPersona === persona),
  ].map((task) => [task.id, task])).values());
  const [areaOpen, setAreaOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [accountActionError, setAccountActionError] = useState("");
  const youthApproved = youthApprovedTaskId === "pantry";
  const youthPending = youthApprovalTaskId === "pantry";
  const profilePhoto = profilePhotos[persona];
  const knownTasks = [...collaboration.assignments.map((assignment) => assignment.task).filter((task): task is Task => Boolean(task)), ...remoteTasks, ...tasks, ...(sponsorFunded ? [sponsoredFixtureTask] : []), ...ownedTasks, ...pastThreadTasks, activeTask, ...(communityTask ? [communityTask] : [])];
  const knownTaskIds = new Set(knownTasks.map((task) => task.id));
  const savedCount = savedTaskIds.filter((id) => knownTaskIds.has(id)).length;
  const fixtureProfile: { initials: string; name: string; detail: string; stats: Array<[string, string]>; reliability: string } = persona === "youth"
    ? { initials: "SK", name: "Sam Kim", detail: `Youth profile · ${guardianLinked ? "guardian linked" : "link needed"}`, stats: [["2", "tasks completed"], ["5.0", "from 2 reviews"], ["3.5h", "volunteer time"]], reliability: "100%" }
    : persona === "guardian"
      ? { initials: "MK", name: "Maya Kim", detail: `Guardian profile · ${guardianLinked ? "Sam linked" : "link paused"}`, stats: [["4", "task reviews"], [guardianLinked ? "1" : "0", "youth linked"], ["100%", "decisions logged"]], reliability: "100%" }
      : { initials: "AK", name: "Alex Kim", detail: `${profileArea} · joined May 2026`, stats: [["12", "tasks completed"], ["4.9", "from 8 reviews"], ["7.5h", "volunteer time"]], reliability: "96%" };
  const isLiveAccount = Boolean(auth.session && auth.profile);
  const isLiveNonprofit = Boolean(auth.session && auth.organization && auth.accountType === "nonprofit");
  const organizationStatus = auth.organization?.verification_status ?? "pending";
  const organizationStatusLabel = organizationStatus.charAt(0).toUpperCase() + organizationStatus.slice(1);
  const profile = isLiveAccount && auth.profile
    ? {
      initials: initialsFromName(auth.profile.display_name),
      name: auth.profile.display_name,
      detail: `${profileArea} · ${isLiveNonprofit ? "organization account" : "neighbor account"}`,
      stats: [
        [String(ownedByYou.length), "tasks posted"],
        [String(acceptedTaskIds.length), "accepted in preview"],
        [isLiveNonprofit ? String(sponsorFunded ? 1 : 0) : "Ready", isLiveNonprofit ? "sponsored in preview" : "neighbor profile"],
      ] as Array<[string, string]>,
      reliability: null,
    }
    : fixtureProfile;
  const signOut = async () => {
    setAccountActionError("");
    const result = await auth.signOut();
    if (!result.ok) setAccountActionError(result.message ?? "Micro couldn't sign you out.");
  };
  const chooseProfilePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file for the local marker preview.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Choose an image smaller than 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setProfilePhotos((current) => ({ ...current, [persona]: reader.result as string }));
      setPhotoError("");
    };
    reader.onerror = () => setPhotoError("That image could not be previewed. Try another file.");
    reader.readAsDataURL(file);
  };
  return (
    <><MobileScroll className="app-screen tab-scroll">
      <div className="standard-page nav-padded profile-page">
        <PageTitle title="Profile" />
        {/* The photo you chose belongs on your own profile, not only on a map
            pin, and the card is where anyone would tap to change it. */}
        <section className="profile-card"><span className="avatar large">{profile.initials}</span><div><h2>{profile.name}</h2><p>{profile.detail}</p><div className="trust-line"><CheckCircle size={16} weight="fill" /> {isLiveAccount ? auth.session?.user.email_confirmed_at ? "Email confirmed" : "Signed-in account" : "Seeded email confirmed"}</div></div><span className="settings-status">{isLiveAccount ? isLiveNonprofit ? "Organization" : "Neighbor" : persona}</span></section>
        <section className="trust-stats">{profile.stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</section>
        {profile.reliability ? <section className="reliability-card"><span><ShieldCheck size={22} weight="fill" /></span><div><strong>{profile.reliability} arrival reliability</strong><small>Based on completed local fixture tasks; no production reputation score is connected.</small></div></section> : null}
        <section className="settings-group">
          <h2>Your commitments</h2>
          <button className="settings-row" onClick={() => setActiveTab("activity")}><span className="settings-icon blue"><ListChecks size={21} weight="bold" /></span><span><strong>Activity</strong><small>{ownedByYou.length ? `${activeCommitments ? `${activeCommitments} active · ` : ""}${ownedByYou.length} posted by you` : activeCommitments ? `${activeCommitments} active ${activeCommitments === 1 ? "commitment" : "commitments"}` : "Commitments, posted tasks, and history"}</small></span>{activeCommitments ? <span className="settings-status">{activeCommitments}</span> : null}<ArrowRight size={18} /></button>
          <button className="settings-row" onClick={() => flow.push(makeNotificationsScreen())}><span className="settings-icon orange"><Bell size={21} weight="fill" /></span><span><strong>Notifications</strong><small>{notificationsEnabled ? "Role-aware task updates" : "Paused for this preview"}</small></span><ArrowRight size={18} /></button>
        </section>
        <section className="settings-group">
          <h2>Account</h2>
          {isLiveAccount ? <>
            <div className="settings-row settings-row-static"><span className="settings-icon blue"><EnvelopeSimple size={21} weight="fill" /></span><span><strong>Email</strong><small>{auth.session?.user.email ?? "Signed-in account"}</small></span><span className="settings-status">{auth.session?.user.email_confirmed_at ? "Confirmed" : "Active"}</span></div>
            <div className="settings-row settings-row-static"><span className={`settings-icon ${isLiveNonprofit ? "purple" : ""}`}>{isLiveNonprofit ? <Buildings size={21} weight="fill" /> : <UserCircle size={21} weight="fill" />}</span><span><strong>{isLiveNonprofit ? "Organization account" : "Neighbor account"}</strong><small>{isLiveNonprofit ? "Regular tasks plus permission-gated sponsorship tools" : "Post or accept nearby tasks"}</small></span></div>
            {isLiveNonprofit ? <button className="settings-row organization-settings-row" onClick={() => flow.push(makeOrganizationWorkspaceScreen())}><span className="settings-icon purple"><SealCheck size={21} weight="fill" /></span><span><strong>{auth.organization?.name ?? "Organization workspace"}</strong><small>{organizationStatus === "verified" ? auth.canSponsor ? "Sponsorship requests and funding enabled" : auth.capabilities.can_receive_sponsorship_requests ? "Sponsorship requests enabled · funding locked" : "Verified · sponsorship access not enabled" : organizationStatus === "rejected" ? "Verification needs attention" : organizationStatus === "suspended" ? "Organization access suspended" : "Verification review pending"}</small></span><span className="settings-status">{organizationStatusLabel}</span><ArrowRight size={18} /></button> : null}
          </> : <div className="settings-row settings-row-static"><span className="settings-icon"><UserCircle size={21} weight="fill" /></span><span><strong>Local demo profile</strong><small>No Supabase account is active</small></span></div>}
          <button className="settings-row sign-out-row" disabled={auth.busy} onClick={() => void signOut()}><span className="settings-icon"><SignOut size={21} weight="bold" /></span><span><strong>{isLiveAccount ? "Sign out" : "Exit local demo"}</strong><small>{isLiveAccount ? "Return to Micro's welcome screen" : "Return to account setup"}</small></span><ArrowRight size={18} /></button>
          {accountActionError ? <p className="form-error account-action-error" role="alert">{accountActionError}</p> : null}
        </section>
        {!isLiveAccount ? <section className="settings-group"><h2>Participation fixtures</h2><button className="settings-row" onClick={() => flow.push(makeYouthScreen())}><span className="settings-icon purple"><ShieldCheck size={21} weight="fill" /></span><span><strong>Youth Mode</strong><small>{guardianSupervisedTaskId && persona !== "adult" ? guardianSupervisionStatus : youthApproved ? "Guardian approved pantry task" : youthPending ? "Guardian review pending" : "Task-specific guardian approval"}</small></span><span className="settings-status">{guardianSupervisedTaskId && persona !== "adult" ? "Active" : youthApproved ? "Approved" : youthPending ? "Pending" : "Review"}</span><ArrowRight size={18} /></button><button className="settings-row" onClick={() => flow.push(makeDemoAccessScreen())}><span className="settings-icon"><HandHeart size={21} weight="fill" /></span><span><strong>Demo identity &amp; roles</strong><small>Adult · youth · guardian access states</small></span><ArrowRight size={18} /></button></section> : null}
        <section className="settings-group"><h2>Account &amp; safety</h2><button className="settings-row" onClick={() => flow.push(makeProfileInfoScreen("saved"))}><span className="settings-icon orange"><Tag size={21} weight="fill" /></span><span><strong>Saved tasks</strong><small>{savedCount ? `${savedCount} saved ${savedCount === 1 ? "task" : "tasks"}` : "No saved tasks"}</small></span>{savedCount ? <span className="settings-status">{savedCount}</span> : null}<ArrowRight size={18} /></button><button className="settings-row" onClick={() => flow.push(makeProfileInfoScreen("payments"))}><span className="settings-icon"><CurrencyDollar size={21} weight="bold" /></span><span><strong>Payments &amp; payouts</strong><small>Test-mode methods and receipts</small></span><ArrowRight size={18} /></button><button className="settings-row" onClick={() => flow.push(makeProfileInfoScreen("blocked"))}><span className="settings-icon purple"><ShieldCheck size={21} weight="fill" /></span><span><strong>Blocked people</strong><small>{blockedRequesterNames.length ? `${blockedRequesterNames.length} local fixture` : "No one blocked"}</small></span>{blockedRequesterNames.length ? <span className="settings-status">{blockedRequesterNames.length}</span> : null}<ArrowRight size={18} /></button><button className="settings-row" onClick={() => flow.push(makeProfileInfoScreen("support"))}><span className="settings-icon blue"><Info size={21} weight="fill" /></span><span><strong>Help &amp; support</strong><small>{reportedTaskIds.length ? `${reportedTaskIds.length} task in review` : "Safety guidance and reports"}</small></span><ArrowRight size={18} /></button></section>
        <section className="settings-group"><h2>Preferences</h2><button className="settings-row" aria-pressed={notificationsEnabled} onClick={() => setNotificationsEnabled(!notificationsEnabled)}><span className="settings-icon blue"><Bell size={21} weight="fill" /></span><span><strong>Task notifications</strong><small>{notificationsEnabled ? "Matches, messages, and status changes" : "Paused for this preview"}</small></span><span className="toggle" data-on={notificationsEnabled ? "true" : "false"}><span /></span></button><button className="settings-row" onClick={() => setAreaOpen(true)}><span className="settings-icon orange"><MapPin size={21} weight="fill" /></span><span><strong>Approximate area</strong><small>{profileArea} · about 3 miles · preview only</small></span><ArrowRight size={18} /></button><button className="settings-row" onClick={() => setPhotoOpen(true)}><span className="settings-icon"><Camera size={21} weight="fill" /></span><span><strong>Map marker photo</strong><small>{profilePhoto ? "Local photo selected" : "Default person icon"} · map only</small></span><ArrowRight size={18} /></button></section>
        {isLiveAccount ? <section className="settings-group destructive-settings-group"><h2>Account controls</h2><button className="settings-row delete-account-row" onClick={() => flow.push(makeDeleteAccountScreen())}><span className="settings-icon"><Trash size={21} weight="bold" /></span><span><strong>Delete account</strong><small>Permanently remove your sign-in and Micro profile</small></span><ArrowRight size={18} /></button></section> : null}
        <div className="demo-card"><Info size={20} /><div><strong>{isLiveAccount ? "Connected account" : "UI prototype"}</strong><span>{isLiveAccount ? "Supabase handles this account, organization access, real task listings, protected matches, private addresses, and participant messages. Payments, moderation, profile photos, and push notifications remain preview-only." : "Payments, identity, locations, messages, and task data are realistic local fixtures—not live services."}</span></div></div>
      </div></MobileScroll><BottomSheet open={areaOpen} onOpenChange={setAreaOpen} title="Profile area" description="Only an approximate neighborhood appears before a protected match." snap={0.44}><div className="sheet-form">{areas.map((option) => <button key={option.id} className="choice-row" aria-pressed={profileAreaId === option.id} data-selected={profileAreaId === option.id ? "true" : "false"} onClick={() => { setProfileAreaId(option.id); setAreaOpen(false); }}><span><strong>{option.label}</strong><small>{option.blurb}</small></span>{profileAreaId === option.id ? <CheckCircle size={21} weight="fill" /> : <ArrowRight size={18} />}</button>)}</div></BottomSheet><BottomSheet open={photoOpen} onOpenChange={setPhotoOpen} title="Your map marker" description="Optional and local to this browser session. Profile photos never appear in routine task cards." snap={0.56}><div className="sheet-form"><section className="profile-photo-setting" aria-labelledby="marker-photo-heading"><h2 id="marker-photo-heading" className="sr-only">Map marker photo</h2><div className="profile-photo-preview"><PersonAvatar src={profilePhoto} initials={profile.initials} size="large" label="Map marker photo preview" /></div><div><strong>{profilePhoto ? "Local marker photo selected" : "Use the default person icon"}</strong><p>This preview powers only your own future map marker. It is not uploaded, synced, stored, or moderated.</p></div><div className="success-actions"><label className="photo-upload-button"><Camera size={18} weight="bold" /> {profilePhoto ? "Choose another" : "Choose photo"}<input type="file" accept="image/*" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; chooseProfilePhoto(file); }} /></label>{profilePhoto ? <button className="text-button" onClick={() => { setProfilePhotos((current) => ({ ...current, [persona]: "" })); setPhotoError(""); }}>Remove photo</button> : null}</div>{photoError ? <p className="form-error" role="alert">{photoError}</p> : null}</section></div></BottomSheet></>
  );
}

function makeDeleteAccountScreen(): FlowScreen {
  return {
    id: "delete-account",
    headerHeight: 66,
    header: (flow) => <RouteHeader title="Delete account" onBack={flow.pop} />,
    render: () => <DeleteAccountScreen />,
  };
}

function DeleteAccountScreen() {
  const flow = useFlow();
  const keyboard = useKeyboard();
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const isNonprofit = Boolean(auth.organization && auth.accountType === "nonprofit");
  const isOrganizationOwner = isNonprofit && auth.organization?.role === "owner";
  const confirmationMatches = confirmation === "DELETE";
  const ready = confirmationMatches
    && (!auth.requiresPasswordReauthentication || Boolean(password));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    keyboard.hide();
    if (!confirmationMatches) {
      setErrorCode("confirmation_required");
      setError("Type DELETE exactly as shown before continuing.");
      window.setTimeout(() => document.getElementById("delete-confirmation")?.focus(), 0);
      return;
    }
    if (auth.requiresPasswordReauthentication && !password) {
      setErrorCode("reauthentication_required");
      setError("Enter your current password before continuing.");
      window.setTimeout(() => document.getElementById("delete-password")?.focus(), 0);
      return;
    }

    setError("");
    setErrorCode("");
    const result = await auth.deleteAccount({
      password: auth.requiresPasswordReauthentication ? password : undefined,
      confirmation: "DELETE",
    });
    if (!result.ok) {
      setErrorCode(result.code ?? "account_deletion_failed");
      setError(result.message ?? "Micro couldn't confirm account deletion.");
      if (result.code === "reauthentication_required") {
        setPassword("");
        window.setTimeout(() => document.getElementById("delete-password")?.focus(), 0);
      }
    }
  };

  return (
    <MobileScroll className="app-screen route-scroll">
      <main className="route-page route-bottom-pad delete-account-page">
        <section className="delete-account-intro" aria-labelledby="delete-account-heading">
          <span><Trash size={29} weight="duotone" aria-hidden="true" /></span>
          <div>
            <p className="eyebrow">Permanent account change</p>
            <h1 id="delete-account-heading">Delete your Micro account?</h1>
            <p>Nothing is removed until your identity, confirmation, and server-side safety checks all pass.</p>
          </div>
        </section>

        <section className="delete-impact-card" aria-labelledby="delete-impact-heading">
          <h2 id="delete-impact-heading">What this removes</h2>
          <ul>
            <li><CheckCircle size={18} weight="fill" aria-hidden="true" /><span>Your Micro sign-in and protected profile</span></li>
            <li><CheckCircle size={18} weight="fill" aria-hidden="true" /><span>Your published task listings and their protected private addresses</span></li>
            <li><CheckCircle size={18} weight="fill" aria-hidden="true" /><span>Your identity is removed from settled task history; limited conversation records may be retained for the other participant and safety records</span></li>
            {isNonprofit ? <li><CheckCircle size={18} weight="fill" aria-hidden="true" /><span>Your membership in {auth.organization?.name ?? "the organization"}. An otherwise empty organization may be removed; organizations with linked people stay.</span></li> : null}
            <li><CheckCircle size={18} weight="fill" aria-hidden="true" /><span>Your ability to return to this account—deletion cannot be undone</span></li>
          </ul>
        </section>

        {isOrganizationOwner ? <section className="delete-owner-notice" role="note"><Buildings size={21} weight="fill" aria-hidden="true" /><div><strong>Organization ownership is protected</strong><p>If other people are linked to {auth.organization?.name ?? "this nonprofit"} and no successor owner exists, Micro will stop deletion until ownership is transferred. If no one else is linked, the empty organization can be removed with your account.</p></div></section> : null}
        <section className="delete-owner-notice" role="note"><ShieldCheck size={21} weight="fill" aria-hidden="true" /><div><strong>Active matches are protected</strong><p>If you are the requester or helper on an active matched task, Micro stops deletion so the other person’s commitment and conversation cannot disappear unexpectedly.</p></div></section>

        <div className="delete-account-identity"><EnvelopeSimple size={19} weight="fill" aria-hidden="true" /><span><strong>Deleting</strong><small>{auth.session?.user.email ?? "Signed-in Micro account"}</small></span></div>

        <form className="delete-account-form" onSubmit={submit} noValidate>
          {auth.requiresPasswordReauthentication ? <AuthInputField id="delete-password" label="Current password" icon={LockKey} type="password" value={password} onChange={(value) => { setPassword(value); if (errorCode === "reauthentication_required") { setError(""); setErrorCode(""); } }} autoComplete="current-password" placeholder="Your password" help="Verified directly with Supabase. Micro never sends your password to the deletion function." errorId={error && errorCode === "reauthentication_required" ? "delete-account-error" : undefined} invalid={Boolean(error) && errorCode === "reauthentication_required"} /> : <div className="delete-session-check"><ShieldCheck size={21} weight="fill" aria-hidden="true" /><div><strong>Secure-session check</strong><p>The server will verify your current signed-in session again before deleting anything.</p></div></div>}
          <AuthInputField id="delete-confirmation" label="Type DELETE to confirm" icon={Trash} value={confirmation} onChange={(value) => { setConfirmation(value); if (errorCode === "confirmation_required") { setError(""); setErrorCode(""); } }} autoComplete="off" placeholder="DELETE" help="This extra step helps prevent an accidental tap." errorId={error && errorCode === "confirmation_required" ? "delete-account-error" : undefined} invalid={Boolean(error) && errorCode === "confirmation_required"} />

          {errorCode === "organization_owner_transfer_required" ? <section id="delete-account-error" className="delete-account-blocker" role="alert"><Buildings size={22} weight="fill" aria-hidden="true" /><div><strong>Choose a successor owner first</strong><p>{error}</p><small>Your account and organization were not deleted.</small></div></section> : errorCode === "active_task_commitment_requires_settlement" ? <section id="delete-account-error" className="delete-account-blocker" role="alert"><ShieldCheck size={22} weight="fill" aria-hidden="true" /><div><strong>Close the active match first</strong><p>{error}</p><small>Your account, task, and messages were not deleted.</small></div></section> : error ? <p id="delete-account-error" className="auth-form-error" role="alert"><Warning size={17} weight="fill" aria-hidden="true" /> {error}</p> : null}

          <p className="delete-account-boundary"><Info size={17} weight="fill" aria-hidden="true" /> If no active match blocks deletion, the live account, profile, listings, and private addresses are removed. Settled task history may remain without your account identity so the other participant’s record is not erased. Local map-marker photos and other preview fixtures stay only in this browser session.</p>

          <div className="delete-account-actions">
            <button className="secondary-button" type="button" disabled={auth.busy} onClick={() => { keyboard.hide(); flow.pop(); }}>Keep my account</button>
            <button className="danger-button" type="submit" disabled={auth.busy || !ready}>{auth.busy ? "Deleting account…" : "Delete account permanently"}</button>
          </div>
          <span className="sr-only" role="status" aria-live="polite">{auth.busy ? "Verifying and deleting account" : ""}</span>
        </form>
      </main>
    </MobileScroll>
  );
}

function makeProfileInfoScreen(kind: ProfileInfoKind): FlowScreen {
  return { id: `profile-${kind}`, headerHeight: 66, header: (flow) => <RouteHeader title={profileInfoTitles[kind]} onBack={flow.pop} />, render: () => <ProfileInfoScreen kind={kind} /> };
}

function ProfileInfoScreen({ kind }: { kind: ProfileInfoKind }) {
  const flow = useFlow();
  const { activeTask, communityTask, ownedTasks, remoteTasks, collaboration, blockedThreadIds, setBlockedThreadIds, blockedRequesterNames, setBlockedRequesterNames, reportedTaskIds, reportReasons, moderationHolds, acceptedTaskIds, closedTaskIds, taskEvents, savedTaskIds, setSavedTaskIds, setActiveTab, setSelectedTaskId, persona } = useMicro();
  const knownTasks = [...collaboration.assignments.map((assignment) => assignment.task).filter((task): task is Task => Boolean(task)), ...remoteTasks, ...tasks, sponsoredFixtureTask, ...ownedTasks, ...pastThreadTasks, activeTask, ...(communityTask ? [communityTask] : [])];
  const uniqueTasks = Array.from(new Map(knownTasks.map((task) => [task.id, task])).values());
  const byId = (id: string) => uniqueTasks.find((task) => task.id === id);
  const savedTasks = uniqueTasks.filter((task) => savedTaskIds.includes(task.id));
  const receiptEvents = Object.entries(taskEvents)
    .flatMap(([taskId, events]) => events.map((event) => ({ task: byId(taskId), event })))
    .filter(({ event }) => /(payment|payout|hold|receipt|show-up fee)/i.test(event.text))
    .slice(-4)
    .reverse();
  const historicalReceipt = persona === "youth"
    ? { title: "Historical fixture · Library welcome kits", text: "$18 test payout · July 28 · guardian-approved fixture" }
    : persona === "guardian"
      ? { title: "Historical fixture · Youth task review", text: "$18 test payout record · July 28 · view-only guardian context" }
      : { title: "Historical fixture · Porch light timer", text: "$20 test payout · July 30 · completed fixture" };
  return <MobileScroll className="app-screen route-scroll"><div className="route-page route-bottom-pad profile-info-page">
    {kind === "saved" ? <><p className="eyebrow">Come back when it fits</p><h1>Saved nearby tasks.</h1><p className="lead">{savedTasks.length ? `${savedTasks.length} ${savedTasks.length === 1 ? "task is" : "tasks are"} saved in this local session.` : "Saved state is kept only in this local session."}</p>{savedTasks.map((task) => { const unavailable = hasExpired(task, new Date()) || Boolean(task.listingPaused) || acceptedTaskIds.includes(task.id) || closedTaskIds.includes(task.id) || Boolean(moderationHolds[task.id]) || blockedThreadIds.includes(task.id) || blockedRequesterNames.includes(getTaskDetails(task).requester); return <div key={task.id} className="saved-task-wrap"><TaskCard task={task} unavailable={unavailable} onOpen={(selected) => { setSelectedTaskId(selected.id); setActiveTab("nearby"); flow.pop(); }} /><button className="text-button" onClick={() => setSavedTaskIds((current) => current.filter((id) => id !== task.id))}>Remove from saved</button></div>; })}{!savedTasks.length ? <div className="empty-state"><Tag size={34} weight="duotone" /><h2>No saved tasks yet.</h2><p>Use Save task on a nearby task detail to keep it here.</p></div> : null}</> : null}
    {kind === "payments" ? <><p className="eyebrow">Transparent test states</p><h1>Money stays clearly labeled.</h1><p className="lead">No card, bank account, charge, refund, or payout is connected.</p><section className="review-list"><ReviewRow icon={CurrencyDollar} title="Requester payment" text="No saved method · provider setup deferred" /><ReviewRow icon={ShieldCheck} title="Helper payout" text="No payout account · identity checks deferred" /></section><section className="detail-section"><h2>Simulated receipts</h2><div className="review-list">{receiptEvents.map(({ task, event }) => <ReviewRow key={`${task?.id ?? "session"}-${event.id}`} icon={ListChecks} title={task?.title ?? "Session task"} text={`${event.text} No real money moved.`} />)}<ReviewRow icon={ListChecks} title={historicalReceipt.title} text={`${historicalReceipt.text} · no real money moved`} />{!receiptEvents.length ? <ReviewRow icon={Info} title="No new session receipt" text="Complete a paid task flow to add a simulated receipt here." /> : null}</div></section><div className="truth-card"><Info size={21} /><div><strong>Production boundary</strong><span>A payment provider must own authorization, capture, refund, and payout state later.</span></div></div></> : null}
    {kind === "blocked" ? <><p className="eyebrow">Contact controls</p><h1>Blocked people.</h1><p className="lead">Blocking removes that requester’s open listings and disables their task composers in this session.</p>{blockedRequesterNames.length ? blockedRequesterNames.map((person) => { const task = uniqueTasks.find((item) => getTaskDetails(item).requester === person); return <article key={person} className="profile-info-card"><span className="avatar">{task ? getTaskDetails(task).initials : "LF"}</span><div><strong>{person}</strong><small>{task?.title ?? "Local fixture requester"}</small></div><button className="secondary-button" onClick={() => { setBlockedRequesterNames((current) => current.filter((item) => item !== person)); setBlockedThreadIds((current) => current.filter((id) => { const blockedTask = byId(id); return blockedTask ? getTaskDetails(blockedTask).requester !== person : false; })); }}>Unblock</button></article>; }) : <div className="empty-state"><ShieldCheck size={34} weight="duotone" /><h2>No one is blocked.</h2><p>Any local fixture you block from a task thread will appear here.</p></div>}</> : null}
    {kind === "support" ? <><p className="eyebrow">Safety without guesswork</p><h1>Help &amp; support.</h1><p className="lead">Reports pause the matching workflow in this prototype. For immediate danger, contact local emergency services.</p>{reportedTaskIds.length ? reportedTaskIds.map((id) => { const task = byId(id); return <article key={id} className="support-review-card"><div className="status-badge"><Warning size={14} weight="fill" /> Awaiting support</div><h2>{task?.title ?? "Task report"}</h2><p><strong>Reason:</strong> {reportReasons[id] ?? "Scope or safety concern"}</p><p>No live support ticket was created. Participants cannot clear their own report; support authority and resolution records require the deferred backend.</p></article>; }) : <div className="empty-state"><CheckCircle size={34} weight="duotone" /><h2>No open reports.</h2><p>Task reports and their workflow pauses will appear here.</p></div>}<section className="review-list support-guidance"><ReviewRow icon={ChatCircle} title="Keep details in Micro" text="Use the task thread for scope, arrival, and cancellation changes." /><ReviewRow icon={ShieldCheck} title="Protect private information" text="Do not share phone numbers, entry codes, payment details, or identity documents." /></section></> : null}
  </div></MobileScroll>;
}

function makeYouthScreen(): FlowScreen {
  return { id: "youth", headerHeight: 66, header: (flow) => <RouteHeader title="Youth Mode" onBack={flow.pop} />, render: () => <YouthScreen /> };
}

function YouthScreen() {
  const { youthApprovedTaskId, setYouthApprovedTaskId, youthApprovalTaskId, setYouthApprovalTaskId, youthDeclinedTaskId, setYouthDeclinedTaskId, guardianSupervisedTaskId, guardianSupervisionStatus, persona, setPersona, accessTermsAccepted, guardianLinked, youthAge } = useMicro();
  const reviewTaskId = youthApprovalTaskId ?? youthApprovedTaskId ?? guardianSupervisedTaskId ?? youthDeclinedTaskId ?? "pantry";
  const youthTask = [...tasks, sponsoredFixtureTask].find((task) => task.id === reviewTaskId && task.youthEligible) ?? tasks[3];
  const youthDetail = getTaskDetails(youthTask);
  const status = guardianSupervisedTaskId === youthTask.id ? "active" : youthApprovedTaskId === youthTask.id ? "approved" : youthApprovalTaskId === youthTask.id ? "pending" : youthDeclinedTaskId === youthTask.id ? "declined" : "not requested";
  const eligibleToRequest = youthAge >= 15 && guardianLinked && accessTermsAccepted;
  const requestApproval = () => { if (!eligibleToRequest) return; setYouthApprovalTaskId(youthTask.id); setYouthApprovedTaskId(null); setYouthDeclinedTaskId(null); };
  const withdraw = () => { setYouthApprovalTaskId(null); setYouthDeclinedTaskId(null); };
  return (
    <MobileScroll className="app-screen route-scroll">
      <div className="route-page route-bottom-pad">
        <div className="youth-hero"><span><ShieldCheck size={34} weight="fill" /></span><div><p className="eyebrow">Built around permission</p><h1>One task at a time.</h1><p>Youth Mode is for ages 15–17. Every eligible task still requires a guardian to review its exact scope, schedule, setting, tools, and pay.</p></div></div>
        <fieldset className="persona-switch"><legend>Viewing as</legend><div className="segmented-row">{(["youth", "guardian", "adult"] as const).map((value) => <button key={value} aria-pressed={persona === value} data-active={persona === value ? "true" : "false"} onClick={() => setPersona(value)}>{value === "youth" ? "Sam · youth" : value === "guardian" ? "Maya · guardian" : "Alex · adult"}</button>)}</div></fieldset>
        {youthAge < 15 ? <section className="blocked-task age-gate-card" role="status"><div><Warning size={21} weight="fill" /><span><strong>Sam is not eligible yet</strong><small>Youth Mode begins at age 15</small></span></div><p>The age-14 fixture can browse public safety information but cannot request approval or accept tasks.</p></section> : null}
        <section className="youth-card" data-approved={status === "approved" || status === "active" ? "true" : "false"}><div className="mode-badge"><SealCheck size={14} weight="fill" /> Youth eligible</div><h2>{youthTask.title}</h2><div className="requester-trust-strip"><span className="avatar">{youthDetail.initials}</span><span><strong>{youthDetail.requester}</strong><small>{youthDetail.trust}</small></span></div><div className="task-facts"><span><MapPin size={17} /> {youthDetail.address}</span><span><Clock size={17} /> {youthTask.time}</span>{youthTask.earning ? <span><Sparkle size={17} /> Helper receives ${youthTask.earning}</span> : <span><HandHeart size={17} /> Volunteer · no payment</span>}</div><div className="guardian-panel" role="status" aria-live="polite"><strong>{status === "active" ? "Guardian-approved task lifecycle" : status === "approved" ? "Guardian approved this task" : status === "pending" ? "Waiting for Maya’s review" : status === "declined" ? "Guardian declined this task" : "Guardian approval required"}</strong><span>{status === "active" ? guardianSupervisionStatus : status === "approved" ? "Approved by Maya K. · this exact scope and time" : status === "declined" ? "Sam cannot accept this task unless a new review is requested." : "Approval applies only to this task and time."}</span></div>{persona === "youth" && (status === "not requested" || status === "declined") ? <button className="primary-button" disabled={!eligibleToRequest} onClick={requestApproval}>{youthAge < 15 ? "Available at age 15" : !accessTermsAccepted ? "Accept terms first" : !guardianLinked ? "Link a guardian first" : status === "declined" ? "Request a new review" : "Request Maya’s approval"}</button> : null}{persona === "youth" && status === "pending" ? <button className="secondary-button youth-withdraw" onClick={withdraw}>Ask Maya to withdraw request</button> : null}{persona === "guardian" && status === "pending" ? <div className="guardian-actions"><button className="secondary-button" onClick={() => { setYouthApprovedTaskId(null); setYouthApprovalTaskId(null); setYouthDeclinedTaskId(youthTask.id); }}>Decline</button><button className="primary-button" onClick={() => { setYouthApprovedTaskId(youthTask.id); setYouthApprovalTaskId(null); setYouthDeclinedTaskId(null); }}>Approve this task</button></div> : null}</section>
        <section className="blocked-task"><div><Warning size={21} weight="fill" /><span><strong>Blocked in Youth Mode</strong><small>Move patio furniture after 8 PM</small></span></div><p>This task is outside Youth Mode daylight hours, so it cannot be approved.</p></section>
        <section className="detail-section"><h2>Guardian review included</h2><ul className="check-list"><li><CheckCircle size={19} weight="fill" /> Public community-center location</li><li><CheckCircle size={19} weight="fill" /> No power tools or vehicle use</li><li><CheckCircle size={19} weight="fill" /> Daylight start and 60-minute limit</li><li><CheckCircle size={19} weight="fill" /> Requester trust signals and task messages</li></ul></section>
      </div>
    </MobileScroll>
  );
}

function makeDemoAccessScreen(): FlowScreen {
  return { id: "demo-access", headerHeight: 66, header: (flow) => <RouteHeader title="Demo identity" onBack={flow.pop} />, render: () => <DemoAccessScreen /> };
}

function DemoAccessScreen() {
  const { persona, setPersona, accessTermsAccepted, setAccessTermsAccepted, guardianLinked, setGuardianLinked, youthAge, setYouthAge, setYouthApprovedTaskId, setYouthApprovalTaskId, setYouthDeclinedTaskId } = useMicro();
  const participationReady = accessTermsAccepted && (persona !== "youth" || (youthAge >= 15 && guardianLinked));
  const clearYouthDecisions = () => { setYouthApprovedTaskId(null); setYouthApprovalTaskId(null); setYouthDeclinedTaskId(null); };
  const setAge = (age: 14 | 16) => { setYouthAge(age); if (age < 15) clearYouthDecisions(); };
  const toggleTerms = () => { const next = !accessTermsAccepted; setAccessTermsAccepted(next); if (!next) clearYouthDecisions(); };
  const toggleGuardian = () => { const next = !guardianLinked; setGuardianLinked(next); if (!next) clearYouthDecisions(); };
  const age = persona === "youth" ? `${youthAge} years old` : "18+";
  return <MobileScroll className="app-screen route-scroll"><div className="route-page route-bottom-pad"><p className="eyebrow">Seeded onboarding states</p><h1>Test access, clearly labeled.</h1><p className="lead">These controls model identity and consent screens without creating a real account.</p><section className="workflow-card"><div className="profile-preview access-profile"><span className="avatar">{persona === "youth" ? "SK" : persona === "guardian" ? "MK" : "AK"}</span><div><span className="mini-label">Local fixture</span><strong>{persona === "youth" ? "sam@micro.demo" : persona === "guardian" ? "maya@micro.demo" : "alex@micro.demo"}</strong><p>Email verified in test data only</p></div></div></section><fieldset className="persona-switch"><legend>Participation profile</legend><div className="segmented-row">{(["adult", "youth", "guardian"] as const).map((value) => <button key={value} aria-pressed={persona === value} data-active={persona === value ? "true" : "false"} onClick={() => setPersona(value)}>{value}</button>)}</div></fieldset>{persona === "youth" ? <fieldset className="persona-switch age-choice"><legend>Youth age fixture</legend><div className="segmented-row two-segments"><button aria-pressed={youthAge === 14} data-active={youthAge === 14 ? "true" : "false"} onClick={() => setAge(14)}>14 · not eligible</button><button aria-pressed={youthAge === 16} data-active={youthAge === 16 ? "true" : "false"} onClick={() => setAge(16)}>16 · eligible</button></div></fieldset> : null}<div className="access-status" data-ready={participationReady ? "true" : "false"} role="status"><ShieldCheck size={19} weight="fill" /><span><strong>{participationReady ? "Participation ready" : "Participation paused"}</strong>{participationReady ? "Required test-state checks are active." : "Resolve the age, terms, or guardian requirement below."}</span></div><section className="review-list"><ReviewRow icon={UserCircle} title="Age gate" text={`${age} fixture selected. Youth Mode is limited to ages 15–17; production verification is not connected.`} /><ReviewRow icon={ShieldCheck} title="Terms & community standards" text={accessTermsAccepted ? "Accepted in this local session." : "Acceptance required before participation."} /><ReviewRow icon={UsersThree} title="Guardian link" text={persona === "youth" ? guardianLinked ? "Maya K. is linked for task-specific approvals." : "A guardian must be linked before accepting youth tasks." : "Guardian linking applies only to Youth Mode."} /></section><button className="choice-row" aria-pressed={accessTermsAccepted} data-selected={accessTermsAccepted ? "true" : "false"} onClick={toggleTerms}><span><strong>I accept the test terms</strong><small>No real account or legal acceptance is created.</small></span><span className="checkbox">{accessTermsAccepted ? <Check size={14} weight="bold" /> : null}</span></button>{persona === "youth" ? <button className="choice-row" aria-pressed={guardianLinked} data-selected={guardianLinked ? "true" : "false"} onClick={toggleGuardian}><span><strong>Link Maya K. as guardian</strong><small>Local fixture only</small></span><span className="checkbox">{guardianLinked ? <Check size={14} weight="bold" /> : null}</span></button> : null}<div className="demo-card"><Info size={20} /><div><strong>Backend intentionally deferred</strong><span>Production auth, age verification, consent records, and guardian invitations need secure services later.</span></div></div></div></MobileScroll>;
}

function RouteHeader({ title, onBack, right, wrap = false }: { title: string; onBack: () => void; right?: ReactNode; wrap?: boolean }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);
  return <div className={`route-header${wrap ? " route-header-wrap" : ""}`}><button className="icon-button" aria-label="Go back" onClick={onBack}><CaretLeft size={24} weight="bold" /></button><h1 ref={titleRef} tabIndex={-1}>{title}</h1><span className="header-action-slot">{right}</span></div>;
}

function PageTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return <header className="page-title">{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</header>;
}

function StepRail({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="step-rail"
      role="progressbar"
      aria-label="Post task progress"
      aria-valuemin={1}
      aria-valuemax={total + 1}
      aria-valuenow={current + 1}
      aria-valuetext={`Step ${current + 1} of ${total + 1}`}
    >
      {Array.from({ length: total + 1 }).map((_, index) => <span key={index} data-active={index <= current ? "true" : "false"} />)}
    </div>
  );
}

function FactTile({ icon: FactIcon, label, value }: { icon: Icon; label: string; value: string }) {
  return <div className="fact-tile"><FactIcon size={20} weight="bold" /><span>{label}</span><strong>{value}</strong></div>;
}

function ReviewRow({ icon: RowIcon, title, text }: { icon: Icon; title: string; text: string }) {
  return <div className="review-row"><span><RowIcon size={21} weight="bold" /></span><div><strong>{title}</strong><p>{text}</p></div></div>;
}
