"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

export type NotificationType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: NotificationType;
}

interface ConfirmOptions {
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface NotificationContextType {
  toasts: Toast[];
  notify: (message: string, type?: NotificationType) => void;
  confirm: (options: ConfirmOptions) => void;
  activeConfirm: ConfirmOptions | null;
  closeConfirm: () => void;
  removeToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeConfirm, setActiveConfirm] = useState<ConfirmOptions | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, type: NotificationType = "success") => {
    const id = uuidv4();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, [removeToast]);

  const confirm = useCallback((options: ConfirmOptions) => {
    setActiveConfirm(options);
  }, []);

  const closeConfirm = useCallback(() => {
    setActiveConfirm(null);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        notify,
        confirm,
        activeConfirm,
        closeConfirm,
        removeToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}
