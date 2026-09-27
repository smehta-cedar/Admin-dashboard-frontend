import "server-only";

/*
 * Data boundary for passwords: reads the Django API (backend/apps/passwords,
 * `/api/v1/passwords/`) as the signed-in user. Adds and edits go through the
 * server actions in app/(dashboard)/passwords/actions.ts; the API records a
 * change note on every add and every edit that changed something, with the
 * password itself only ever noted as "set" or "changed".
 *
 * A password is one agent's portal access at one carrier: the portal
 * username and password. An agent has at most one password per carrier
 * (the API enforces it). The writing number (producer ID) lives on the
 * carrier contract in lib/carrier-contracts.ts.
 *
 * Distinct from app/login (sign-in to this app). Passwords are carrier
 * portal credentials stored in the dashboard. The API returns the portal
 * password with each record, because the page shows and copies it; only a
 * role with the `passwords` module can read it, and it reaches the browser
 * in the page's props (never the search index).
 *
 * data/passwords.json is no longer read here; it is the seed file for
 * `python manage.py seed_passwords`.
 */

import type { AgentRecord } from "@/lib/agents";
import { apiGet, apiGetAll } from "@/lib/api-server";
import type { CarrierRecord } from "@/lib/carriers";
import type { FieldChange } from "@/lib/change-notes";

export type PasswordStatus = "active" | "pending" | "inactive";

const PASSWORD_STATUSES: readonly string[] = [
  "active",
  "pending",
  "inactive",
] satisfies PasswordStatus[];

export type PasswordRecord = {
  /** The API's UUID. */
  id: string;
  agentId: AgentRecord["id"];
  /** The agent's name as of the read, for display without another lookup. */
  agentName: string;
  /** Unique per agent: one password for each agent at each carrier. */
  carrierId: CarrierRecord["id"];
  carrierName: string;
  /** Carrier portal username. */
  username: string;
  /** Carrier portal password, exactly as entered (not trimmed). */
  portalPassword: string;
  /** Defaults to "active" when adding. */
  status: PasswordStatus;
};

/** Password fields a note can record. The ID and the looked-up names never change on their own. */
export type PasswordField = Exclude<keyof PasswordRecord, "id" | "agentName" | "carrierName">;

/** What the add / edit form submits. */
export type PasswordValues = Pick<PasswordRecord, PasswordField>;

/** A save error, shown under the field it names, or under the form for `form`. */
export type PasswordError = { field: PasswordField | "form"; message: string };

export type PasswordChange = FieldChange<PasswordField>;

/**
 * Change-log entry the API writes whenever a password is added or edited.
 * Append-only: notes are never edited or deleted. The password is recorded
 * redacted: from and to stay empty and the note says only that it changed.
 */
export type PasswordNote = {
  id: string;
  passwordId: PasswordRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Full name of who made the change, or null when unknown. */
  createdBy: string | null;
  /** Only the fields that changed, in form order. */
  changes: PasswordChange[];
};

/** A password as the API serialises it (PasswordSerializer). */
export type ApiPassword = {
  id: string;
  agent: { id: string; name: string; is_active: boolean };
  carrier: { id: string; name: string; is_active: boolean };
  username: string;
  portal_password: string;
  status: string;
  created_at: string;
  updated_at: string;
};

/** A note as the API serialises it (PasswordNoteSerializer). */
type ApiPasswordNote = {
  id: string;
  password_id: string;
  kind: "added" | "edited";
  changes: { field: string; from: string; to: string; redacted?: boolean }[];
  created_by: string | null;
  created_at: string;
};

/** API field name -> PasswordRecord field, for a note's changes. */
const NOTE_FIELDS: Record<string, PasswordField> = {
  agent: "agentId",
  carrier: "carrierId",
  username: "username",
  password: "portalPassword",
  status: "status",
};

/** An API password as the app holds it. An unknown status reads as "active" with a console warning. */
export function toPasswordRecord(password: ApiPassword): PasswordRecord {
  const knownStatus = PASSWORD_STATUSES.includes(password.status);
  if (!knownStatus) {
    console.warn(
      `Password ${password.id} has status ${JSON.stringify(password.status)}; treating it as "active".`,
    );
  }
  return {
    id: password.id,
    agentId: password.agent.id,
    agentName: password.agent.name,
    carrierId: password.carrier.id,
    carrierName: password.carrier.name,
    username: password.username,
    portalPassword: password.portal_password,
    status: knownStatus ? (password.status as PasswordStatus) : "active",
  };
}

function toPasswordNote(note: ApiPasswordNote): PasswordNote {
  return {
    id: note.id,
    passwordId: note.password_id,
    kind: note.kind,
    createdAt: note.created_at,
    createdBy: note.created_by,
    changes: note.changes.flatMap((change) => {
      const field = NOTE_FIELDS[change.field];
      if (!field) return [];
      return [
        change.redacted
          ? { field, from: "", to: "", redacted: true }
          : { field, from: change.from, to: change.to },
      ];
    }),
  };
}

/** Every password, whatever its status, by agent name then carrier name. */
export async function getPasswords(): Promise<PasswordRecord[]> {
  const passwords = await apiGetAll<ApiPassword>("/passwords/");
  return passwords.map(toPasswordRecord);
}

/** One password's change notes, newest first. */
export async function getPasswordNotes(passwordId: string): Promise<PasswordNote[]> {
  const notes = await apiGet<ApiPasswordNote[]>(`/passwords/${encodeURIComponent(passwordId)}/notes/`);
  return notes.map(toPasswordNote);
}
