import type { ReactNode } from "react";

/** The red star that marks a required field; the input's own `required` tells assistive tech. */
export function RequiredStar() {
  return (
    <span aria-hidden="true" className="text-danger">
      {" "}
      *
    </span>
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  /** Adds a red star after the label. A form that uses it leaves `optional` off its other fields. */
  required?: boolean;
  optional?: boolean;
  /** Help text below the input, or the error message when `error` is set. */
  hint?: string;
  hintId?: string;
  error?: boolean;
  className?: string;
  children: ReactNode;
};

/** Form label, input, and optional hint or error text. */
export function Field({ label, htmlFor, required, optional, hint, hintId, error, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
        {required ? <RequiredStar /> : null}
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
