"use client";

import { useSyncExternalStore } from "react";
import { NoteList, type NoteListProps } from "@/components/note-list";

const subscribe = () => () => {};

/**
 * NoteList for a place that renders on the server too (a profile's Notes
 * panel). NoteList formats timestamps in the browser's time zone, so the list
 * renders only on the client (after hydration) to avoid a server/client
 * mismatch; until then a "Loading notes…" line holds the spot. An expanded
 * table row never renders on the server, so it uses NoteList directly.
 */
export function HydratedNoteList<F extends string>(props: NoteListProps<F>) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!hydrated) return <p className="text-sm text-fg-subtle">Loading notes…</p>;
  return <NoteList {...props} />;
}
