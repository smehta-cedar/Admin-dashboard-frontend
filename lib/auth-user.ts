/*
 * The signed-in user as the app sees them. Client-safe: the shell and navbar
 * import the type, the server-only session module builds the value. Never
 * carries a token or a password.
 */

/** A user as the API serialises them (UserSerializer). */
export type ApiUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: { id: string; name: string } | null;
  designation: { id: string; name: string } | null;
  is_active: boolean;
  is_superuser: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionUser = {
  id: string;
  /** Display name; falls back to the email when the profile has no name. */
  name: string;
  email: string;
  /** The role's name, or null when none is assigned. Shown, not yet enforced. */
  role: string | null;
  designation: string | null;
  isSuperuser: boolean;
};

export function toSessionUser(user: ApiUser): SessionUser {
  return {
    id: user.id,
    name: user.full_name?.trim() || user.email,
    email: user.email,
    role: user.role?.name ?? null,
    designation: user.designation?.name ?? null,
    isSuperuser: user.is_superuser,
  };
}
