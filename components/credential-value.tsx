"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { CopyButton, useCopy } from "@/components/license-number";

/*
 * Username and password controls, shared by Passwords, Users, the sign-in
 * form and the profiles' Passwords panels (and the agent profile's SSN). In a table, a value copies when
 * you click it or its copy button; a password shows a fixed mask until its eye
 * button reveals it. The form's password input is type="password" until its eye
 * button shows it. Reveal state lives in each component, so a reload, a
 * filtered-out row, or a new password starts hidden.
 */

/** Same length for every password, so the mask doesn't give away the real length. */
const MASK = "••••••••";

const ICON_BUTTON_CLASS =
  "cursor-pointer rounded-md p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg";

type CredentialValueProps = {
  value: string;
  /** Names the value in button labels. */
  label: "username" | "password" | "SSN";
  /** Masked until the eye button reveals it. */
  secret?: boolean;
};

/** A table cell's value with copy (and, for secrets, show/hide) buttons. Empty shows "—". */
export function CredentialValue({ value, label, secret = false }: CredentialValueProps) {
  const { status, copy } = useCopy(value);
  const [revealed, setRevealed] = useState(false);
  // Hide again whenever the value changes (an edit saved a new password), even
  // if it changes back to one shown before. Adjusted during render, so the new
  // value is never shown for a frame.
  const [revealedFor, setRevealedFor] = useState(value);
  if (revealedFor !== value) {
    setRevealedFor(value);
    setRevealed(false);
  }
  const hidden = secret && !revealed;

  if (value === "") return <span>—</span>;

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <button
        type="button"
        onClick={copy}
        className={`-ml-1 cursor-pointer whitespace-pre rounded-md px-1 py-0.5 hover:bg-surface-hover hover:text-fg ${secret ? "font-mono" : ""}`}
      >
        {hidden ? (
          <>
            <span aria-hidden="true">{MASK}</span>
            <span className="sr-only">Hidden {label}</span>
          </>
        ) : (
          value
        )}
        <span className="sr-only"> (copy)</span>
      </button>
      {secret ? (
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
          className={ICON_BUTTON_CLASS}
        >
          {hidden ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      ) : null}
      <CopyButton label={label} status={status} onCopy={() => void copy()} />
    </div>
  );
}

/** The form's password input: type="password" until the eye button shows it. */
export function PasswordInput({
  className,
  label = "password",
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label?: "password" | "SSN" }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={revealed ? "text" : "password"} className={`${className ?? ""} pr-10!`} />
      {/* top-1/2 + mt-0.5 centres on the input, which sits below the wrapper's top by its mt-1. */}
      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
        className={`absolute right-1.5 top-1/2 mt-0.5 -translate-y-1/2 ${ICON_BUTTON_CLASS}`}
      >
        {revealed ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function EyeIcon() {
  return (
    <Icon>
      <path d="M1.75 10S4.75 4.25 10 4.25 18.25 10 18.25 10 15.25 15.75 10 15.75 1.75 10 1.75 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </Icon>
  );
}

function EyeOffIcon() {
  return (
    <Icon>
      <path d="M1.75 10S4.75 4.25 10 4.25 18.25 10 18.25 10 15.25 15.75 10 15.75 1.75 10 1.75 10Z" />
      <circle cx="10" cy="10" r="2.5" />
      <path d="M3 3l14 14" />
    </Icon>
  );
}

