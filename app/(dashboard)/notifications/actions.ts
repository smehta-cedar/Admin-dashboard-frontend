"use server";

/*
 * The navbar bell's reads and writes, run on the Next server so the access
 * token stays in its HttpOnly cookie. GET /notifications/, POST
 * /notifications/{id}/read/ and POST /notifications/read-all/. The bell polls
 * the list, so a failure (API down, a stale token) reads as "nothing new"
 * rather than an error or a redirect.
 */

import { apiFetch } from "@/lib/api-server";
import { toNotificationRecord, type ApiNotification, type NotificationRecord } from "@/lib/notifications";

export type NotificationsResult = { notifications: NotificationRecord[]; unread: number };

/** The latest 20, newest first, and how many are unread in all. Null when the API can't be read. */
export async function loadNotifications(): Promise<NotificationsResult | null> {
  const result = await apiFetch<ApiNotification[]>("/notifications/", { params: { page_size: 20 } });
  if (!result.ok) return null;
  const meta = result.meta as { unread?: number } | undefined;
  return { notifications: result.data.map(toNotificationRecord), unread: meta?.unread ?? 0 };
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const result = await apiFetch(`/notifications/${encodeURIComponent(id)}/read/`, { method: "POST" });
  return result.ok;
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const result = await apiFetch("/notifications/read-all/", { method: "POST" });
  return result.ok;
}
