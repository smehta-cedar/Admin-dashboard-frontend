"use client";

import { useId, useState } from "react";
import { GHOST_BUTTON_CLASS } from "@/components/classes";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";

/*
 * A small confirmation popup. Nothing is deleted until Delete is chosen;
 * Cancel, Escape and the backdrop leave it in place.
 */

type ConfirmDialogProps = {
  /** Closed when null. */
  open: boolean;
  title: string;
  message: string;
  /** Runs the delete. The popup stays up until this finishes, then closes. */
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export function ConfirmDialog({ open, title, message, onConfirm, onClose }: ConfirmDialogProps) {
  const { dialogRef, close } = useModalDialog(open);
  const titleId = useId();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={titleId} onClose={onClose} className="max-w-md">
      {open ? (
        <div className="p-6">
          <h2 id={titleId} className="text-base font-semibold text-fg">
            {title}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">{message}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={close} disabled={busy} className={GHOST_BUTTON_CLASS}>
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="rounded-md bg-danger-strong px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ) : null}
    </ModalDialog>
  );
}
