import "server-only";

/*
 * Page guards for the role's per-module view flag. A dashboard page whose
 * module the role can't see renders <NoAccess /> (components/no-access.tsx)
 * instead of loading its data, so it never reaches the API's 403.
 *
 * The check belongs in each page, not a section layout: layouts and pages
 * render in parallel, so a layout that swaps out its children does not stop
 * the page from running.
 */

import { canView } from "@/lib/auth-user";
import { getSessionUser } from "@/lib/session";

/** Whether the signed-in user's role can see `module`. */
export async function canViewModule(module: string): Promise<boolean> {
  const user = await getSessionUser();
  return Boolean(user && canView(user, module));
}
