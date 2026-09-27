import "server-only";

/*
 * Data boundary for certifications: reads the Django API
 * (backend/apps/policies, `/api/v1/certifications/`) as the signed-in user.
 * Adds and edits go through the server action in
 * app/(dashboard)/certifications/actions.ts, which posts to the same API;
 * the API records a change note on every add and every edit that changed
 * something.
 *
 * One row is one agent certified for one policy type (lib/policy-types.ts).
 * The same rows are added from the agent profile (agent fixed, type chosen)
 * and from the policy types table (type fixed, agent chosen); there is no
 * Certifications page. Dates are optional. A row may carry one PDF, kept
 * privately by the API and downloaded through the route handler at
 * /certifications/{id}/file (app/(dashboard)/certifications/[id]/file);
 * is_verified is set by hand. Carrier-policy certificates,
 * agency contracts, commissions and any rule that blocks a sale are not
 * modelled here.
 *
 * Reads throw on failure like every data module; a page that shows
 * certifications beside another entity wraps the call in allowForbidden
 * (lib/api-server.ts) so a role without certifications view just loses the
 * section.
 */

import { apiGet, apiGetAll } from "@/lib/api-server";
import type { FieldChange } from "@/lib/change-notes";

export type CertificationStatus = "active" | "inactive";

export type CertificationRecord = {
  /** The API's UUID. */
  id: string;
  agentId: string;
  agentName: string;
  agentStatus: "active" | "inactive";
  policyTypeId: string;
  policyTypeName: string;
  policyTypeStatus: "active" | "inactive";
  /** "YYYY-MM-DD", or "" when unset. */
  startDate: string;
  /** "YYYY-MM-DD", or "" when unset. On or after startDate when both are set. */
  endDate: string;
  /** Set by hand; uploading a PDF does not set it. */
  isVerified: boolean;
  /** The uploaded PDF's name, or null when there is none. */
  fileName: string | null;
  /** The API's is_active. Defaults to "active" when adding. */
  status: CertificationStatus;
};

/** What the add / edit form submits. One of agentId / policyTypeId is fixed by the page. */
export type CertificationValues = {
  agentId: string;
  policyTypeId: string;
  startDate: string;
  endDate: string;
  /** Left out by forms without the box (the agent form's certificate rows), so the stored flag stays. */
  isVerified?: boolean;
  /** A new PDF to store (replacing any current one); null or left out keeps what is there. */
  file?: File | null;
  status: CertificationStatus;
};

/** Fields the form has, for an error to sit under; `form` is for errors about the attempt itself. */
export type CertificationErrorField =
  | "agent"
  | "policyType"
  | "startDate"
  | "endDate"
  | "isVerified"
  | "file"
  | "status"
  | "form";

/** A save error, shown under the field it names, or under the form for `form`. */
export type CertificationError = { field: CertificationErrorField; message: string };

/** Certification fields a note can record, in the order a note lists them. */
export type CertificationField = "agent" | "policyType" | "startDate" | "endDate" | "isVerified" | "status" | "file";

export type CertificationChange = FieldChange<CertificationField>;

/**
 * Change-log entry the API writes whenever a certification is added or
 * edited. Append-only: notes are never edited or deleted.
 */
export type CertificationNote = {
  id: string;
  certificationId: CertificationRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Full name of who made the change, or null when unknown. */
  createdBy: string | null;
  /**
   * Only the fields that changed: agent and type by name, dates as YYYY-MM-DD
   * or blank, verified as "yes" / "no", the PDF by file name (blank before the first).
   */
  changes: CertificationChange[];
};

/** A certification as the API serialises it (CertificationSerializer). */
export type ApiCertification = {
  id: string;
  agent: { id: string; name: string; is_active: boolean };
  policy_type: { id: string; name: string; is_active: boolean };
  start_date: string | null;
  end_date: string | null;
  is_verified: boolean;
  file_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** A note as the API serialises it (CertificationNoteSerializer). */
type ApiCertificationNote = {
  id: string;
  certification_id: string;
  kind: "added" | "edited";
  changes: { field: string; from: string; to: string }[];
  created_by: string | null;
  created_at: string;
};

/** API field name -> CertificationField, for a note's changes. */
const NOTE_FIELDS: Record<string, CertificationField> = {
  agent: "agent",
  policy_type: "policyType",
  start_date: "startDate",
  end_date: "endDate",
  is_verified: "isVerified",
  status: "status",
  file: "file",
};

/** An API certification as the app holds it. */
export function toCertificationRecord(certification: ApiCertification): CertificationRecord {
  return {
    id: certification.id,
    agentId: certification.agent.id,
    agentName: certification.agent.name,
    agentStatus: certification.agent.is_active ? "active" : "inactive",
    policyTypeId: certification.policy_type.id,
    policyTypeName: certification.policy_type.name,
    policyTypeStatus: certification.policy_type.is_active ? "active" : "inactive",
    startDate: certification.start_date ?? "",
    endDate: certification.end_date ?? "",
    isVerified: certification.is_verified,
    fileName: certification.file_name,
    status: certification.is_active ? "active" : "inactive",
  };
}

function toCertificationNote(note: ApiCertificationNote): CertificationNote {
  return {
    id: note.id,
    certificationId: note.certification_id,
    kind: note.kind,
    createdAt: note.created_at,
    createdBy: note.created_by,
    changes: note.changes.flatMap((change) => {
      const field = NOTE_FIELDS[change.field];
      return field ? [{ field, from: change.from, to: change.to }] : [];
    }),
  };
}

type CertificationFilter = {
  /** Only this agent's certifications. */
  agentId?: string;
  /** Only certifications for this policy type. */
  policyTypeId?: string;
};

/** Certifications matching `filter` (all when empty), sorted by policy type name then agent name. */
export async function getCertifications(filter: CertificationFilter = {}): Promise<CertificationRecord[]> {
  const certifications = await apiGetAll<ApiCertification>("/certifications/", {
    agent: filter.agentId,
    policy_type: filter.policyTypeId,
  });
  return certifications.map(toCertificationRecord);
}

/** One certification's change notes, newest first. */
export async function getCertificationNotes(certificationId: string): Promise<CertificationNote[]> {
  const notes = await apiGet<ApiCertificationNote[]>(
    `/certifications/${encodeURIComponent(certificationId)}/notes/`,
  );
  return notes.map(toCertificationNote);
}
