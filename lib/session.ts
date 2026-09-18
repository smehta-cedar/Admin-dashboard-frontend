import "server-only";

/*
 * Reads the fake session cookie on the server and resolves it to a user. The
 * dashboard layout calls this to gate the app and to name the signed-in user
 * in the navbar. Using cookies() makes every dashboard route render per
 * request, which is what a session needs anyway.
 */

import { cookies } from "next/headers";
import { SESSION_COOKIE, type SessionUser } from "@/lib/fake-session";
import { getUsers } from "@/lib/users";

/**
 * The signed-in user, or null when there is no cookie, it names no user, or
 * that user is inactive (an inactive user is signed out on their next request).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!userId) return null;

  const users = await getUsers();
  const user = users.find((candidate) => candidate.id === userId);
  if (!user || user.status === "inactive") return null;

  const { id, name, email, role } = user;
  return { id, name, email, role };
}
