"use client";

import Link from "next/link";
import { useId, useMemo, useState, type FormEvent } from "react";
import {
  GHOST_BUTTON_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  ROW_BUTTON_CLASS,
} from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { NoteList } from "@/components/note-list";
import { PageHeader } from "@/components/page-header";
import { StateCheckboxes } from "@/components/state-checkboxes";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { CarrierField, CarrierNote, CarrierRecord } from "@/lib/carriers";
import { diffValues, nextId } from "@/lib/change-notes";
import { LINES_OF_BUSINESS } from "@/lib/lines-of-business";
import { US_STATE_NAMES, stateSummary } from "@/lib/us-states";

/*
 * Carriers table with dummy add and edit dialogs. Every add or edit records a
 * note listing what changed. The table sorts by header and filters by search.
 * A name links to the carrier's profile; the chevron beside it expands the row
 * to show its aliases and notes. States are the carrier's availableStates: the
 * ceiling for agent appointments on Contracts. Carriers
 * and notes live in component state only: nothing reaches a server, and a
 * refresh brings back the JSON.
 */

type CarriersViewProps = {
  initialCarriers: CarrierRecord[];
  initialNotes: CarrierNote[];
};

/** Which dialog is open. Edit holds the carrier as it was when the dialog opened. */
type Editor = { mode: "add" } | { mode: "edit"; carrier: CarrierRecord };

type CarrierValues = Omit<CarrierRecord, "id">;

/** Also the order changes are compared and listed in. */
export const FIELD_LABELS: Record<CarrierField, string> = {
  name: "Name",
  aliases: "Aliases",
  linesOfBusiness: "Lines of business",
  status: "Status",
  availableStates: "Available states",
};

const FIELDS = Object.keys(FIELD_LABELS) as CarrierField[];

const EMPTY_VALUES = { name: "", aliases: [], linesOfBusiness: [], availableStates: [] };

export function CarriersView({ initialCarriers, initialNotes }: CarriersViewProps) {
  const [carriers, setCarriers] = useState(initialCarriers);
  const [notes, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [linesError, setLinesError] = useState<string | null>(null);
  const { dialogRef, close: closeDialog } = useModalDialog(editor !== null);
  const id = useId();

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
        cell: (carrier, { expanded, toggleExpanded, detailsId }) => (
          <div className="-ml-1 flex items-center gap-0.5 whitespace-nowrap">
            <Link
              href={`/carriers/${carrier.id}`}
              className="rounded-md px-1 py-0.5 text-fg hover:bg-surface-hover hover:underline"
            >
              {carrier.name}
            </Link>
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              aria-controls={expanded ? detailsId : undefined}
              aria-label={`Details for ${carrier.name}`}
              className="rounded-md p-0.5 hover:bg-surface-hover"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className={`size-4 shrink-0 text-fg-subtle transition-transform ${expanded ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 5l5 5-5 5" />
              </svg>
            </button>
          </div>
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
            className={ROW_BUTTON_CLASS}
          >
            Edit<span className="sr-only"> {carrier.name}</span>
          </button>
        ),
        className: "text-right",
      },
    ],
    [],
  );

  // Runs for every close: Cancel, Escape, backdrop click, or a save. Clearing
  // the editor unmounts the form, which resets it.
  const handleClose = () => {
    setEditor(null);
    setNameError(null);
    setLinesError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;

    const data = new FormData(event.currentTarget);
    const text = (field: CarrierField) => String(data.get(field) ?? "").trim();
    const checkedLines = data.getAll("linesOfBusiness");
    const values: CarrierValues = {
      name: text("name"),
      aliases: text("aliases")
        .split(",")
        .map((alias) => alias.trim())
        .filter(Boolean),
      linesOfBusiness: LINES_OF_BUSINESS.filter((line) => checkedLines.includes(line)),
      status: text("status") === "inactive" ? "inactive" : "active",
      availableStates: [
        ...new Set(data.getAll("availableStates").map((code) => String(code).trim()).filter(Boolean)),
      ].sort(),
    };

    // A name can't repeat another carrier's name or alias (ignoring case).
    const editingId = editor.mode === "edit" ? editor.carrier.id : null;
    const nameKey = values.name.toLowerCase();
    const nameOwner = carriers.find(
      (carrier) =>
        carrier.id !== editingId &&
        [carrier.name, ...carrier.aliases].some((name) => name.toLowerCase() === nameKey),
    );
    const nameMessage = !nameOwner
      ? null
      : nameOwner.name.toLowerCase() === nameKey
        ? `${nameOwner.name} is already carrier ${nameOwner.id}.`
        : `${values.name} is already an alias of ${nameOwner.name}.`;
    const linesMessage =
      values.linesOfBusiness.length === 0 ? "Choose at least one line of business." : null;
    setNameError(nameMessage);
    setLinesError(linesMessage);
    if (nameMessage || linesMessage) return;

    const carrierId = editingId ?? nextId(carriers);
    const changes = diffValues(
      FIELDS,
      editor.mode === "edit" ? editor.carrier : EMPTY_VALUES,
      values,
    );

    // Saving an edit with nothing changed just closes, without a note.
    if (changes.length > 0) {
      setCarriers((current) =>
        editor.mode === "edit"
          ? current.map((carrier) =>
              carrier.id === carrierId ? { id: carrierId, ...values } : carrier,
            )
          : [...current, { id: carrierId, ...values }],
      );
      setNotes((current) => [
        {
          id: nextId(current),
          carrierId,
          kind: editor.mode === "edit" ? "edited" : "added",
          createdAt: new Date().toISOString(),
          changes,
        },
        ...current,
      ]);
      setUnsavedCount((count) => count + 1);
    }
    closeDialog();
  };

  const addButton = (
    <button type="button" onClick={() => setEditor({ mode: "add" })} className={PRIMARY_BUTTON_CLASS}>
      Add carrier
    </button>
  );

  const editing = editor?.mode === "edit" ? editor.carrier : undefined;

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
          renderDetails={(carrier) => (
            <div className="grid gap-6 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                  Aliases
                </h3>
                {carrier.aliases.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-fg">
                    {carrier.aliases.map((alias, index) => (
                      <li key={`${index}-${alias}`}>{alias}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-fg-subtle">None</p>
                )}
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                  Notes
                </h3>
                <NoteList
                  notes={notes.filter((note) => note.carrierId === carrier.id)}
                  labels={FIELD_LABELS}
                />
              </section>
            </div>
          )}
        />
      )}

      <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={handleClose}>
        {editor ? (
          <form onSubmit={handleSubmit} className="px-6 py-4">
            <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
              {editing ? `Edit ${editing.name}` : "Add carrier"}
            </h2>

            {/* Name and aliases full width; status (left) and lines of business (right) share a row; states below. */}
            <div className="mt-5 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
              <Field
                label="Name"
                htmlFor={`${id}-name`}
                hint={nameError ?? undefined}
                hintId={`${id}-name-error`}
                error
                className="sm:col-span-2"
              >
                <input
                  id={`${id}-name`}
                  name="name"
                  type="text"
                  required
                  pattern=".*\S.*"
                  autoComplete="off"
                  defaultValue={editing?.name}
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? `${id}-name-error` : undefined}
                  onChange={() => setNameError(null)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field
                label="Aliases"
                optional
                htmlFor={`${id}-aliases`}
                hint="Separate with commas."
                hintId={`${id}-aliases-hint`}
                className="sm:col-span-2 mt-2"
              >
                <input
                  id={`${id}-aliases`}
                  name="aliases"
                  type="text"
                  autoComplete="off"
                  aria-describedby={`${id}-aliases-hint`}
                  defaultValue={editing?.aliases.join(", ")}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Status" htmlFor={`${id}-status`} className="sm:w-40 mt-4 [&>label]:font-semibold">
                <select
                  id={`${id}-status`}
                  name="status"
                  defaultValue={editing?.status ?? "active"}
                  className={INPUT_CLASS} 
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
              <fieldset className="mt-4 min-w-0">
                <legend className="block text-sm font-semibold text-fg">Lines of business</legend>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                  {LINES_OF_BUSINESS.map((line) => (
                    <label key={line} className="flex items-center gap-2 text-sm text-fg">
                      <input
                        type="checkbox"
                        name="linesOfBusiness"
                        value={line}
                        defaultChecked={editing?.linesOfBusiness.includes(line)}
                        aria-invalid={linesError ? true : undefined}
                        aria-describedby={linesError ? `${id}-lines-error` : undefined}
                        onChange={() => setLinesError(null)}
                        className="size-4 accent-brand-strong"
                      />
                      {line}
                    </label>
                  ))}
                </div>
                {linesError ? (
                  <p id={`${id}-lines-error`} className="mt-1 text-xs text-danger">
                    {linesError}
                  </p>
                ) : null}
              </fieldset>
              
              <StateCheckboxes
                legend="Available states"
                name="availableStates"
                defaultChecked={editing?.availableStates}
                className="sm:col-span-2 mt-4"
                legendClassName="font-semibold"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeDialog} className={GHOST_BUTTON_CLASS}>
                Cancel
              </button>
              <button type="submit" className={PRIMARY_BUTTON_CLASS}>
                {editing ? "Save changes" : "Add carrier"}
              </button>
            </div>
          </form>
        ) : null}
      </ModalDialog>
    </>
  );
}
