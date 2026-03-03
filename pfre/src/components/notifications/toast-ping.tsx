"use client";

import { useEffect, useRef } from "react";
import type { Notification } from "@/lib/types";
import { AlertTriangle, Bell, ShieldAlert, Info, X } from "lucide-react";

// Tiny base64-encoded ping chime (~2KB) — a short 200ms C5 sine wave
const PING_SOUND_DATA_URI =
  "data:audio/wav;base64,UklGRiQBAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQABAAAAAAA" +
  "AcADwAGABwAEQAlACgAKgArACsAKgAoACUAIQAsABYAHwAHAAAAcADw/2D/wP4Q/lD+gP6g/rD+sP6g/o" +
  "D+UP4Q/sD+YP8fAHAAAAcADwAGABwAEQAlACgAKgArACsAKgAoACUAIQAsABYAHwAHAAAAcADw/2D/wP4Q" +
  "/lD+gP6g/rD+sP6g/oD+UP4Q/sD+YP8fAHAAAAcADwAGABwAEQAlACgAKgArACsAKgAoACUAIQAsABYAH" +
  "wAHAAAAcADw/2D/wP4Q/lD+gP6g/rD+sP6g/oD+UP4Q/sD+YP8fAHAA";

interface ToastPingProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  index: number;
  playSound: boolean;
}

const severityConfig = {
  urgent: {
    bg: "bg-red-50 border-red-300",
    icon: ShieldAlert,
    iconColor: "text-red-600",
    badge: "bg-red-100 text-red-700",
  },
  warning: {
    bg: "bg-amber-50 border-amber-300",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    badge: "bg-amber-100 text-amber-700",
  },
  info: {
    bg: "bg-blue-50 border-blue-300",
    icon: Info,
    iconColor: "text-blue-600",
    badge: "bg-blue-100 text-blue-700",
  },
};

export function ToastPing({ notification, onDismiss, index, playSound }: ToastPingProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const config = severityConfig[notification.severity] ?? severityConfig.info;
  const IconComp = config.icon;

  useEffect(() => {
    if (playSound) {
      try {
        const audio = new Audio(PING_SOUND_DATA_URI);
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch {}
    }
  }, [playSound]);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss(notification.id);
    }, 6000);
    return () => clearTimeout(timerRef.current);
  }, [notification.id, onDismiss]);

  const topOffset = index * 90;

  return (
    <div
      className={`fixed right-4 z-[100] w-[370px] rounded-xl border shadow-lg ${config.bg} animate-toast-slide-in cursor-pointer`}
      style={{ top: `${16 + topOffset}px` }}
      onClick={() => onDismiss(notification.id)}
      role="alert"
    >
      <div className="flex items-start gap-3 p-4">
        <div className={`mt-0.5 shrink-0 ${config.iconColor}`}>
          <IconComp className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-slate-900 truncate">
              {notification.title}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.badge}`}>
              {notification.severity}
            </span>
          </div>
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {notification.message}
          </p>
        </div>
        <button
          className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
          onClick={(e) => { e.stopPropagation(); onDismiss(notification.id); }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="h-0.5 bg-slate-200/60 rounded-b-xl overflow-hidden">
        <div className="h-full bg-slate-400/40 animate-toast-timer" />
      </div>
    </div>
  );
}
