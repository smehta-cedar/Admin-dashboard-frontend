"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/(dashboard)/notifications/actions";
import { onNotificationsRefresh, timeAgo, type NotificationRecord } from "@/lib/notifications";

/*
 * The navbar's bell: a count of unread notifications and a dropdown of the
 * latest 20 (lib/notifications.ts). Loads on mount, at once after this user
 * files a request (refreshNotificationsSoon), then every 10 seconds while the
 * tab is visible and again when it regains focus, so a request filed by
 * someone else shows up without a reload. Opening an item marks it
 * read and follows its link; "Mark all read" clears the count.
 */

const POLL_MS = 10_000;

export function NotificationsMenu({ buttonClassName }: { buttonClassName: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const refresh = useCallback(async () => {
    const result = await loadNotifications();
    if (!result) return;
    setNotifications(result.notifications);
    setUnread(result.unread);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const unsubscribe = onNotificationsRefresh(onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      unsubscribe();
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = (notification: NotificationRecord) => {
    setOpen(false);
    if (notification.read) return;
    setNotifications((current) =>
      current.map((candidate) => (candidate.id === notification.id ? { ...candidate, read: true } : candidate)),
    );
    setUnread((count) => Math.max(0, count - 1));
    void markNotificationRead(notification.id);
  };

  const markAllRead = async () => {
    setNotifications((current) => current.map((candidate) => ({ ...candidate, read: true })));
    setUnread(0);
    if (!(await markAllNotificationsRead())) void refresh();
  };

  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((current) => !current);
          if (!open) void refresh();
        }}
        className={`relative ${buttonClassName}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8.5 16.5a1.5 1.5 0 0 0 3 0M4.5 14.5h11l-1.2-1.5V9a4.3 4.3 0 1 0-8.6 0v4Z" />
        </svg>
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={menuId}
          role="region"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <p className="text-sm font-medium text-fg">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-brand-ink hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-fg-muted">No notifications yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <NotificationItem notification={notification} onOpen={() => markRead(notification)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NotificationItem({ notification, onOpen }: { notification: NotificationRecord; onOpen: () => void }) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.read ? "bg-transparent" : "bg-brand"}`}
      />
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${notification.read ? "text-fg-muted" : "font-medium text-fg"}`}>
          {notification.title}
          {notification.read ? null : <span className="sr-only"> (unread)</span>}
        </span>
        {notification.body ? (
          <span className="block truncate text-xs text-fg-muted">{notification.body}</span>
        ) : null}
        <span className="mt-0.5 block text-xs text-fg-subtle">{timeAgo(notification.createdAt)}</span>
      </span>
    </>
  );
  const className = "flex w-full gap-2.5 px-3 py-2.5 text-left hover:bg-surface-hover";

  return notification.link ? (
    <Link href={notification.link} onClick={onOpen} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onOpen} className={className}>
      {content}
    </button>
  );
}
