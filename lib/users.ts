import "server-only";

/*
 * Data boundary for users: the people who sign in to this app. Today it reads
 * data/users.json and data/user-notes.json; later it queries Supabase. The
 * JSON is trusted as-is, not validated.
 *
 * A user has a role (admin or staff) that is stored and shown but not yet
 * enforced: every signed-in user still sees the whole app. Agents and the
 * agency don't sign in yet; that login (and any link from a user to an
 * AgentRecord) is a later phase. Sign-in is a fake, client-side match against
 * this list (see app/login) until Supabase Auth lands.
 *
 * TODO: real passwords only once storage moves to Supabase Auth. data/users.json
 * is committed to git and must hold dummy values only.
 */

import usersJson from "@/data/users.json";
import notesJson from "@/data/user-notes.json";

export type UserRole = "admin" | "staff";

export type UserStatus = "active" | "inactive";

const USER_ROLES: readonly string[] = ["admin", "staff"] satisfies UserRole[];
const USER_STATUSES: readonly string[] = ["active", "inactive"] satisfies UserStatus[];

export type UserRecord = {
  /** Internal ID, numbered 1, 2, 3, … for now. */
  id: string;
  /** Display name. */
  name: string;
  /** What they sign in with. Unique, ignoring case. */
  email: string;
  /** Stored and shown; nothing is gated by it yet. Defaults to "staff" when adding. */
  role: UserRole;
  /** An inactive user can't sign in. Defaults to "active" when adding. */
  status: UserStatus;
  /** Stored exactly as entered (not trimmed). Dummy values only for now. */
  password: string;
};

/** User fields a note can record. The ID never changes. */
export type UserField = Exclude<keyof UserRecord, "id">;

export type UserChange = {
  field: UserField;
  /** Value before, as shown in the UI. Empty for a new user. */
  from: string;
  to: string;
  /** Set for the password: from and to stay empty and the note says only that it changed. */
  redacted?: boolean;
};

/**
 * Change-log entry, written automatically whenever a user is added or edited.
 * Append-only: notes are never edited or deleted.
 */
export type UserNote = {
  id: string;
  userId: UserRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Only the fields that changed, in form order. */
  changes: UserChange[];
};

/** A user as the JSON may hold it: a role or status we don't know. */
type StoredUser = Omit<UserRecord, "role" | "status"> & { role?: string; status?: string };

/**
 * Every user, whatever their status, in ID order (1, 2, 3, …). An unknown
 * role reads as "staff" and an unknown status as "active", each with a
 * console warning naming the user.
 */
export async function getUsers(): Promise<UserRecord[]> {
  return (usersJson as StoredUser[])
    .map((user) => {
      const knownRole = user.role !== undefined && USER_ROLES.includes(user.role);
      if (!knownRole) {
        console.warn(`User ${user.id} has role ${JSON.stringify(user.role)}; treating it as "staff".`);
      }
      const knownStatus = user.status !== undefined && USER_STATUSES.includes(user.status);
      if (!knownStatus) {
        console.warn(
          `User ${user.id} has status ${JSON.stringify(user.status)}; treating it as "active".`,
        );
      }
      return {
        ...user,
        role: knownRole ? (user.role as UserRole) : "staff",
        status: knownStatus ? (user.status as UserStatus) : "active",
      };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}

/** Every user note, newest first. */
export async function getUserNotes(): Promise<UserNote[]> {
  return (notesJson as UserNote[])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
