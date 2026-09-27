import "server-only";

/*
 * Data boundary for carrier policies: reads the Django API
 * (backend/apps/policies, `/api/v1/carrier-policies/`) as the signed-in user.
 * Adds and edits go through the server action in
 * app/(dashboard)/carriers/policy-actions.ts, which posts to the same API;
 * the API records a change note on every add and every edit that changed
 * something.
 *
 * A carrier policy is one named policy a carrier offers (e.g. Humana's
 * "Gold Plus HMO"), pointing at one policy type from the catalog
 * (lib/policy-types.ts). It lives on the carrier: there is no Policies page,
 * the carrier profile shows and edits them. availableStates is where the
 * policy can be sold, always within the carrier's own availableStates
 * (lib/carriers.ts); empty means nowhere, never "every state". Agency
 * contracts, commissions, agent certifications and counties are not
 * modelled here.
 */

import { apiGet, apiGetAll } from "@/lib/api-server";
import type { FieldChange } from "@/lib/change-notes";

export type CarrierPolicyStatus = "active" | "inactive";

export type CarrierPolicyRecord = {
  /** The API's UUID. */
  id: string;
  /** The carrier that offers it. Set on add and never changes. */
  carrierId: string;
  carrierName: string;
  /** The policy type from the catalog. */
  policyTypeId: string;
  policyTypeName: string;
  /** Unique among the carrier's policies, ignoring case. */
  name: string;
  /** State codes the policy can be sold in, within the carrier's footprint, in code order. */
  availableStates: string[];
  /** The API's is_active. Defaults to "active" when adding. */
  status: CarrierPolicyStatus;
};

/** What the add / edit form submits. The carrier comes from the profile, not the form. */
export type CarrierPolicyValues = {
  name: string;
  policyTypeId: string;
  availableStates: string[];
  status: CarrierPolicyStatus;
};

/** Fields the form has, for an error to sit under; `form` is for errors about the attempt itself. */
export type CarrierPolicyErrorField = "name" | "policyType" | "availableStates" | "status" | "form";

/** A save error, shown under the field it names, or under the form for `form`. */
export type CarrierPolicyError = { field: CarrierPolicyErrorField; message: string };

/** Policy fields a note can record, in the order a note lists them. */
export type CarrierPolicyField = "name" | "policyType" | "carrier" | "availableStates" | "status";

export type CarrierPolicyChange = FieldChange<CarrierPolicyField>;

/**
 * Change-log entry the API writes whenever a policy is added or edited.
 * Append-only: notes are never edited or deleted.
 */
export type CarrierPolicyNote = {
  id: string;
  policyId: CarrierPolicyRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Full name of who made the change, or null when unknown. */
  createdBy: string | null;
  /** Only the fields that changed: the type and carrier by name, states as comma-separated codes. */
  changes: CarrierPolicyChange[];
};

/** A policy as the API serialises it (CarrierPolicySerializer). */
export type ApiCarrierPolicy = {
  id: string;
  carrier: { id: string; name: string; is_active: boolean };
  policy_type: { id: string; name: string; is_active: boolean };
  name: string;
  available_states: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** A note as the API serialises it (CarrierPolicyNoteSerializer). */
type ApiCarrierPolicyNote = {
  id: string;
  policy_id: string;
  kind: "added" | "edited";
  changes: { field: string; from: string; to: string }[];
  created_by: string | null;
  created_at: string;
};

/** API field name -> CarrierPolicyField, for a note's changes. */
const NOTE_FIELDS: Record<string, CarrierPolicyField> = {
  name: "name",
  policy_type: "policyType",
  carrier: "carrier",
  available_states: "availableStates",
  status: "status",
};

/** An API policy as the app holds it. */
export function toCarrierPolicyRecord(policy: ApiCarrierPolicy): CarrierPolicyRecord {
  return {
    id: policy.id,
    carrierId: policy.carrier.id,
    carrierName: policy.carrier.name,
    policyTypeId: policy.policy_type.id,
    policyTypeName: policy.policy_type.name,
    name: policy.name,
    availableStates: [...new Set(policy.available_states)].sort(),
    status: policy.is_active ? "active" : "inactive",
  };
}

function toCarrierPolicyNote(note: ApiCarrierPolicyNote): CarrierPolicyNote {
  return {
    id: note.id,
    policyId: note.policy_id,
    kind: note.kind,
    createdAt: note.created_at,
    createdBy: note.created_by,
    changes: note.changes.flatMap((change) => {
      const field = NOTE_FIELDS[change.field];
      return field ? [{ field, from: change.from, to: change.to }] : [];
    }),
  };
}

/** One carrier's policies, active and inactive, sorted by name. */
export async function getCarrierPolicies(carrierId: string): Promise<CarrierPolicyRecord[]> {
  const policies = await apiGetAll<ApiCarrierPolicy>("/carrier-policies/", { carrier: carrierId });
  return policies.map(toCarrierPolicyRecord);
}

/** One policy's change notes, newest first. */
export async function getCarrierPolicyNotes(policyId: string): Promise<CarrierPolicyNote[]> {
  const notes = await apiGet<ApiCarrierPolicyNote[]>(`/carrier-policies/${encodeURIComponent(policyId)}/notes/`);
  return notes.map(toCarrierPolicyNote);
}
