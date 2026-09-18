import "server-only";

/*
 * Data boundary for passwords. Today it reads records and notes from
 * data/passwords.json and data/password-notes.json; later it queries
 * Supabase. The JSON is trusted as-is, not validated.
 *
 * A password is one agent's portal access at one carrier: the portal
 * username and password. An agent has at most one password per carrier.
 * The writing number (producer ID) lives on the carrier contract in
 * lib/carrier-contracts.ts.
 *
 * Distinct from app/login (sign-in to this app). Passwords are carrier
 * portal credentials stored in the dashboard.
 *
 * TODO: real passwords only once storage moves to Supabase with admin-only
 * access. data/passwords.json is committed to git and must hold dummy
 * values only.
 */

import passwordsJson from "@/data/passwords.json";
import notesJson from "@/data/password-notes.json";
import type { AgentRecord } from "@/lib/agents";
import type { CarrierRecord } from "@/lib/carriers";

export type PasswordStatus = "active" | "pending" | "inactive";

const PASSWORD_STATUSES: readonly string[] = [
  "active",
  "pending",
  "inactive",
] satisfies PasswordStatus[];

export type PasswordRecord = {
  /** Internal ID, numbered 1, 2, 3, … for now. */
  id: string;
  agentId: AgentRecord["id"];
  /** Unique per agent: one password for each agent at each carrier. */
  carrierId: CarrierRecord["id"];
  /** Carrier portal username. */
  username: string;
  /** Carrier portal password, stored exactly as entered (not trimmed). Dummy values only for now. */
  portalPassword: string;
  /** Defaults to "active" when adding. */
  status: PasswordStatus;
};

/** Password fields a note can record. The ID never changes. */
export type PasswordField = Exclude<keyof PasswordRecord, "id">;

export type PasswordChange = {
  field: PasswordField;
  /**
   * Value before, as shown in the UI: agent and carrier by name, not ID.
   * Empty for a new password.
   */
  from: string;
  to: string;
  /** Set for the password: from and to stay empty and the note says only that it changed. */
  redacted?: boolean;
};

/**
 * Change-log entry, written automatically whenever a password is added or edited.
 * Append-only: notes are never edited or deleted.
 */
export type PasswordNote = {
  id: string;
  passwordId: PasswordRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Only the fields that changed, in form order. */
  changes: PasswordChange[];
};

/** A password as the JSON may hold it: password missing, or a status we don't know. */
type StoredPassword = Omit<PasswordRecord, "portalPassword" | "status"> & {
  portalPassword?: string;
  status?: string;
};

/**
 * Every password, whatever its status, in ID order (1, 2, 3, …). A record
 * without a password gets "", and a missing or unknown status reads as
 * "active" (with a console warning naming the record), so the page still
 * renders it.
 */
export async function getPasswords(): Promise<PasswordRecord[]> {
  return (passwordsJson as StoredPassword[])
    .map((record) => {
      const knownStatus =
        record.status !== undefined && PASSWORD_STATUSES.includes(record.status);
      if (!knownStatus) {
        console.warn(
          `Password ${record.id} has status ${JSON.stringify(record.status)}; treating it as "active".`,
        );
      }
      return {
        ...record,
        portalPassword: record.portalPassword ?? "",
        status: knownStatus ? (record.status as PasswordStatus) : "active",
      };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}

/** Every password note, newest first. */
export async function getPasswordNotes(): Promise<PasswordNote[]> {
  return (notesJson as PasswordNote[])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
