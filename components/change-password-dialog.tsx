"use client";

import { useActionState, useId, useState, type ChangeEvent } from "react";
import { changePassword, type ChangePasswordState } from "@/app/(dashboard)/profile/actions";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { PasswordInput } from "@/components/credential-value";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";

/*
 * The Change password popup, opened from the navbar's account menu and the
 * profile page. Current password, new password and its confirmation are
 * posted to the `changePassword` server action, which asks the API and stores
 * the fresh token pair it issues. A message about one field shows under that
 * field, one about the attempt (throttled, API down) under the form; all
 * clear when any field is edited. Success swaps the form for a confirmation.
 *
 * Mounted per open inside a ModalDialog, so its fields and errors start
 * clear each time.
 */

const INITIAL_STATE: ChangePasswordState = { fieldErrors: {}, error: null, done: false };

type ChangePasswordDialogProps = {
  open: boolean;
  /** Runs for every close: Cancel, Escape, backdrop click, or Done. */
  onClose: () => void;
};

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const { dialogRef, close } = useModalDialog(open);
  const id = useId();

  // Closing unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {open ? <ChangePasswordForm id={id} close={close} /> : null}
    </ModalDialog>
  );
}

/** A "Change password" button with its dialog, for the profile page. */
export function ChangePasswordButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={className}>
        Change password
      </button>
      <ChangePasswordDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * The dialog's form. The inputs are controlled: React resets a form's
 * uncontrolled fields after its action settles, which would wipe all three
 * on a wrong current password.
 */
function ChangePasswordForm({ id, close }: { id: string; close: () => void }) {
  const [state, formAction, pending] = useActionState(changePassword, INITIAL_STATE);
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  // The state object is replaced on every submit, so "dismissed" is scoped to
  // the current result: typing hides its messages, and the next result shows again.
  const [dismissedFor, setDismissedFor] = useState<ChangePasswordState | null>(null);
  const shown = dismissedFor === state ? INITIAL_STATE : state;

  if (state.done) {
    return (
      <div className="p-6">
        <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
          Password changed
        </h2>
        <p role="status" className="mt-1 text-sm text-fg-muted">
          Your new password is in effect. You stay signed in here; any other device will have to sign
          in again.
        </p>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={close} autoFocus className={PRIMARY_BUTTON_CLASS}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const fieldProps = (field: keyof typeof values, autoComplete: "current-password" | "new-password") => {
    const message = shown.fieldErrors[field];
    return {
      field: { hint: message, hintId: `${id}-${field}-error`, error: Boolean(message) },
      input: {
        id: `${id}-${field}`,
        name: field,
        required: true,
        autoComplete,
        spellCheck: false,
        value: values[field],
        "aria-invalid": message ? (true as const) : undefined,
        "aria-describedby": message ? `${id}-${field}-error` : shown.error ? `${id}-error` : undefined,
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
          setValues((current) => ({ ...current, [field]: event.target.value }));
          setDismissedFor(state);
        },
        className: INPUT_CLASS,
      },
    };
  };
  const current = fieldProps("currentPassword", "current-password");
  const next = fieldProps("newPassword", "new-password");
  const confirm = fieldProps("confirmPassword", "new-password");

  return (
    <form action={formAction} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        Change password
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        Choose a password you don&apos;t use anywhere else. Changing it signs out every other device.
      </p>

      <div className="mt-5 grid gap-4">
        <Field label="Current password" htmlFor={current.input.id} {...current.field}>
          <PasswordInput autoFocus {...current.input} />
        </Field>
        <Field label="New password" htmlFor={next.input.id} {...next.field}>
          <PasswordInput {...next.input} />
        </Field>
        <Field label="Confirm new password" htmlFor={confirm.input.id} {...confirm.field}>
          <PasswordInput {...confirm.input} />
        </Field>
      </div>

      {/* Stays mounted so the error is announced when it appears. */}
      <p id={`${id}-error`} role="alert" className="mt-3 min-h-4 text-xs text-danger">
        {shown.error}
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={close} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? "Changing…" : "Change password"}
        </button>
      </div>
    </form>
  );
}
