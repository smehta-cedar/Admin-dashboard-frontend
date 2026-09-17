"use client";

import { useSyncExternalStore } from "react";
import { NoteList } from "@/components/note-list";
import type { AgentNote } from "@/lib/agents";
import { FIELD_LABELS } from "../agents-view";

const subscribe = () => () => {};

/**
 * The agent's change notes. NoteList formats timestamps in the browser's time
 * zone, so the list renders only on the client (after hydration) to avoid a
 * server/client mismatch.
 */
export function AgentNotes({ notes }: { notes: AgentNote[] }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!hydrated) return <p className="text-sm text-gray-500">Loading notes…</p>;
  return <NoteList notes={notes} labels={FIELD_LABELS} />;
}
