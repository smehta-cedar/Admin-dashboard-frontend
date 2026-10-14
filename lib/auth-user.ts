/*
 * The signed-in user as the app sees them. Client-safe: the shell and navbar
 * import the type, the server-only session module builds the value. Never
 * carries a token or a password.
 */

import type { PermissionAction, RolePermissions } from "@/lib/roles";

/** A user as the API serialises them (UserSerializer). */
export type ApiUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  roles: { id: string; name: string }[];
  designation: { id: string; name: string } | null;
  is_active: boolean;
  is_superuser: boolean;
  /** Set when this account signs in as an agent. Null for staff. */
  agent_id: string | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Module code -> action flags, for modules the role grants anything on.
   * Only GET /auth/me/ sends it (MeSerializer); user lists leave it out.
   */
  permissions?: RolePermissions;
};

export type SessionUser = {
  id: string;
  /** Display name; falls back to the email when the profile has no name. */
  name: string;
  email: string;
  /** The roles' names; empty when none is assigned. */
  roles: string[];
  designation: string | null;
  isSuperuser: boolean;
  /** The agent this account signs in as. Null for staff. */
  agentId: string | null;
  /** What the role lets them do, per module. A superuser has every module. */
  permissions: RolePermissions;
};

export function toSessionUser(user: ApiUser): SessionUser {
  return {
    id: user.id,
    name: user.full_name?.trim() || user.email,
    email: user.email,
    roles: user.roles.map((role) => role.name),
    designation: user.designation?.name ?? null,
    isSuperuser: user.is_superuser,
    agentId: user.agent_id,
    permissions: user.permissions ?? {},
  };
}

/** Whether the role lets this user see `module` (an API module code, e.g. "agents"). */
export function canView(user: SessionUser, module: string): boolean {
  return Boolean(user.permissions[module]?.view);
}

/** Whether the role lets this user create in `module`. */
export function canCreate(user: SessionUser, module: string): boolean {
  return Boolean(user.permissions[module]?.create);
}

/** Whether the roles let this user do `action` in `module`. */
export function can(user: SessionUser, module: string, action: PermissionAction): boolean {
  return Boolean(user.permissions[module]?.[action]);
}
