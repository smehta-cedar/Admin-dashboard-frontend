"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Panel, PanelEmpty } from "@/components/profile-shell";
import type { AgencyComment } from "@/lib/agency";
import { addAgencyComment, deleteAgencyComment } from "./comment-actions";

/*
 * The agency profile's Notes panel: notes people write on the agency, newest
 * first, each with who wrote it and when. Not the change log, which is the
 * History panel. With `canWrite` (the role can edit agencies) a box at the
 * top adds a note and each note can be deleted, behind a confirm. Times are
 * shown in the browser's time zone, so they render after hydration.
 */

const subscribe = () => () => {};

type AgencyNotesPanelProps = {
  agencyId: string;
  /** Newest first. */
  initialComments: AgencyComment[];
  canWrite: boolean;
  className?: string;
};

export function AgencyNotesPanel({ agencyId, initialComments, canWrite, className }: AgencyNotesPanelProps) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AgencyComment | null>(null);
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = body.trim();
    if (saving || !text) return;
    setSaving(true);
    setError(null);
    try {
      const result = await addAgencyComment(agencyId, text);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setComments((current) => [result.comment, ...current]);
      setBody("");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const message = await deleteAgencyComment(deleting.id);
    if (message) {
      setError(message);
      return;
    }
    setComments((current) => current.filter((comment) => comment.id !== deleting.id));
  };

  return (
    <Panel title="Notes" count={comments.length} className={className}>
      {canWrite ? (
        <form onSubmit={handleSubmit} className="mb-4">
          <textarea
            aria-label="New note"
            rows={3}
            maxLength={5000}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              setError(null);
            }}
            className={`${INPUT_CLASS} resize-y`}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
            <button
              type="submit"
              disabled={saving || !body.trim()}
              className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}
            >
              {saving ? "Adding…" : "Add note"}
            </button>
          </div>
        </form>
      ) : null}

      {comments.length === 0 ? (
        <PanelEmpty>No notes yet.</PanelEmpty>
      ) : (
        <ol className="space-y-2">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-md border border-line bg-surface px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-fg-subtle">
                  {comment.createdBy ?? "Someone"}
                  {hydrated ? (
                    <>
                      {" · "}
                      <time dateTime={comment.createdAt}>
                        {new Date(comment.createdAt).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    </>
                  ) : null}
                </p>
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => setDeleting(comment)}
                    className={`${ROW_BUTTON_CLASS} text-xs text-danger hover:text-danger`}
                  >
                    Delete<span className="sr-only"> note</span>
                  </button>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-fg">{comment.body}</p>
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete note"
        message="Delete this note?"
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </Panel>
  );
}
