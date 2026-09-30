import "server-only";

/*
 * Data boundary for agency contracts: reads the Django API
 * (backend/apps/contracts, `/api/v1/agency-contracts/`) as the signed-in
 * user. Adds and edits go through the server action in
 * app/(dashboard)/agency/contract-actions.ts, which posts to the same API;
 * the API records a change note on every add and every edit that changed
 * something (never the password).
 *
 * An agency contract ties the agency to one carrier: the contracting number,
 * the carrier's policies it covers (lib/carrier-policies.ts) and the
 * agency's login at that carrier. One live contract per carrier. It lives on
 * the agency profile: there is no page of its own. A carrier is open to
 * agents (appointments, portal passwords) only once its contract has a
 * number; the API reports that on the carrier as agentAccessible
 * (lib/carriers.ts). Commissions and assigning policies to agents are not
 * modelled here.
 */

import { apiGetAll } from "@/lib/api-server";

export type AgencyContractStatus = "active" | "inactive";

export type AgencyContractRecord = {
  /** The API's UUID. */
  id: string;
  agencyId: string;
  carrierId: string;
  carrierName: string;
  /** The contracting number. Blank until the carrier assigns one. */
  contractNumber: string;
  /** Covered policies, in name order. Empty means none. */
  policies: { id: string; name: string }[];
  /** The agency's login at the carrier: both blank or both set. */
  username: string;
  password: string;
  /** The API's is_active. Defaults to "active" when adding. */
  status: AgencyContractStatus;
};

/** What the add / edit form submits. The agency comes from the profile, not the form. */
export type AgencyContractValues = {
  carrierId: string;
  contractNumber: string;
  policyIds: string[];
  username: string;
  password: string;
  status: AgencyContractStatus;
};

/** Fields the form has, for an error to sit under; `form` is for errors about the attempt itself. */
export type AgencyContractErrorField =
  | "carrierId"
  | "contractNumber"
  | "policyIds"
  | "username"
  | "password"
  | "status"
  | "form";

/** A save error, shown under the field it names, or under the form for `form`. */
export type AgencyContractError = { field: AgencyContractErrorField; message: string };

/** A contract as the API serialises it (AgencyContractSerializer). */
export type ApiAgencyContract = {
  id: string;
  agency: { id: string; name: string; is_active: boolean };
  carrier: { id: string; name: string; is_active: boolean };
  contract_number: string;
  policies: { id: string; name: string; is_active: boolean }[];
  username: string;
  password: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** An API contract as the app holds it. */
export function toAgencyContractRecord(contract: ApiAgencyContract): AgencyContractRecord {
  return {
    id: contract.id,
    agencyId: contract.agency.id,
    carrierId: contract.carrier.id,
    carrierName: contract.carrier.name,
    contractNumber: contract.contract_number,
    policies: contract.policies.map(({ id, name }) => ({ id, name })),
    username: contract.username,
    password: contract.password,
    status: contract.is_active ? "active" : "inactive",
  };
}

/**
 * Every carrier with a live agency contract (any status, with or without a
 * number), sorted by name: the carriers a policy type can require
 * certification for.
 */
export async function getContractedCarriers(): Promise<{ id: string; name: string }[]> {
  const contracts = await apiGetAll<ApiAgencyContract>("/agency-contracts/");
  return contracts
    .map(({ carrier }) => ({ id: carrier.id, name: carrier.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One agency's contracts, active and inactive, sorted by carrier name. */
export async function getAgencyContracts(agencyId: string): Promise<AgencyContractRecord[]> {
  const contracts = await apiGetAll<ApiAgencyContract>("/agency-contracts/", { agency: agencyId });
  return contracts.map(toAgencyContractRecord);
}
