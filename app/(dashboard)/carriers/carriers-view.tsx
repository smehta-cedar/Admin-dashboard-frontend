"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EditIcon } from "@/components/edit-icon";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { CarrierNote, CarrierRecord } from "@/lib/carriers";
import { US_STATE_NAMES, stateSummary } from "@/lib/us-states";
import {
  CarrierDialog,
  saveCarrier,
  type CarrierEditor,
  type CarrierError,
  type CarrierValues,
} from "./carrier-dialog";

/*
 * Carriers table with dummy add and edit, through the shared CarrierDialog
 * (./carrier-dialog.tsx), which a carrier's profile opens too. Every add or
 * edit records a note listing what changed. The table sorts by header and
 * filters by search. A name links to the carrier's profile, which shows its
 * aliases and notes; rows don't expand. States are the carrier's
 * availableStates: one of the two ceilings on an agent appointment
 * (Contracts), the other being the agent's own licensedStates. Carriers and
 * notes live in component state only: nothing reaches a server, and a refresh
 * brings back the JSON.
 */

type CarriersViewProps = {
  initialCarriers: CarrierRecord[];
  initialNotes: CarrierNote[];
};

export function CarriersView({ initialCarriers, initialNotes }: CarriersViewProps) {
  const [carriers, setCarriers] = useState(initialCarriers);
  // Not shown here (the profile lists notes); new ones are still recorded.
  const [notes, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<CarrierEditor | null>(null);

  // Sort and search run in DataTable. Search covers aliases, so a carrier can be
  // found by any name it appears under on statements.
  const columns = useMemo<DataTableColumn<CarrierRecord>[]>(
    () => [
      {
        id: "id",
        header: "ID",
        cell: (carrier) => carrier.id,
        className: "font-mono text-fg-muted",
        sortValue: (carrier) => Number(carrier.id),
        searchText: (carrier) => carrier.id,
      },
      {
        id: "name",
        header: "Name",
        cell: (carrier) => (
          <Link
            href={`/carriers/${carrier.id}`}
            className="-ml-1 whitespace-nowrap rounded-md px-1 py-0.5 text-fg hover:bg-surface-hover hover:underline"
          >
            {carrier.name}
          </Link>
        ),
        sortValue: (carrier) => carrier.name,
        searchText: (carrier) => [carrier.name, ...carrier.aliases],
      },
      {
        id: "linesOfBusiness",
        header: "Lines of business",
        cell: (carrier) => carrier.linesOfBusiness.join(", "),
        className: "whitespace-nowrap text-fg-muted",
        sortValue: (carrier) => carrier.linesOfBusiness.join(", "),
        searchText: (carrier) => carrier.linesOfBusiness,
      },
      {
        id: "availableStates",
        header: "States",
        cell: (carrier) => (
          <span className={carrier.availableStates.length === 0 ? "text-fg-faint" : undefined}>
            {stateSummary(carrier.availableStates)}
          </span>
        ),
        className: "min-w-40 tabular-nums text-fg-muted",
        sortValue: (carrier) => carrier.availableStates.length,
        searchText: (carrier) =>
          carrier.availableStates.flatMap((code) => [code, US_STATE_NAMES[code] ?? ""]),
      },
      {
        id: "status",
        header: "Status",
        cell: (carrier) => <StatusBadge status={carrier.status} />,
        sortValue: (carrier) => statusRank(carrier.status),
        searchText: (carrier) => carrier.status,
      },
      {
        id: "actions",
        header: "Actions",
        srOnlyHeader: true,
        cell: (carrier) => (
          <button
            type="button"
            onClick={() => setEditor({ mode: "edit", carrier })}
            className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
          >
            <EditIcon className="size-3.5 shrink-0" />
            Edit<span className="sr-only"> {carrier.name}</span>
          </button>
        ),
        className: "text-right",
      },
    ],
    [],
  );

  /** Adds or edits a carrier. Returns the dialog's errors, if any. */
  const handleSave = (values: CarrierValues): CarrierError[] => {
    const editing = editor?.mode === "edit" ? editor.carrier : undefined;
    const result = saveCarrier({ carriers, notes, values, editing });
    if (result.carrier === null) return result.errors;
    if (!result.changed) return [];

    setCarriers(result.carriers);
    setNotes(result.notes);
    setUnsavedCount((count) => count + 1);
    return [];
  };

  const addButton = (
    <button type="button" onClick={() => setEditor({ mode: "add" })} className={PRIMARY_BUTTON_CLASS}>
      Add carrier
    </button>
  );

  return (
    <>
      <PageHeader title="Carriers" actions={addButton} />

      <div role="status">
        {unsavedCount > 0 ? (
          <p className="mb-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink">
            {unsavedCount === 1 ? "1 change" : `${unsavedCount} changes`} made on this page only.
            Nothing is saved yet, so refreshing undoes {unsavedCount === 1 ? "it" : "them"}.
          </p>
        ) : null}
      </div>

      {carriers.length === 0 ? (
        <EmptyState
          title="No carriers yet"
          description="Add a carrier to see it listed here."
          action={addButton}
        />
      ) : (
        <DataTable
          rows={carriers}
          columns={columns}
          getRowId={(carrier) => carrier.id}
          unit={["carrier", "carriers"]}
          searchPlaceholder="Search name, alias, line, state…"
        />
      )}

      <CarrierDialog editor={editor} onSave={handleSave} onClose={() => setEditor(null)} />
    </>
  );
}
