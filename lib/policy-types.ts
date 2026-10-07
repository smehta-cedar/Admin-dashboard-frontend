import "server-only";

/*
 * Data boundary for policy types: reads the Django API (backend/apps/policies,
 * `/api/v1/policy-types/`) as the signed-in user. There is no Policy types
 * page: new types are added from the agency's contract dialog, through the
 * server action in app/(dashboard)/agency/policy-type-actions.ts, which posts
 * to the same API; the API records a change note on every add.
 *
 * A policy type is a catalog entry of its own (e.g. "Medicare Advantage"),
 * not a carrier's line of business (lib/lines-of-business.ts). Agent
 * certifications have nothing to do with it.
 */

import { apiGetAll } from "@/lib/api-server";

export type PolicyTypeStatus = "active" | "inactive";

export type PolicyTypeRecord = {
  /** The API's UUID. */
  id: string;
  /** Unique among policy types, ignoring case. */
  name: string;
  /** The API's is_active. Types added in the app are always active. */
  status: PolicyTypeStatus;
};

/** A policy type as the API serialises it (PolicyTypeSerializer). */
export type ApiPolicyType = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** An API policy type as the app holds it. */
export function toPolicyTypeRecord(policyType: ApiPolicyType): PolicyTypeRecord {
  return {
    id: policyType.id,
    name: policyType.name,
    status: policyType.is_active ? "active" : "inactive",
  };
}

/** Every policy type, active and inactive, sorted by name. */
export async function getPolicyTypes(): Promise<PolicyTypeRecord[]> {
  const policyTypes = await apiGetAll<ApiPolicyType>("/policy-types/");
  return policyTypes.map(toPolicyTypeRecord);
}
