"use server";

/*
 * Add or edit the agency, run on the Next server so the access token stays in
 * its HttpOnly cookie. createAgency POSTs /agencies/create/ once, when there is
 * no agency yet. Every edit is a PATCH /agencies/{id}/: saveAgency sends
 * the agency's own fields (the API checks the name and NPN against other
 * agencies); saveAgencyLicense and removeAgencyLicense send the full set of
 * licence rows with the one change, since the API takes `licenses` as the
 * whole set (a listed state keeps or gets its row, an unlisted one loses
 * it). The API records the change note either way.
 *
 * What the API answers, and what the form shows for it:
 *
 *   400 invalid             a field's message under that field
 *   401 token_not_valid     the session is gone            -> back to sign in
 *   403 permission_denied   the role can't change agencies -> under the form
 *   network_error           the API is down                -> under the form
 *
 * On success the dashboard is revalidated (Contracts reads the agency's
 * licence numbers).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  toAgencyLicenseRecords,
  toAgencyRecord,
  type AgencyRecord,
  type AgencyValues,
  type ApiAgency,
} from "@/lib/agency";
import type { AgencyStateLicenseRecord } from "@/lib/agency-state-licenses";
import { apiFetch } from "@/lib/api-server";
import type { ProducerError } from "@/components/producer-form";
import type { AgencyLicenseValues } from "./license-dialog";

type Saved = { ok: true; agency: AgencyRecord; licenses: AgencyStateLicenseRecord[] };

export type SaveAgencyResult = Saved | { ok: false; error: ProducerError };

export type SaveAgencyLicenseResult = Saved | { ok: false; message: string };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, ProducerError["field"]> = {
  name: "name",
  npn: "npn",
};

/**
 * The first message in a 400's errors, however deep: a licence row's error
 * comes back as a list with one object per row ({"licenses": [{}, {"end_date": [...]}]}).
 */
function firstMessage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstMessage(item);
      if (message) return message;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const message = firstMessage(item);
      if (message) return message;
    }
  }
  return null;
}

type Patched = Saved | { ok: false; apiField: string | null; message: string };

/** PATCHes the agency and reads the saved agency and its rows back. */
async function patchAgency(id: string, body: object): Promise<Patched> {
  return writeAgency(`/agencies/${encodeURIComponent(id)}/`, "PATCH", body);
}

/** Sends the agency to the API and reads the saved agency and its rows back. */
async function writeAgency(path: string, method: "POST" | "PATCH", body: object): Promise<Patched> {
  const result = await apiFetch<ApiAgency>(path, { method, body });

  if (!result.ok) {
    // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
    if (result.status === 401) redirect("/login");

    if (result.code === "invalid" && result.errors) {
      // The form shows one error at a time; the first field the API named wins.
      const [apiField, detail] = Object.entries(result.errors)[0] ?? ["", null];
      return { ok: false, apiField, message: firstMessage(detail) ?? result.message };
    }
    // Permission denied, not found, throttled, API down: about the attempt, not one field.
    return { ok: false, apiField: null, message: result.message };
  }

  revalidatePath("/", "layout");
  return { ok: true, agency: toAgencyRecord(result.data), licenses: toAgencyLicenseRecords(result.data) };
}

/** The agency's own fields as the API takes them. */
function toApiAgency(values: AgencyValues) {
  return {
    name: values.name,
    aliases: values.aliases,
    npn: values.npn,
    email: values.email,
    phone: values.phone,
    is_active: values.status === "active",
  };
}

function toSaveResult(result: Patched): SaveAgencyResult {
  if (result.ok) return result;
  return { ok: false, error: { field: ERROR_FIELDS[result.apiField ?? ""] ?? "form", message: result.message } };
}

/** Edits the agency's own fields. Resolves with the saved agency and its licence rows. */
export async function saveAgency(values: AgencyValues, id: string): Promise<SaveAgencyResult> {
  return toSaveResult(await patchAgency(id, toApiAgency(values)));
}

/**
 * Adds the agency when none exists yet (a new install). Licences and
 * contracts are added afterwards from the profile's panels.
 */
export async function createAgency(values: AgencyValues): Promise<SaveAgencyResult> {
  return toSaveResult(await writeAgency("/agencies/create/", "POST", toApiAgency(values)));
}

/** One licence as the API takes it. A blank date is sent as null, which keeps a row's date and defaults a new row's. */
function toApiLicense(row: AgencyLicenseValues) {
  return {
    state: row.state,
    license_number: row.licenseNumber,
    status: row.status,
    start_date: row.startDate || null,
    end_date: row.endDate || null,
  };
}

type LicenseInput = {
  agencyId: string;
  /** The rows as the profile holds them; the unchanged ones are sent back as they are. */
  licenses: AgencyStateLicenseRecord[];
};

/**
 * Adds a licence, or (with `previousState`) replaces the row that state had,
 * which is how a row's state is changed too.
 */
export async function saveAgencyLicense({
  agencyId,
  licenses,
  previousState,
  values,
}: LicenseInput & { previousState: string | null; values: AgencyLicenseValues }): Promise<SaveAgencyLicenseResult> {
  const kept = licenses.filter((row) => row.state !== previousState && row.state !== values.state);
  const result = await patchAgency(agencyId, { licenses: [...kept.map(toApiLicense), toApiLicense(values)] });
  return result.ok ? result : { ok: false, message: result.message };
}

/** Removes the licence row for `state`. */
export async function removeAgencyLicense({
  agencyId,
  licenses,
  state,
}: LicenseInput & { state: string }): Promise<SaveAgencyLicenseResult> {
  const kept = licenses.filter((row) => row.state !== state);
  const result = await patchAgency(agencyId, { licenses: kept.map(toApiLicense) });
  return result.ok ? result : { ok: false, message: result.message };
}
