import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  htmlFor: string;
  optional?: boolean;
  /** Help text below the input, or the error message when `error` is set. */
  hint?: string;
  hintId?: string;
  error?: boolean;
  className?: string;
  children: ReactNode;
};

/** Form label, input, and optional hint or error text. */
export function Field({ label, htmlFor, optional, hint, hintId, error, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
        {optional ? <span className="font-normal text-fg-subtle"> (optional)</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={hintId} className={`mt-1 text-xs ${error ? "text-danger" : "text-fg-subtle"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
