import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";

export interface Notification {
  id: number;
  user_id: number | null;
  title: string;
  message: string;
  level: 'INFO' | 'WARN' | 'ALERT';
  is_read: boolean;
  read_status?: boolean; // Combined from join
  type: 'POPUP' | 'HEADER' | 'BOTH';
  created_at: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      if (res.data.success) {
        setNotifications(res.data.notifications);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = async (id?: number) => {
    try {
      await api.put("/notifications/read", { notificationId: id, all: !id });
      // Update local state
      if (!id) {
        setNotifications(prev => prev.map(n => ({ ...n, read_status: true, is_read: true })));
      } else {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_status: true, is_read: true } : n));
      }
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Refresh notifications every 1 minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read_status && !n.is_read).length;
  const latestUnread = notifications.find(n => !n.read_status && !n.is_read);

  return {
    notifications,
    unreadCount,
    latestUnread,
    loading,
    fetchNotifications,
    markAsRead
  };
}
