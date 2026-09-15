import "server-only";

/*
 * Data boundary for logins. Today it reads logins and notes from
 * data/logins.json and data/login-notes.json; later it queries Supabase.
 * The JSON is trusted as-is, not validated.
 *
 * A login is one agent's access at one carrier: the writing number (producer
 * ID) the carrier assigned them, and the portal username and password. An
 * agent has at most one login per carrier.
 *
 * TODO: real passwords only once storage moves to Supabase with admin-only
 * access. data/logins.json is committed to git and must hold dummy values only.
 */

import loginsJson from "@/data/logins.json";
import notesJson from "@/data/login-notes.json";
import type { AgentRecord } from "@/lib/agents";
import type { CarrierRecord } from "@/lib/carriers";

export type LoginStatus = "active" | "pending" | "inactive";

const LOGIN_STATUSES: readonly string[] = ["active", "pending", "inactive"] satisfies LoginStatus[];

export type LoginRecord = {
  /** Internal ID, numbered 1, 2, 3, … for now. Not the writing number. */
  id: string;
  agentId: AgentRecord["id"];
  /** Unique per agent: one login for each agent at each carrier. */
  carrierId: CarrierRecord["id"];
  /** Producer ID the carrier assigned the agent. Unique within a carrier (ignoring case). */
  writingNumber: string;
  /** Carrier portal username. */
  username: string;
  /** Carrier portal password, stored exactly as entered (not trimmed). Dummy values only for now. */
  portalPassword: string;
  /** Defaults to "active" when adding. */
  status: LoginStatus;
};

/** Login fields a note can record. The ID never changes. */
export type LoginField = Exclude<keyof LoginRecord, "id">;

export type LoginChange = {
  field: LoginField;
  /**
   * Value before, as shown in the UI: agent and carrier by name, not ID.
   * Empty for a new login.
   */
  from: string;
  to: string;
  /** Set for the password: from and to stay empty and the note says only that it changed. */
  redacted?: boolean;
};

/**
 * Change-log entry, written automatically whenever a login is added or edited.
 * Append-only: notes are never edited or deleted.
 */
export type LoginNote = {
  id: string;
  loginId: LoginRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Only the fields that changed, in form order. */
  changes: LoginChange[];
};

/** A login as the JSON may hold it: password missing, or a status we don't know. */
type StoredLogin = Omit<LoginRecord, "portalPassword" | "status"> & {
  portalPassword?: string;
  status?: string;
};

/**
 * Every login, whatever its status, in ID order (1, 2, 3, …). A record
 * without a password gets "", and a missing or unknown status reads as
 * "active" (with a console warning naming the login), so the page still
 * renders it.
 */
export async function getLogins(): Promise<LoginRecord[]> {
  return (loginsJson as StoredLogin[])
    .map((login) => {
      const knownStatus = login.status !== undefined && LOGIN_STATUSES.includes(login.status);
      if (!knownStatus) {
        console.warn(
          `Login ${login.id} has status ${JSON.stringify(login.status)}; treating it as "active".`,
        );
      }
      return {
        ...login,
        portalPassword: login.portalPassword ?? "",
        status: knownStatus ? (login.status as LoginStatus) : "active",
      };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}

/** Every login note, newest first. */
export async function getLoginNotes(): Promise<LoginNote[]> {
  return (notesJson as LoginNote[])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
