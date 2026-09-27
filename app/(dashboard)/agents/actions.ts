"use server";

/*
 * Add or edit an agent, run on the Next server so the access token stays in
 * its HttpOnly cookie. POST /agents/create/ or PATCH /agents/{id}/; the API
 * checks the NPN against every other agent, needs an address to be all four
 * parts or none, replaces the licence rows from the licences listed on the
 * form (state, number, dates and lines), and records the change note.
 *
 * What the API answers, and what the form shows for it:
 *
 *   400 invalid             a field's message under that field (npn, name,
 *                           address, licence numbers) or under the form
 *   401 token_not_valid     the session is gone            -> back to sign in
 *   403 permission_denied   the role can't change agents   -> under the form
 *   network_error           the API is down                -> under the form
 *
 * On success the dashboard is revalidated: every page reads agents (navbar
 * search, request dialog, contracts), so they all show the change next render.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AgentStateLicenseRecord } from "@/lib/agent-state-licenses";
import {
  toAgentRecord,
  toLicenseRecords,
  type AgentRecord,
  type AgentValues,
  type ApiAgent,
} from "@/lib/agents";
import { apiFetch } from "@/lib/api-server";
import type { ProducerError } from "@/components/producer-form";

export type SaveAgentResult =
  | { ok: true; agent: AgentRecord; licenses: AgentStateLicenseRecord[] }
  | { ok: false; error: ProducerError };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, ProducerError["field"]> = {
  name: "name",
  npn: "npn",
  address: "address",
  licenses: "licenseNumbers",
};

/** Adds an agent, or edits the one with `editingId`. Resolves with the saved agent and their licence rows. */
export async function saveAgent(values: AgentValues, editingId?: string): Promise<SaveAgentResult> {
  const body = {
    name: values.name,
    aliases: values.aliases,
    npn: values.npn,
    email: values.email,
    phone: values.phone,
    personal_email: values.personalEmail ?? "",
    personal_phone: values.personalPhone ?? "",
    address: values.address ?? null,
    is_active: values.status === "active",
    licenses: values.licensedStates.map((state) => ({
      state,
      license_number: values.licenseNumbers[state] ?? "",
      life: values.licenseLines[state]?.life ?? false,
      health: values.licenseLines[state]?.health ?? false,
      // A blank date is left to the API: today / two years on for a new row, unchanged for a kept one.
      start_date: values.licenseDates[state]?.startDate || null,
      end_date: values.licenseDates[state]?.endDate || null,
    })),
  };
  const result = editingId
    ? await apiFetch<ApiAgent>(`/agents/${encodeURIComponent(editingId)}/`, { method: "PATCH", body })
    : await apiFetch<ApiAgent>("/agents/create/", { method: "POST", body });

  if (!result.ok) {
    // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
    if (result.status === 401) redirect("/login");

    if (result.code === "invalid" && result.errors) {
      // The form shows one error at a time; the first field the API named wins.
      const [apiField, messages] = Object.entries(result.errors)[0] ?? ["", [result.message]];
      return { ok: false, error: { field: ERROR_FIELDS[apiField] ?? "form", message: messages[0] } };
    }
    // Permission denied, not found, throttled, API down: about the attempt, not one field.
    return { ok: false, error: { field: "form", message: result.message } };
  }

  // Every dashboard page reads agents (the navbar search and request dialog), so revalidate the lot.
  revalidatePath("/", "layout");
  return { ok: true, agent: toAgentRecord(result.data), licenses: toLicenseRecords(result.data) };
}
