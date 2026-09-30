import "server-only";

/*
 * Data boundary for policy types: reads the Django API (backend/apps/policies,
 * `/api/v1/policy-types/`) as the signed-in user. Adds and edits go through
 * the server action in app/(dashboard)/policy-types/actions.ts, which posts
 * to the same API; the API records a change note on every add and every
 * edit that changed something.
 *
 * A policy type is a catalog entry of its own (e.g. "Medicare Advantage"),
 * not a carrier's line of business (lib/lines-of-business.ts). Its
 * certification scope says how agents get certified on it (lib/certifications.ts):
 * not at all, once for the type, or per carrier, against the carriers in
 * certificationCarriers (each with an agency contract when saved). Nothing
 * blocks a sale on it; it is recorded for the catalog only.
 */

import { apiFetch, apiGet, apiGetAll, ApiError } from "@/lib/api-server";
import type { FieldChange } from "@/lib/change-notes";

export type PolicyTypeStatus = "active" | "inactive";

/** none: no certification; single: one certification covers the type; per_carrier: certified per carrier. */
export type CertificationScope = "none" | "single" | "per_carrier";

/** A carrier as a policy type or certification names it. */
export type CarrierRef = { id: string; name: string };

export type PolicyTypeRecord = {
  /** The API's UUID. */
  id: string;
  /** Unique among policy types, ignoring case. */
  name: string;
  /** How an agent is certified on this type. */
  certificationScope: CertificationScope;
  /** Carriers that need the certification, in name order. Empty unless the scope is per_carrier. */
  certificationCarriers: CarrierRef[];
  /** The API's is_active. Defaults to "active" when adding. */
  status: PolicyTypeStatus;
};

/** Policy type fields a note can record. The ID never changes. */
export type PolicyTypeField = Exclude<keyof PolicyTypeRecord, "id">;

/** What the add / edit form submits: every field but the ID, the carriers by ID. */
export type PolicyTypeValues = Omit<PolicyTypeRecord, "id" | "certificationCarriers"> & {
  /** Sent only for per_carrier; any other scope clears them. */
  certificationCarrierIds: string[];
};

/** A save error, shown under the field it names, or under the form for `form`. */
export type PolicyTypeError = { field: PolicyTypeField | "form"; message: string };

export type PolicyTypeChange = FieldChange<PolicyTypeField>;

/**
 * Change-log entry the API writes whenever a policy type is added or edited.
 * Append-only: notes are never edited or deleted.
 */
export type PolicyTypeNote = {
  id: string;
  policyTypeId: PolicyTypeRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Full name of who made the change, or null when unknown. */
  createdBy: string | null;
  /** Only the fields that changed, in form order. The scope reads "none" / "single" / "per carrier", carriers by name. */
  changes: PolicyTypeChange[];
};

/** A policy type as the API serialises it (PolicyTypeSerializer). */
export type ApiPolicyType = {
  id: string;
  name: string;
  certification_scope: CertificationScope;
  certification_carriers: { id: string; name: string; is_active: boolean }[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** A note as the API serialises it (PolicyTypeNoteSerializer). */
type ApiPolicyTypeNote = {
  id: string;
  policy_type_id: string;
  kind: "added" | "edited";
  changes: { field: string; from: string; to: string }[];
  created_by: string | null;
  created_at: string;
};

/** API field name -> PolicyTypeRecord field, for a note's changes. */
const NOTE_FIELDS: Record<string, PolicyTypeField> = {
  name: "name",
  certification_scope: "certificationScope",
  certification_carriers: "certificationCarriers",
  status: "status",
};

/** An API policy type as the app holds it. */
export function toPolicyTypeRecord(policyType: ApiPolicyType): PolicyTypeRecord {
  return {
    id: policyType.id,
    name: policyType.name,
    certificationScope: policyType.certification_scope,
    certificationCarriers: policyType.certification_carriers.map(({ id, name }) => ({ id, name })),
    status: policyType.is_active ? "active" : "inactive",
  };
}

function toPolicyTypeNote(note: ApiPolicyTypeNote): PolicyTypeNote {
  return {
    id: note.id,
    policyTypeId: note.policy_type_id,
    kind: note.kind,
    createdAt: note.created_at,
    createdBy: note.created_by,
    changes: note.changes.flatMap((change) => {
      const field = NOTE_FIELDS[change.field];
      return field ? [{ field, from: change.from, to: change.to }] : [];
    }),
  };
}

/** Every policy type, active and inactive, sorted by name. */
export async function getPolicyTypes(): Promise<PolicyTypeRecord[]> {
  const policyTypes = await apiGetAll<ApiPolicyType>("/policy-types/");
  return policyTypes.map(toPolicyTypeRecord);
}

/** One policy type by ID, or null when there is none (or the ID isn't one). */
export async function getPolicyType(id: string): Promise<PolicyTypeRecord | null> {
  const result = await apiFetch<ApiPolicyType>(`/policy-types/${encodeURIComponent(id)}/`);
  if (!result.ok) {
    if (result.status === 404) return null;
    throw new ApiError(`/policy-types/${id}/`, result);
  }
  return toPolicyTypeRecord(result.data);
}

/** One policy type's change notes, newest first. */
export async function getPolicyTypeNotes(policyTypeId: string): Promise<PolicyTypeNote[]> {
  const notes = await apiGet<ApiPolicyTypeNote[]>(`/policy-types/${encodeURIComponent(policyTypeId)}/notes/`);
  return notes.map(toPolicyTypeNote);
}
