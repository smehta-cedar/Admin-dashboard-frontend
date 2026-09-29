/*
 * Notifications under the navbar's bell: the signed-in user's own, from the
 * Django API (`/api/v1/notifications/`, backend/apps/notifications). Filing a
 * request sends one to every admin (superusers and anyone whose role has
 * "admin" in its name), the filer included. Client-safe types; the
 * reads and writes are the server actions in
 * app/(dashboard)/notifications/actions.ts.
 */

export type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  /** App path it opens, e.g. "/hr"; "" when it opens nothing. */
  link: string;
  /** ISO 8601 timestamp in UTC. */
  createdAt: string;
  read: boolean;
};

/** A notification as the API serialises it (NotificationSerializer). */
export type ApiNotification = {
  id: string;
  title: string;
  body: string;
  link: string;
  request_id: string | null;
  read_at: string | null;
  created_at: string;
};

export function toNotificationRecord(notification: ApiNotification): NotificationRecord {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    createdAt: notification.created_at,
    read: notification.read_at !== null,
  };
}

const REFRESH_EVENT = "notifications:refresh";

/** Asks the bell to reload now, e.g. right after this user filed a request. */
export function refreshNotificationsSoon() {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

/** Runs `onRefresh` whenever refreshNotificationsSoon is called; returns the unsubscribe. */
export function onNotificationsRefresh(onRefresh: () => void): () => void {
  window.addEventListener(REFRESH_EVENT, onRefresh);
  return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
}

/** "just now", "5m ago", "3h ago", "2d ago", then the date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
