"use client";

import { useActionState, useId, useState } from "react";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { PasswordInput } from "@/components/credential-value";
import { Field } from "@/components/field";
import { agentLogin, login, requestAgentCode, type AgentCodeState, type LoginState } from "./actions";

const INITIAL_STATE: LoginState = { fieldErrors: {}, error: null };

type Mode = "staff" | "agent";

/**
 * Staff sign in with email and password. Agents sign in with their work
 * Gmail and the code emailed to it — no password. Each posts to its own
 * server action. On success the action redirects (staff to the CRM, agents
 * to their view). A message about one field shows under that field, and a
 * message about the attempt under the form; both clear when a field is edited.
 *
 * The inputs are controlled: React resets a form's uncontrolled fields after
 * its action settles, which would wipe them on a failed attempt.
 */
export function LoginForm() {
  const id = useId();
  const [mode, setMode] = useState<Mode>("staff");

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-1 rounded-md bg-canvas p-1" role="group" aria-label="Sign-in type">
        {(
          [
            ["staff", "Admin"],
            ["agent", "Agent"],
          ] as const
        ).map(([value, label]) => {
          const selected = mode === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => setMode(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                selected ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {mode === "agent" ? <AgentFields id={id} /> : <StaffFields id={id} />}
    </div>
  );
}

function StaffFields({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(login, INITIAL_STATE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dismissedFor, setDismissedFor] = useState<LoginState | null>(null);
  const shown = dismissedFor === state ? INITIAL_STATE : state;
  const emailError = shown.fieldErrors.email;
  const passwordError = shown.fieldErrors.password;
  const formError = shown.error;

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <Field
        label="Email"
        htmlFor={`${id}-email`}
        hint={emailError}
        hintId={`${id}-email-error`}
        error={Boolean(emailError)}
      >
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          value={email}
          aria-invalid={emailError || formError ? true : undefined}
          aria-describedby={emailError ? `${id}-email-error` : formError ? `${id}-error` : undefined}
          onChange={(event) => {
            setEmail(event.target.value);
            setDismissedFor(state);
          }}
          className={INPUT_CLASS}
        />
      </Field>
      <Field
        label="Password"
        htmlFor={`${id}-password`}
        hint={passwordError}
        hintId={`${id}-password-error`}
        error={Boolean(passwordError)}
      >
        <PasswordInput
          id={`${id}-password`}
          name="password"
          required
          autoComplete="current-password"
          spellCheck={false}
          value={password}
          aria-invalid={passwordError || formError ? true : undefined}
          aria-describedby={passwordError ? `${id}-password-error` : formError ? `${id}-error` : undefined}
          onChange={(event) => {
            setPassword(event.target.value);
            setDismissedFor(state);
          }}
          className={INPUT_CLASS}
        />
      </Field>
      <FormError id={id} message={formError} />
      <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON_CLASS} w-full`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <div className="text-center">
        <button
          type="button"
          className="text-xs font-medium text-brand-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Forgot password?
        </button>
      </div>
    </form>
  );
}

const NO_CODE_REQUEST: AgentCodeState = { sentTo: null, error: null };

/**
 * Two steps: the work Gmail and "Email me a code", then, once that is sent,
 * the code from the email and Sign in. The code box doesn't exist until the
 * Gmail has gone to the API. "Use a different email" goes back to step one.
 */
function AgentFields({ id }: { id: string }) {
  const [request, requestAction, requesting] = useActionState(requestAgentCode, NO_CODE_REQUEST);
  const [email, setEmail] = useState("");
  const [dismissedFor, setDismissedFor] = useState<AgentCodeState | null>(null);
  const shown = dismissedFor === request ? NO_CODE_REQUEST : request;

  if (shown.sentTo) {
    return <AgentCodeStep id={id} email={shown.sentTo} onChangeEmail={() => setDismissedFor(request)} />;
  }

  const emailError = shown.emailError;
  const formError = shown.error;
  return (
    <form action={requestAction} className="mt-4 space-y-4">
      <Field
        label="Work Gmail"
        htmlFor={`${id}-work-email`}
        hint={emailError}
        hintId={`${id}-work-email-error`}
        error={Boolean(emailError)}
      >
        <input
          id={`${id}-work-email`}
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          value={email}
          aria-invalid={emailError || formError ? true : undefined}
          aria-describedby={emailError ? `${id}-work-email-error` : formError ? `${id}-agent-error` : undefined}
          onChange={(event) => {
            setEmail(event.target.value);
            setDismissedFor(request);
          }}
          className={INPUT_CLASS}
        />
      </Field>
      <FormError id={`${id}-agent`} message={formError} />
      <button type="submit" disabled={requesting} className={`${PRIMARY_BUTTON_CLASS} w-full`}>
        {requesting ? "Sending…" : "Email me a code"}
      </button>
    </form>
  );
}

function AgentCodeStep({ id, email, onChangeEmail }: { id: string; email: string; onChangeEmail: () => void }) {
  const [state, formAction, pending] = useActionState(agentLogin, INITIAL_STATE);
  const [code, setCode] = useState("");
  const [dismissedFor, setDismissedFor] = useState<LoginState | null>(null);
  const shown = dismissedFor === state ? INITIAL_STATE : state;
  const codeError = shown.fieldErrors.code;
  // An email error here can only be about the address already sent, so it shows under the form.
  const formError = shown.error ?? shown.fieldErrors.email ?? null;

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="email" value={email} />
      <p className="text-sm text-fg-muted" role="status">
        If <span className="font-medium text-fg">{email}</span> belongs to an agent, a code has been emailed there. It
        expires in 5 minutes.
      </p>
      <Field
        label="Code"
        htmlFor={`${id}-code`}
        hint={codeError}
        hintId={`${id}-code-error`}
        error={Boolean(codeError)}
      >
        <input
          id={`${id}-code`}
          name="code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          required
          autoComplete="one-time-code"
          autoFocus
          spellCheck={false}
          value={code}
          aria-invalid={codeError || formError ? true : undefined}
          aria-describedby={codeError ? `${id}-code-error` : formError ? `${id}-agent-error` : undefined}
          onChange={(event) => {
            setCode(event.target.value);
            setDismissedFor(state);
          }}
          className={INPUT_CLASS}
        />
      </Field>
      <FormError id={`${id}-agent`} message={formError} />
      <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON_CLASS} w-full`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <div className="text-center">
        <button
          type="button"
          onClick={onChangeEmail}
          className="text-xs font-medium text-brand-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Use a different email
        </button>
      </div>
    </form>
  );
}

function FormError({ id, message }: { id: string; message: string | null }) {
  return (
    <p id={`${id}-error`} role="alert" className="min-h-4 text-xs text-danger">
      {message}
    </p>
  );
}
