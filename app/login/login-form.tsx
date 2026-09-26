"use client";

import { useActionState, useId, useState } from "react";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { PasswordInput } from "@/components/credential-value";
import { Field } from "@/components/field";
import { login, type LoginState } from "./actions";

const INITIAL_STATE: LoginState = { fieldErrors: {}, error: null };

/**
 * Email + password, posted to the `login` server action, which asks the API
 * and sets the session cookies. On success the action redirects to the
 * dashboard. On failure a message about one field (blank, not an email)
 * shows under that field, and a message about the attempt (wrong password,
 * blocked, throttled) under the form; all clear when either field is edited.
 *
 * The inputs are controlled: React resets a form's uncontrolled fields after
 * its action settles, which would wipe both fields on a wrong password.
 */
export function LoginForm() {
  const id = useId();
  const [state, formAction, pending] = useActionState(login, INITIAL_STATE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // The state object is replaced on every submit, so "dismissed" is scoped to
  // the current result: typing hides its messages, and the next result shows again.
  const [dismissedFor, setDismissedFor] = useState<LoginState | null>(null);
  const shown = dismissedFor === state ? INITIAL_STATE : state;
  const emailError = shown.fieldErrors.email;
  const passwordError = shown.fieldErrors.password;
  const formError = shown.error;

  return (
    <form action={formAction} className="mt-6 space-y-4">
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

      {/* Stays mounted so the error is announced when it appears. */}
      <p id={`${id}-error`} role="alert" className="min-h-4 text-xs text-danger">
        {formError}
      </p>

      <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON_CLASS} w-full`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>

      {/*
       * Placeholder until the API has a forgot-password flow (request a reset
       * link, then set a new password); today an administrator resets passwords.
       */}
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
