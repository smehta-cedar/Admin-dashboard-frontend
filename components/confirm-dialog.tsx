"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
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
  /** The confirm button's label. Defaults to Delete. */
  confirmLabel?: string;
  /** Shown on the confirm button while onConfirm runs. Defaults to Deleting…. */
  busyLabel?: string;
};

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onClose,
  confirmLabel = "Delete",
  busyLabel = "Deleting…",
}: ConfirmDialogProps) {
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
    <ModalDialog dialogRef={dialogRef} labelledBy={titleId} onClose={onClose} className="max-w-md overflow-y-auto">
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
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </ModalDialog>
  );
}

type ConfirmRequest = { title: string; message: string; confirmLabel?: string };

/**
 * Asks before a delete from anywhere in a component: `await confirm({...})`
 * resolves true for Delete, false for Cancel. Render `confirmDialog` once.
 */
export function useConfirm(): {
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  confirmDialog: ReactNode;
} {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: ConfirmRequest) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setRequest(next);
      }),
    [],
  );

  const settle = (confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
  };

  const confirmDialog = (
    <ConfirmDialog
      open={request !== null}
      title={request?.title ?? ""}
      message={request?.message ?? ""}
      confirmLabel={request?.confirmLabel}
      onConfirm={() => settle(true)}
      onClose={() => {
        settle(false);
        setRequest(null);
      }}
    />
  );

  return { confirm, confirmDialog };
}
