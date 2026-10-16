"use server";

/*
 * Write or delete a note on the agency's Notes panel, run on the Next server
 * so the access token stays in its HttpOnly cookie. POST
 * /agencies/{id}/comments/ or DELETE /agencies/comments/{id}/; both need the
 * role to edit agencies. These are written notes, not the change log (the
 * History panel).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toAgencyComment, type AgencyComment, type ApiAgencyComment } from "@/lib/agency";
import { apiFetch } from "@/lib/api-server";

export type AgencyCommentResult = { ok: true; comment: AgencyComment } | { ok: false; message: string };

/** Adds a note to the agency with `agencyId`. */
export async function addAgencyComment(agencyId: string, body: string): Promise<AgencyCommentResult> {
  const result = await apiFetch<ApiAgencyComment>(`/agencies/${encodeURIComponent(agencyId)}/comments/`, {
    method: "POST",
    body: { body },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    return { ok: false, message: result.errors?.body?.[0] ?? result.message };
  }
  revalidatePath("/agency");
  return { ok: true, comment: toAgencyComment(result.data) };
}

/** Deletes the note with `id`. Resolves with the message to show, or null. */
export async function deleteAgencyComment(id: string): Promise<string | null> {
  const result = await apiFetch<null>(`/agencies/comments/${encodeURIComponent(id)}/`, { method: "DELETE" });
  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    return result.message;
  }
  revalidatePath("/agency");
  return null;
}
