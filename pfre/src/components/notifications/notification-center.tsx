"use client";

import { useApp } from "@/contexts/app-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import type { NotificationType } from "@/lib/types";

const NOTIF_META: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  spending_limit: { icon: AlertTriangle, color: "text-orange-500" },
  liquidity_warning: { icon: ShieldAlert, color: "text-red-500" },
  reallocation_opportunity: { icon: TrendingUp, color: "text-green-500" },
  drift_alert: { icon: ArrowDownRight, color: "text-yellow-500" },
  scheduled_checkin: { icon: Clock, color: "text-blue-500" },
};

export function NotificationCenter() {
  const { state, dispatch } = useApp();
  const active = state.notifications.filter(n => !n.isDismissed);
  const dismissed = state.notifications.filter(n => n.isDismissed);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications
          {active.length > 0 && (
            <Badge variant="destructive" className="text-xs">{active.length}</Badge>
          )}
        </h2>
      </div>

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

      {active.length > 0 && (
        <div className="space-y-2">
          {active.map(notif => {
            const meta = NOTIF_META[notif.type];
            const Icon = meta.icon;
            return (
              <Card key={notif.id} className="border-0 shadow-sm">
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
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dispatch({ type: "DISMISS_NOTIFICATION", notificationId: notif.id })}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {dismissed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Dismissed</h3>
          {dismissed.map(notif => {
            const meta = NOTIF_META[notif.type];
            const Icon = meta.icon;
            return (
              <Card key={notif.id} className="border-0 shadow-sm opacity-50">
                <CardContent className="p-3 flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                  <span className="text-sm flex-1">{notif.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(notif.createdAt).toLocaleDateString()}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
