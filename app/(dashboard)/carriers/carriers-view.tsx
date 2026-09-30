"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EditIcon } from "@/components/edit-icon";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { CarrierRecord } from "@/lib/carriers";
import { rowNumbers } from "@/lib/row-numbers";
import { US_STATE_NAMES, stateSummary } from "@/lib/us-states";

/*
 * Carriers table. Add carrier goes to /carriers/new and a row's Edit to
 * /carriers/[id]/edit (./carrier-form.tsx), which come back here. Saves go to
 * the API through the saveCarrier server action; the API records a note of
 * what changed, read on the profile. The table sorts by header and filters
 * by search. A name links to the carrier's profile, which shows its aliases
 * and notes; rows don't expand. States are the carrier's availableStates:
 * one of the two ceilings on an agent appointment (Contracts), the other
 * being the agent's own licensedStates.
 *
 * The list is server-loaded; the save action revalidates it, so coming back
 * from the form page shows the change.
 */

type CarriersViewProps = {
  carriers: CarrierRecord[];
};

export function CarriersView({ carriers }: CarriersViewProps) {
  // The ID shown is the carrier's place in the name-sorted list, 1…n, not the
  // API's UUID (that only appears in the profile URL). It moves when a name
  // sorts elsewhere, so it is a row number, not a key.
  const numbers = useMemo(() => rowNumbers(carriers), [carriers]);

  // Sort and search run in DataTable. Search covers aliases, so a carrier can be
  // found by any name it appears under on statements.
  const columns = useMemo<DataTableColumn<CarrierRecord>[]>(
    () => [
      {
        id: "actions",
        header: "Action",
        cell: (carrier) => (
          <Link
            href={`/carriers/${carrier.id}/edit?from=list`}
            aria-label={`Edit ${carrier.name}`}
            className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
          >
            <EditIcon className="size-3.5 shrink-0" />
          </Link>
        ),
      },
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
    ],
    [numbers],
  );

  const addButton = (
    <Link href="/carriers/new" className={PRIMARY_BUTTON_CLASS}>
      Add carrier
    </Link>
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
    </>
  );
}
