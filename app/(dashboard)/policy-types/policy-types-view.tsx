"use client";

import { useMemo, useState } from "react";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EditIcon } from "@/components/edit-icon";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PROFILE_BUTTON_CLASS } from "@/components/profile-shell";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { CertificationRecord } from "@/lib/certifications";
import type { PolicyTypeRecord } from "@/lib/policy-types";
import { rowNumbers } from "@/lib/row-numbers";
import { byName } from "@/lib/text";
import { saveCertification } from "../certifications/actions";
import {
  CertificationDialog,
  type CertificationEditor,
  type CertificationError,
  type CertificationOption,
  type CertificationValues,
} from "../certifications/certification-dialog";
import { CertificationsTable } from "../certifications/certifications-table";
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
 * name, certification required and status.
 *
 * Clicking a name expands the row to show who holds that type — one
 * certification per agent (agent, start, end, status) with an Edit on each
 * row and an Add button — through the shared CertificationDialog
 * (../certifications/certification-dialog.tsx) with the policy type fixed.
 * The agent profile adds the same rows from the other side. When the role
 * can't see certifications (`initialCertifications` is null) names don't
 * expand and nothing else changes.
 *
 * Both lists are server-loaded and kept in state so a save shows at once;
 * the actions also revalidate the page, so the next render agrees.
 */

type PolicyTypesViewProps = {
  initialPolicyTypes: PolicyTypeRecord[];
  /** Every certification, or null when the role can't see them. */
  initialCertifications: CertificationRecord[] | null;
  /** Every agent, for the certification dialog's select. */
  agents: CertificationOption[];
};

/** Which policy type's certification dialog is open, and for which row. */
type HolderEditor = { policyType: PolicyTypeRecord; editor: CertificationEditor };

const byAgentName = (a: CertificationRecord, b: CertificationRecord) => a.agentName.localeCompare(b.agentName);

export function PolicyTypesView({ initialPolicyTypes, initialCertifications, agents }: PolicyTypesViewProps) {
  const [policyTypes, setPolicyTypes] = useState(initialPolicyTypes);
  const [editor, setEditor] = useState<PolicyTypeEditor | null>(null);
  const [certifications, setCertifications] = useState(initialCertifications);
  const [holderEditor, setHolderEditor] = useState<HolderEditor | null>(null);

  const canSeeCertifications = certifications !== null;

  // The ID shown is the policy type's place in the name-sorted list, 1…n, not
  // the API's UUID. It moves when a name sorts elsewhere, so it is a row
  // number, not a key.
  const numbers = useMemo(() => rowNumbers(policyTypes), [policyTypes]);

  // Holders by policy type, each list by agent name.
  const holdersByType = useMemo(() => {
    const map = new Map<string, CertificationRecord[]>();
    for (const certification of certifications ?? []) {
      const list = map.get(certification.policyTypeId) ?? [];
      list.push(certification);
      map.set(certification.policyTypeId, list);
    }
    for (const list of map.values()) list.sort(byAgentName);
    return map;
  }, [certifications]);

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
        cell: (policyType, { expanded, toggleExpanded, detailsId }) =>
          canSeeCertifications ? (
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              aria-controls={expanded ? detailsId : undefined}
              className="-ml-1 flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-0.5 text-fg hover:bg-surface-hover"
            >
              {policyType.name}
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
          ) : (
            <span className="whitespace-nowrap text-fg">{policyType.name}</span>
          ),
        sortValue: (policyType) => policyType.name,
        searchText: (policyType) => policyType.name,
      },
      {
        id: "certificationRequired",
        header: "Certification required",
        cell: (policyType) => (
          <span className={policyType.certificationRequired ? undefined : "text-fg-faint"}>
            {policyType.certificationRequired ? "Yes" : "No"}
          </span>
        ),
        className: "whitespace-nowrap text-fg-muted",
        // Required first when sorted ascending.
        sortValue: (policyType) => (policyType.certificationRequired ? 0 : 1),
        searchText: (policyType) => (policyType.certificationRequired ? "yes" : "no"),
      },
      {
        id: "status",
        header: "Status",
        cell: (policyType) => <StatusBadge status={policyType.status} />,
        sortValue: (policyType) => statusRank(policyType.status),
        searchText: (policyType) => policyType.status,
      },
    ],
    [numbers, canSeeCertifications],
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

  /** Adds or edits a certification for the open row's policy type. Resolves with the dialog's errors, if any. */
  const handleSaveHolder = async (values: CertificationValues): Promise<CertificationError[]> => {
    const editingId = holderEditor?.editor.mode === "edit" ? holderEditor.editor.certification.id : undefined;
    const result = await saveCertification(values, "policyType", editingId);
    if (!result.ok) return result.errors;
    setCertifications((current) => [
      ...(current ?? []).filter((row) => row.id !== result.certification.id),
      result.certification,
    ]);
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
          renderDetails={
            canSeeCertifications
              ? (policyType) => {
                  const holders = holdersByType.get(policyType.id) ?? [];
                  return (
                    <section aria-label={`Agents certified for ${policyType.name}`}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                          Certified agents
                          <span className="ml-2 font-normal tabular-nums">{holders.length}</span>
                        </h3>
                        <button
                          type="button"
                          onClick={() => setHolderEditor({ policyType, editor: { mode: "add" } })}
                          className={PROFILE_BUTTON_CLASS}
                        >
                          <span aria-hidden="true">+ </span>Add certification
                          <span className="sr-only"> for {policyType.name}</span>
                        </button>
                      </div>
                      <div className="mt-3">
                        {holders.length === 0 ? (
                          <p className="text-sm text-fg-subtle">No certifications recorded.</p>
                        ) : (
                          <CertificationsTable
                            certifications={holders}
                            leading="agent"
                            onEdit={(certification) =>
                              setHolderEditor({ policyType, editor: { mode: "edit", certification } })
                            }
                          />
                        )}
                      </div>
                    </section>
                  );
                }
              : undefined
          }
        />
      )}

      <PolicyTypeDialog editor={editor} onSave={handleSave} onClose={() => setEditor(null)} />

      {/* Policy type fixed to the open row; the form picks the agent. */}
      <CertificationDialog
        editor={holderEditor?.editor ?? null}
        fixed={{
          kind: "policyType",
          policyType: holderEditor
            ? { id: holderEditor.policyType.id, name: holderEditor.policyType.name }
            : { id: "", name: "" },
        }}
        options={agents}
        onSave={handleSaveHolder}
        onClose={() => setHolderEditor(null)}
      />
    </>
  );
}
