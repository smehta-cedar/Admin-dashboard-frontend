import "server-only";

/*
 * Data boundary for users: the people who sign in to this app, read from
 * the Django API (`/api/v1/users/`, backend/apps/accounts) as the signed-in
 * user. Adds and edits go through the server action in
 * app/(dashboard)/users/actions.ts; the API records a change note on every
 * add, every edit that changed something, every block / unblock and every
 * password set (the password only as "set" / "changed").
 *
 * A user's role is one of the API's Role rows (lib: `RoleOption`), which
 * decide what the API lets them do per module; the frontend shows the role
 * name and does not gate anything by it yet. Agents and the agency don't
 * sign in; that is a later phase.
 *
 * Passwords are never returned by the API: the list has no password column
 * any more, and the form sets one on add or when a new one is typed on edit.
 * data/users.json is no longer read here; it is the seed file for
 * `python manage.py seed_users` (local development only).
 */

import { apiGet, apiGetAll } from "@/lib/api-server";
import type { ApiUser } from "@/lib/auth-user";
import type { FieldChange } from "@/lib/change-notes";

export type UserStatus = "active" | "inactive";

/** A role a user can be given, as the API lists it. */
export type RoleOption = { id: string; name: string };

export type UserRecord = {
  /** The API's UUID. */
  id: string;
  /** Display name (the API's full_name). */
  name: string;
  /** What they sign in with. Unique, ignoring case. */
  email: string;
  phone: string;
  /** The assigned role, or null when none. */
  role: RoleOption | null;
  /** The API's is_active. An inactive (blocked) user can't sign in. */
  status: UserStatus;
  /** A superuser has every permission whatever their role; only a superuser can change one. */
  isSuperuser: boolean;
};

/** User fields a note can record. */
export type UserField = "name" | "email" | "phone" | "role" | "status" | "password";

/** What the add / edit form submits. `password` is empty on an edit that keeps it. */
export type UserValues = {
  name: string;
  email: string;
  phone: string;
  /** A role's ID, or "" for none. */
  roleId: string;
  status: UserStatus;
  password: string;
};

/** A save error, shown under the field it names, or under the form for `form`. */
export type UserError = { field: keyof UserValues | "form"; message: string };

export type UserChange = FieldChange<UserField>;

/**
 * Change-log entry the API writes for a user. Append-only. The password is
 * recorded redacted: from and to stay empty and the note says only that it
 * was set or changed.
 */
export type UserNote = {
  id: string;
  userId: UserRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Full name of who made the change, or null when unknown. */
  createdBy: string | null;
  /** Only the fields that changed, in form order. */
  changes: UserChange[];
};

/** A note as the API serialises it (UserNoteSerializer). */
type ApiUserNote = {
  id: string;
  user_id: string;
  kind: "added" | "edited";
  changes: { field: string; from: string; to: string; redacted?: boolean }[];
  created_by: string | null;
  created_at: string;
};

const NOTE_FIELDS: readonly string[] = ["name", "email", "phone", "role", "status", "password"] satisfies UserField[];

/** An API user as the Users page holds them. */
export function toUserRecord(user: ApiUser): UserRecord {
  return {
    id: user.id,
    name: user.full_name?.trim() || user.email,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.is_active ? "active" : "inactive",
    isSuperuser: user.is_superuser,
  };
}

function toUserNote(note: ApiUserNote): UserNote {
  return {
    id: note.id,
    userId: note.user_id,
    kind: note.kind,
    createdAt: note.created_at,
    createdBy: note.created_by,
    changes: note.changes.flatMap((change) => {
      if (!NOTE_FIELDS.includes(change.field)) return [];
      const field = change.field as UserField;
      return [
        change.redacted
          ? { field, from: "", to: "", redacted: true }
          : { field, from: change.from, to: change.to },
      ];
    }),
  };
}

/** Every user, active and blocked, in the API's order (newest first). */
export async function getUsers(): Promise<UserRecord[]> {
  const users = await apiGetAll<ApiUser>("/users/");
  return users.map(toUserRecord);
}

/** The roles a user can be given, by name. */
export async function getRoles(): Promise<RoleOption[]> {
  return apiGet<RoleOption[]>("/roles/");
}

/** Every live user's change notes, newest first (the Users page's expandable rows). */
export async function getUserNotes(): Promise<UserNote[]> {
  const notes = await apiGetAll<ApiUserNote>("/users/notes/");
  return notes.map(toUserNote);
}
