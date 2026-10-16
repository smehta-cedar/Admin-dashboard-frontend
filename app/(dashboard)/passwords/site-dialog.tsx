"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import type { SiteError, SiteRecord } from "@/lib/site-passwords";
import { saveSite } from "./site-actions";

/*
 * Add site / Edit site, opened from the Site dropdown on the site password
 * form (./site-password-form.tsx): Name and Link. Sites have no page or list
 * of their own. The save goes through saveSite (./site-actions.ts); the API
 * keeps names unique whatever their case and checks the link is a URL. On
 * success the dialog hands the saved site back, and the form selects it.
 *
 * Render it outside the page's <form>: a dialog form can't nest in another.
 */

/** Which dialog is open: add, or edit the site held. */
export type SiteEditor = { mode: "add" } | { mode: "edit"; site: SiteRecord };

type SiteDialogProps = {
  /** Null keeps the dialog closed. */
  editor: SiteEditor | null;
  onSaved: (site: SiteRecord) => void;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function SiteDialog({ editor, onSaved, onClose }: SiteDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose} className="max-w-lg">
      {editor ? <SiteForm id={id} editor={editor} onSaved={onSaved} close={close} /> : null}
    </ModalDialog>
  );
}

type SiteFormProps = {
  id: string;
  editor: SiteEditor;
  onSaved: (site: SiteRecord) => void;
  close: () => void;
};

function SiteForm({ id, editor, onSaved, close }: SiteFormProps) {
  const editing = editor.mode === "edit" ? editor.site : undefined;
  const [errors, setErrors] = useState<SiteError[]>([]);
  const [saving, setSaving] = useState(false);

  const messageFor = (field: SiteError["field"]) => errors.find((error) => error.field === field)?.message ?? null;
  const nameError = messageFor("name");
  const linkError = messageFor("link");
  const formError = messageFor("form");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const values = {
      name: String(data.get("name") ?? "").trim(),
      link: String(data.get("link") ?? "").trim(),
    };
    setSaving(true);
    try {
      const result = await saveSite(values, editing?.id);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      onSaved(result.site);
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {editing ? `Edit ${editing.name}` : "Add site"}
      </h2>

      <div className="mt-5 grid gap-4">
        <Field label="Name" required htmlFor={`${id}-name`} hint={nameError ?? undefined} hintId={`${id}-name-error`} error>
          <input
            id={`${id}-name`}
            name="name"
            type="text"
            required
            pattern=".*\S.*"
            maxLength={255}
            autoComplete="off"
            defaultValue={editing?.name}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${id}-name-error` : undefined}
            onChange={() => setErrors((current) => current.filter((error) => error.field !== "name"))}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Link" htmlFor={`${id}-link`} hint={linkError ?? undefined} hintId={`${id}-link-error`} error>
          <input
            id={`${id}-link`}
            name="link"
            type="url"
            maxLength={2000}
            autoComplete="off"
            placeholder="https://"
            defaultValue={editing?.link}
            aria-invalid={linkError ? true : undefined}
            aria-describedby={linkError ? `${id}-link-error` : undefined}
            onChange={() => setErrors((current) => current.filter((error) => error.field !== "link"))}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <div role="alert" className="mt-4">
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={close} disabled={saving} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add site"}
        </button>
      </div>
    </form>
  );
}
