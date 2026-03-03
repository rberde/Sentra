"use client";

import React, { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { Notification } from "@/lib/types";
import { ToastPing } from "@/components/notifications/toast-ping";

interface ToastContextType {
  showToast: (notification: Notification) => void;
  showToasts: (notifications: Notification[]) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Notification[]>([]);
  const soundPlayedRef = useRef(new Set<string>());

  const dismiss = useCallback((id: string) => {
    setQueue(q => q.filter(n => n.id !== id));
    soundPlayedRef.current.delete(id);
  }, []);

  const showToast = useCallback((notification: Notification) => {
    setQueue(q => {
      const next = [notification, ...q];
      return next.slice(0, MAX_VISIBLE);
    });
  }, []);

  const showToasts = useCallback((notifications: Notification[]) => {
    if (notifications.length === 0) return;
    setQueue(q => {
      const next = [...notifications, ...q];
      return next.slice(0, MAX_VISIBLE);
    });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showToasts }}>
      {children}
      {queue.map((n, i) => (
        <ToastPing
          key={n.id}
          notification={n}
          onDismiss={dismiss}
          index={i}
          playSound={i === 0 && !soundPlayedRef.current.has(n.id)}
        />
      ))}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
