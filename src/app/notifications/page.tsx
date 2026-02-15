"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Bell, CheckCheck } from "lucide-react";
import { toast } from "@/components/ui/Toast";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/notifications")
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load");
          return r.json();
        })
        .then((data) => {
          setNotifications(data);
          setLoading(false);
        })
        .catch(() => {
          toast("Failed to load notifications", "error");
          setLoading(false);
        });
    }
  }, [session]);

  async function handleClick(notif: Notification) {
    if (!notif.read) {
      await fetch(`/api/notifications/${notif.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      }).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
    if (notif.link) router.push(notif.link);
  }

  async function markAllAsRead() {
    await fetch("/api/notifications/read-all", { method: "POST" }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast("All notifications marked as read", "success");
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--muted)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--border)] transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Bell className="h-12 w-12 mx-auto text-[var(--muted-foreground)]" />
          <p className="text-lg font-medium">No notifications</p>
          <p className="text-sm text-[var(--muted-foreground)]">
            You'll be notified when a sneaker on your watchlist hits your target price.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
          {notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => handleClick(notif)}
              className={`w-full text-left px-4 py-4 hover:bg-[var(--muted)] transition-colors ${
                !notif.read ? "bg-[var(--accent)]/5" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                {!notif.read && (
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--accent)]" />
                )}
                <div className={!notif.read ? "flex-1" : "flex-1 ml-5"}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{notif.title}</p>
                    <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0">
                      {timeAgo(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                    {notif.message}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
