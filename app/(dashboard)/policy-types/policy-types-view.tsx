"use client";

import { useMemo, useState } from "react";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EditIcon } from "@/components/edit-icon";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { PolicyTypeRecord } from "@/lib/policy-types";
import { rowNumbers } from "@/lib/row-numbers";
import { byName } from "@/lib/text";
import { savePolicyType } from "./actions";
import {
  PolicyTypeDialog,
  type PolicyTypeEditor,
  type PolicyTypeError,
  type PolicyTypeValues,
} from "./policy-type-dialog";

/*
 * Policy types table with add and edit through PolicyTypeDialog
 * (./policy-type-dialog.tsx). Saves go to the API through the savePolicyType
 * server action; the API records a note of what changed. The table sorts by
 * header and filters by search. There is no profile page: the catalog is
 * name and status.
 *
 * The list is server-loaded and kept in state so a save shows at once; the
 * action also revalidates the page, so the next render agrees.
 */

type PolicyTypesViewProps = {
  initialPolicyTypes: PolicyTypeRecord[];
};

export function PolicyTypesView({ initialPolicyTypes }: PolicyTypesViewProps) {
  const [policyTypes, setPolicyTypes] = useState(initialPolicyTypes);
  const [editor, setEditor] = useState<PolicyTypeEditor | null>(null);

  // The ID shown is the policy type's place in the name-sorted list, 1…n, not
  // the API's UUID. It moves when a name sorts elsewhere, so it is a row
  // number, not a key.
  const numbers = useMemo(() => rowNumbers(policyTypes), [policyTypes]);

  // Sort and search run in DataTable.
  const columns = useMemo<DataTableColumn<PolicyTypeRecord>[]>(
    () => [
      {
        id: "actions",
        header: "Action",
        cell: (policyType) => (
          <button
            type="button"
            onClick={() => setEditor({ mode: "edit", policyType })}
            className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
          >
            <EditIcon className="size-3.5 shrink-0" />
            <span className="sr-only"> {policyType.name}</span>
          </button>
        ),
      },
      {
        id: "number",
        header: "ID",
        cell: (policyType) => numbers.get(policyType.id),
        className: "font-mono text-fg-muted",
        sortValue: (policyType) => numbers.get(policyType.id) ?? 0,
        searchText: (policyType) => String(numbers.get(policyType.id) ?? ""),
      },
      {
        id: "name",
        header: "Name",
        cell: (policyType) => <span className="whitespace-nowrap text-fg">{policyType.name}</span>,
        sortValue: (policyType) => policyType.name,
        searchText: (policyType) => policyType.name,
      },
      {
        id: "status",
        header: "Status",
        cell: (policyType) => <StatusBadge status={policyType.status} />,
        sortValue: (policyType) => statusRank(policyType.status),
        searchText: (policyType) => policyType.status,
      },
    ],
    [numbers],
  );

  /** Adds or edits a policy type through the API. Resolves with the dialog's errors, if any. */
  const handleSave = async (values: PolicyTypeValues): Promise<PolicyTypeError[]> => {
    const editing = editor?.mode === "edit" ? editor.policyType : undefined;
    const result = await savePolicyType(values, editing?.id);
    if (!result.ok) return result.errors;

    const saved = result.policyType;
    setPolicyTypes((current) =>
      (editing
        ? current.map((policyType) => (policyType.id === saved.id ? saved : policyType))
        : [...current, saved]
      ).sort(byName),
    );
    return [];
  };

  const addButton = (
    <button type="button" onClick={() => setEditor({ mode: "add" })} className={PRIMARY_BUTTON_CLASS}>
      Add policy type
    </button>
  );

  return (
    <>
      <PageHeader title="Policy types" actions={addButton} />

      {policyTypes.length === 0 ? (
        <EmptyState
          title="No policy types yet"
          description="Add a policy type to see it listed here."
          action={addButton}
        />
      ) : (
        <DataTable
          rows={policyTypes}
          columns={columns}
          getRowId={(policyType) => policyType.id}
          unit={["policy type", "policy types"]}
        />
      )}

      <PolicyTypeDialog editor={editor} onSave={handleSave} onClose={() => setEditor(null)} />
    </>
  );
}
