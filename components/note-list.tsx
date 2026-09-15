import type { FieldChange } from "@/lib/change-notes";

type Note<F extends string> = {
  id: string;
  kind: "added" | "edited";
  createdAt: string;
  changes: FieldChange<F>[];
};

type NoteListProps<F extends string> = {
  notes: Note<F>[];
  /** Label for each field a change can name. */
  labels: Record<F, string>;
};

/**
 * Change notes, in the order given. Timestamps are formatted in the browser's
 * time zone, so render this only after hydration (e.g. in an expanded row).
 */
export function NoteList<F extends string>({ notes, labels }: NoteListProps<F>) {
  if (notes.length === 0) {
    return <p className="mt-2 text-sm text-gray-500">No changes recorded yet.</p>;
  }

  return (
    <ol className="mt-2 space-y-2">
      {notes.map((note) => (
        <li key={note.id} className="rounded-md border border-gray-200 bg-white px-3 py-2">
          <p className="text-xs text-gray-500">
            {note.kind === "added" ? "Added" : "Edited"} ·{" "}
            <time dateTime={note.createdAt}>{formatTimestamp(note.createdAt)}</time>
          </p>
          <ul className="mt-1 space-y-0.5 break-words text-sm text-gray-700">
            {note.changes.map((change) => (
              <li key={change.field}>
                {change.redacted ? (
                  // Secret value: say only that it was set or changed.
                  <>
                    <span className="font-medium text-gray-900">{labels[change.field]}</span>{" "}
                    {note.kind === "added" ? "set" : "changed"}
                  </>
                ) : (
                  <>
                    <span className="font-medium text-gray-900">{labels[change.field]}:</span>{" "}
                    {note.kind === "added" ? (
                      change.to
                    ) : (
                      <>
                        {change.from || "(empty)"} <span aria-hidden="true">→</span>
                        <span className="sr-only">changed to</span> {change.to || "(empty)"}
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
