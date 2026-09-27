"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EditIcon } from "@/components/edit-icon";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import { carrierNumbers, type CarrierRecord } from "@/lib/carrier-numbers";
import { byName } from "@/lib/text";
import { US_STATE_NAMES, stateSummary } from "@/lib/us-states";
import { saveCarrier } from "./actions";
import {
  CarrierDialog,
  type CarrierEditor,
  type CarrierError,
  type CarrierValues,
} from "./carrier-dialog";

/*
 * Carriers table with add and edit through the shared CarrierDialog
 * (./carrier-dialog.tsx), which a carrier's profile opens too. Saves go to
 * the API through the saveCarrier server action; the API records a note of
 * what changed, read on the profile. The table sorts by header and filters
 * by search. A name links to the carrier's profile, which shows its aliases
 * and notes; rows don't expand. States are the carrier's availableStates:
 * one of the two ceilings on an agent appointment (Contracts), the other
 * being the agent's own licensedStates.
 *
 * The list is server-loaded and kept in state so a save shows at once; the
 * action also revalidates the page, so the next render agrees.
 */

type CarriersViewProps = {
  initialCarriers: CarrierRecord[];
};

export function CarriersView({ initialCarriers }: CarriersViewProps) {
  const [carriers, setCarriers] = useState(initialCarriers);
  const [editor, setEditor] = useState<CarrierEditor | null>(null);

  // The ID shown is the carrier's place in the name-sorted list, 1…n, not the
  // API's UUID (that only appears in the profile URL). It moves when a name
  // sorts elsewhere, so it is a row number, not a key.
  const numbers = useMemo(() => carrierNumbers(carriers), [carriers]);

  // Sort and search run in DataTable. Search covers aliases, so a carrier can be
  // found by any name it appears under on statements.
  const columns = useMemo<DataTableColumn<CarrierRecord>[]>(
    () => [
      {
        id: "number",
        header: "ID",
        cell: (carrier) => numbers.get(carrier.id),
        className: "font-mono text-fg-muted",
        sortValue: (carrier) => numbers.get(carrier.id) ?? 0,
        searchText: (carrier) => String(numbers.get(carrier.id) ?? ""),
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
    [numbers],
  );

  /** Adds or edits a carrier through the API. Resolves with the dialog's errors, if any. */
  const handleSave = async (values: CarrierValues): Promise<CarrierError[]> => {
    const editing = editor?.mode === "edit" ? editor.carrier : undefined;
    const result = await saveCarrier(values, editing?.id);
    if (!result.ok) return result.errors;

    const saved = result.carrier;
    setCarriers((current) =>
      (editing
        ? current.map((carrier) => (carrier.id === saved.id ? saved : carrier))
        : [...current, saved]
      ).sort(byName),
    );
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
        />
      )}

      <CarrierDialog editor={editor} onSave={handleSave} onClose={() => setEditor(null)} />
    </>
  );
}
