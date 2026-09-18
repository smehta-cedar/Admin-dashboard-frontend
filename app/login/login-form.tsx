"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { setSessionCookie } from "@/lib/fake-session";
import type { UserRecord } from "@/lib/users";
import { PasswordInput } from "../(dashboard)/logins/credential-value";

/** The slice of each user the match needs. */
type LoginUser = Pick<UserRecord, "id" | "email" | "password" | "status">;

type LoginFormProps = {
  users: LoginUser[];
};

/**
 * Email + password, matched in the browser against the loaded users: email
 * ignoring case, password exactly. A match sets the session cookie and goes
 * to the dashboard; the error stays under the form otherwise.
 */
export function LoginForm({ users }: LoginFormProps) {
  const router = useRouter();
  const id = useId();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    // Not trimmed: spaces and case matter in a password.
    const password = String(data.get("password") ?? "");

    const user = users.find((candidate) => candidate.email.toLowerCase() === email);
    // One message for both, so the form doesn't confirm which emails exist.
    if (!user || user.password !== password) {
      setError("Email or password is wrong.");
      return;
    }
    if (user.status === "inactive") {
      setError("That account is inactive.");
      return;
    }

    setSessionCookie(user.id);
    // The dashboard layout reads the cookie on the server; refresh so no
    // cached signed-out render is reused.
    router.push("/");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <Field label="Email" htmlFor={`${id}-email`}>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={() => setError(null)}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Password" htmlFor={`${id}-password`}>
        <PasswordInput
          id={`${id}-password`}
          name="password"
          required
          autoComplete="current-password"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={() => setError(null)}
          className={INPUT_CLASS}
        />
      </Field>

      {/* Stays mounted so the error is announced when it appears. */}
      <p id={`${id}-error`} role="alert" className="min-h-4 text-xs text-danger">
        {error}
      </p>

      <button type="submit" className={`${PRIMARY_BUTTON_CLASS} w-full`}>
        Sign in
      </button>
    </form>
  );
}
