"use client";

import { useState } from "react";
import { useApp } from "@/contexts/app-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  AlertTriangle,
  TrendingUp,
  Clock,
  ShieldAlert,
  ArrowDownRight,
  X,
  CheckCircle2,
  Archive,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import type { Notification, NotificationType } from "@/lib/types";

const MAX_VISIBLE = 5;

const NOTIF_META: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  spending_limit: { icon: AlertTriangle, color: "text-orange-500" },
  liquidity_warning: { icon: ShieldAlert, color: "text-red-500" },
  reallocation_opportunity: { icon: TrendingUp, color: "text-green-500" },
  drift_alert: { icon: ArrowDownRight, color: "text-yellow-500" },
  scheduled_checkin: { icon: Clock, color: "text-blue-500" },
};

function NotifCard({ notif, onDismiss, compact }: { notif: Notification; onDismiss?: (id: string) => void; compact?: boolean }) {
  const meta = NOTIF_META[notif.type];
  const Icon = meta.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-white/60 hover:bg-white transition-colors">
        <Icon className={`w-4 h-4 shrink-0 ${meta.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium truncate">{notif.title}</span>
            <Badge
              variant={notif.severity === "urgent" ? "destructive" : "outline"}
              className="text-[10px] px-1.5 py-0 shrink-0"
            >
              {notif.severity}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{notif.message}</p>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
          {new Date(notif.createdAt).toLocaleDateString()}
        </span>
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 flex items-start gap-3">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${meta.color}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{notif.title}</span>
            <Badge
              variant={notif.severity === "urgent" ? "destructive" : "secondary"}
              className="text-xs"
            >
              {notif.severity}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
          <span className="text-xs text-muted-foreground">
            {new Date(notif.createdAt).toLocaleString()}
          </span>
        </div>
        {onDismiss && (
          <Button size="sm" variant="ghost" onClick={() => onDismiss(notif.id)}>
            <X className="w-3 h-3" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function NotificationCenter() {
  const { state, dispatch } = useApp();
  const [archiveOpen, setArchiveOpen] = useState(false);

  const active = state.notifications.filter(n => !n.isDismissed);
  const dismissed = state.notifications.filter(n => n.isDismissed);

  const recentActive = active.slice(0, MAX_VISIBLE);
  const archivedActive = active.slice(MAX_VISIBLE);
  const totalArchived = archivedActive.length + dismissed.length;

  const dismissAll = () => {
    for (const n of active) {
      dispatch({ type: "DISMISS_NOTIFICATION", notificationId: n.id });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications
          {active.length > 0 && (
            <Badge variant="destructive" className="text-xs">{active.length}</Badge>
          )}
        </h2>
        {active.length > 1 && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={dismissAll}>
            Dismiss all
          </Button>
        )}
      </div>

      {/* Empty state */}
      {state.notifications.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-3" />
            <p className="text-muted-foreground">All clear! No notifications yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Notifications will appear here when the AI detects spending patterns, liquidity changes, or rebalancing opportunities.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent (visible) notifications */}
      {recentActive.length > 0 && (
        <div className="space-y-2">
          {recentActive.map(notif => (
            <NotifCard
              key={notif.id}
              notif={notif}
              onDismiss={id => dispatch({ type: "DISMISS_NOTIFICATION", notificationId: id })}
            />
          ))}
        </div>
      )}

      {/* Archive section */}
      {totalArchived > 0 && (
        <div className="rounded-xl border bg-slate-50/80">
          <button
            className="w-full flex items-center justify-between p-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setArchiveOpen(o => !o)}
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4" />
              <span>Archive</span>
              <Badge variant="secondary" className="text-xs">{totalArchived}</Badge>
            </div>
            {archiveOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {archiveOpen && (
            <div className="px-3 pb-3 space-y-1.5">
              {archivedActive.length > 0 && (
                <>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide px-1 pt-1">
                    Older Alerts ({archivedActive.length})
                  </p>
                  {archivedActive.map(notif => (
                    <NotifCard key={notif.id} notif={notif} compact />
                  ))}
                </>
              )}

              {dismissed.length > 0 && (
                <>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide px-1 pt-2">
                    Dismissed ({dismissed.length})
                  </p>
                  {dismissed.map(notif => (
                    <NotifCard key={notif.id} notif={notif} compact />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
