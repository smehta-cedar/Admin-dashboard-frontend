"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";

/*
 * Username and password controls for the Logins page. In the table, a value
 * copies when you click it or its copy button; a password shows a fixed mask
 * until its eye button reveals it. The form's password input is
 * type="password" until its eye button shows it. Reveal state lives in each
 * component, so a reload, a filtered-out row, or a new login starts hidden.
 */

/** Same length for every password, so the mask doesn't give away the real length. */
const MASK = "••••••••";

const ICON_BUTTON_CLASS =
  "cursor-pointer rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900";

type CopyStatus = "idle" | "copied" | "failed";

/** Copies `value` exactly as given; the status resets to idle after 1.5 seconds. */
function useCopy(value: string) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timeout = setTimeout(() => setStatus("idle"), 1500);
    return () => clearTimeout(timeout);
  }, [status]);

  const copy = async () => {
    try {
      // Missing outside secure contexts (e.g. plain http on a LAN address).
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return { status, copy };
}

type CredentialValueProps = {
  value: string;
  /** Names the value in button labels. */
  label: "username" | "password";
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
        className={`-ml-1 cursor-pointer whitespace-pre rounded-md px-1 py-0.5 hover:bg-gray-100 hover:text-gray-900 ${secret ? "font-mono" : ""}`}
      >
        {hidden ? (
          <>
            <span aria-hidden="true">{MASK}</span>
            <span className="sr-only">Hidden password</span>
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
          aria-label={hidden ? "Show password" : "Hide password"}
          className={ICON_BUTTON_CLASS}
        >
          {hidden ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      ) : null}
      <span className="relative inline-flex">
        <button type="button" onClick={copy} aria-label={`Copy ${label}`} className={ICON_BUTTON_CLASS}>
          {status === "copied" ? <CheckIcon /> : <CopyIcon />}
        </button>
        {/* Feedback floats above the icon so the cell never changes width. The
            live region stays mounted; only the label inside it comes and goes. */}
        <span
          aria-live="polite"
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap"
        >
          {status !== "idle" ? (
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium text-white ${status === "failed" ? "bg-red-700" : "bg-gray-900"}`}
            >
              {status === "copied" ? "Copied" : "Couldn't copy"}
            </span>
          ) : null}
        </span>
      </span>
    </div>
  );
}

/** The form's password input: type="password" until the eye button shows it. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={revealed ? "text" : "password"} className={`${className ?? ""} pr-10!`} />
      {/* top-1/2 + mt-0.5 centres on the input, which sits below the wrapper's top by its mt-1. */}
      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        aria-label={revealed ? "Hide password" : "Show password"}
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

function CopyIcon() {
  return (
    <Icon>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7" />
    </Icon>
  );
}

function CheckIcon() {
  return (
    <Icon>
      <path d="M4 10.5l4 4 8-9" />
    </Icon>
  );
}
