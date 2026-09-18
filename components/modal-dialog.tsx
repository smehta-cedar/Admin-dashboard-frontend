"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

/**
 * Opens the dialog with showModal() once `open` turns true. The form inside
 * mounts with the editor, so this runs after it has rendered.
 */
export function useModalDialog(open: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  const close = () => dialogRef.current?.close();

  return { dialogRef, close };
}

type ModalDialogProps = {
  dialogRef: RefObject<HTMLDialogElement | null>;
  labelledBy: string;
  /** Runs for every close: Escape, backdrop click, or close(). */
  onClose: () => void;
  children: ReactNode;
};

/** Native modal dialog; clicking the backdrop closes it. */
export function ModalDialog({ dialogRef, labelledBy, onClose, children }: ModalDialogProps) {
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onClose={onClose}
      // The content fills the dialog (p-0; the form owns the inset), so only
      // backdrop clicks land here.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg bg-surface p-0 shadow-xl backdrop:bg-scrim"
    >
      {children}
    </dialog>
  );
}
