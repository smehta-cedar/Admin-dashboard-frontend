"use client";

import { useSyncExternalStore } from "react";
import { NoteList } from "@/components/note-list";
import type { CarrierNote } from "@/lib/carriers";
import { CARRIER_FIELD_LABELS } from "../carrier-dialog";

const subscribe = () => () => {};

/**
 * The carrier's change notes. NoteList formats timestamps in the browser's
 * time zone, so the list renders only on the client (after hydration) to avoid
 * a server/client mismatch.
 */
export function CarrierNotes({ notes }: { notes: CarrierNote[] }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!hydrated) return <p className="text-sm text-fg-subtle">Loading notes…</p>;
  return <NoteList notes={notes} labels={CARRIER_FIELD_LABELS} />;
}
