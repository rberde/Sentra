"use client";

import { useState, useCallback } from "react";
import { useApp } from "@/contexts/app-context";
import { useToast } from "@/contexts/toast-context";
import { runAgentChecks } from "@/lib/engine/agent-checks";
import type { Expense } from "@/lib/types";
import { FinancialSnapshot } from "./financial-snapshot";
import { AllocationEditor } from "./allocation-editor";
import { SavingsGoalCard } from "./savings-goal-card";
import { NotificationSettingsCard } from "@/components/settings/notification-settings-card";
import { AccountPage } from "@/components/account/account-page";
import { RiskEventPanel } from "@/components/risk/risk-event-panel";
import { RebalancingPanel } from "@/components/rebalancing/rebalancing-panel";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  AlertTriangle,
  Sparkles,
  Bell,
  MessageSquare,
  LogOut,
  UserCircle2,
  Settings,
  Zap,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type { AppState } from "@/lib/store";

export function DashboardLayout() {
  const { state, dispatch } = useApp();
  const { showToasts } = useToast();
  const [chatOpen, setChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [refreshingPlaid, setRefreshingPlaid] = useState(false);
  const unreadNotifications = state.notifications.filter(n => !n.isDismissed).length;

  const handleReset = () => {
    if (confirm("Reset all data? This will clear your profile and start over.")) {
      dispatch({ type: "RESET_STATE" });
    }
  };

  const handleSimulateSpike = () => {
    if (!state.profile) return;
    const spikeMultiplier = 1.35 + Math.random() * 0.15;
    const inflatedVariableExpenses = state.profile.variableExpenses.map(e => ({
      ...e,
      amount: Math.round(e.amount * spikeMultiplier),
    }));
    const inflatedState: AppState = {
      ...state,
      profile: { ...state.profile, variableExpenses: inflatedVariableExpenses },
    };
    const notifications = runAgentChecks(inflatedState);
    if (notifications.length === 0) {
      notifications.push({
        id: crypto.randomUUID(),
        type: "spending_limit",
        title: "Simulation Complete",
        message: "No thresholds were breached with the simulated expense spike. Your plan has good headroom!",
        severity: "info",
        isDismissed: false,
        createdAt: new Date().toISOString(),
      });
    }
    for (const n of notifications) {
      dispatch({ type: "ADD_NOTIFICATION", notification: n });
    }
    showToasts(notifications);
    // Push to n8n webhook (non-blocking)
    fetch("/api/n8n/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalAlerts: notifications.length,
        alerts: notifications.map(n => ({
          check: n.type,
          alert: true,
          severity: n.severity,
          title: n.title,
          message: n.message,
        })),
        profileName: state.profile?.name ?? "User",
        planName: state.rebalancingPlans.find(p => p.id === state.selectedPlanId)?.name ?? null,
        simulated: true,
      }),
    }).catch(() => {});
  };

  const handleRefreshPlaid = useCallback(async () => {
    if (!state.plaidAccessToken || !state.profile) return;
    setRefreshingPlaid(true);
    try {
      const res = await fetch("/api/plaid/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: state.plaidAccessToken }),
      });
      if (!res.ok) throw new Error("Failed to refresh Plaid data");
      const data = await res.json();
      const autofill = data.autofill;
      if (!autofill) return;

      const updatedProfile = { ...state.profile };
      if (typeof autofill.cashBuffer === "number") updatedProfile.cashBuffer = autofill.cashBuffer;
      if (autofill.fixedExpenses?.length) updatedProfile.fixedExpenses = autofill.fixedExpenses as Expense[];
      if (autofill.variableExpenses?.length) updatedProfile.variableExpenses = autofill.variableExpenses as Expense[];
      const holdingsTotal = (autofill.investmentHoldings ?? []).reduce(
        (s: number, h: { value: number }) => s + h.value, 0
      );
      if (holdingsTotal > 0) {
        updatedProfile.investments = { ...updatedProfile.investments, totalValue: holdingsTotal };
      }

      dispatch({ type: "SET_PROFILE", profile: updatedProfile });

      if (state.selectedPlanId) {
        const updatedState: AppState = { ...state, profile: updatedProfile };
        const notifications = runAgentChecks(updatedState);
        for (const n of notifications) {
          dispatch({ type: "ADD_NOTIFICATION", notification: n });
        }
        if (notifications.length > 0) {
          showToasts(notifications);
          // Push alerts to n8n webhook (non-blocking)
          fetch("/api/n8n/trigger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              totalAlerts: notifications.length,
              alerts: notifications.map(n => ({
                check: n.type,
                alert: true,
                severity: n.severity,
                title: n.title,
                message: n.message,
              })),
              profileName: updatedProfile.name,
              planName: state.rebalancingPlans.find(p => p.id === state.selectedPlanId)?.name ?? null,
            }),
          }).catch(() => {});
        }
      }
    } catch (error) {
      console.error("Plaid refresh failed:", error);
    } finally {
      setRefreshingPlaid(false);
    }
  }, [state, dispatch, showToasts]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">PF</span>
            </div>
            <span className="font-semibold text-lg hidden sm:block">Sentra</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="relative"
              onClick={() => setChatOpen(o => !o)}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">AI Assistant</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <main className={`flex-1 transition-all ${chatOpen ? "mr-96" : ""}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">
                Welcome back{state.profile?.name ? `, ${state.profile.name}` : ""}
              </h1>
              <p className="text-muted-foreground">Your financial risk dashboard</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="flex-wrap">
                <TabsTrigger value="overview">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="risk">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Risk Events
                </TabsTrigger>
                <TabsTrigger value="rebalancing">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Rebalancing
                </TabsTrigger>
                <TabsTrigger value="notifications">
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                  {unreadNotifications > 0 && (
                    <Badge variant="destructive" className="ml-2 text-xs px-1.5 py-0">
                      {unreadNotifications}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Ping & Settings
                </TabsTrigger>
                <TabsTrigger value="account">
                  <UserCircle2 className="w-4 h-4 mr-2" />
                  Account
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <FinancialSnapshot />
                <div className="grid lg:grid-cols-2 gap-6">
                  <AllocationEditor />
                  <SavingsGoalCard />
                </div>
                {state.plaidAccessToken && (
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <RefreshCw className={`w-5 h-5 text-blue-600 ${refreshingPlaid ? "animate-spin" : ""}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900">Refresh from Plaid</p>
                      <p className="text-xs text-blue-700">
                        Pull latest balances and transactions from your connected accounts.
                        {state.selectedPlanId && " If thresholds are crossed, you'll get a ping."}
                      </p>
                    </div>
                    <Button
                      onClick={handleRefreshPlaid}
                      variant="outline"
                      disabled={refreshingPlaid}
                      className="border-blue-300 text-blue-800 hover:bg-blue-100"
                    >
                      {refreshingPlaid ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      {refreshingPlaid ? "Refreshing..." : "Refresh"}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="risk">
                <RiskEventPanel onSimulationComplete={() => setActiveTab("rebalancing")} />
              </TabsContent>

              <TabsContent value="rebalancing">
                <RebalancingPanel />
              </TabsContent>

              <TabsContent value="notifications" className="space-y-6">
                {state.selectedPlanId && (
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900">Demo: Simulate Expense Spike</p>
                      <p className="text-xs text-amber-700">
                        Temporarily inflates your variable spending by ~35-50% to test notification rules and AI alerts. Does not persist fake data.
                      </p>
                    </div>
                    <Button
                      onClick={handleSimulateSpike}
                      variant="outline"
                      className="border-amber-300 text-amber-800 hover:bg-amber-100"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Simulate Spike
                    </Button>
                  </div>
                )}
                <NotificationCenter />
              </TabsContent>

              <TabsContent value="settings">
                <NotificationSettingsCard />
              </TabsContent>

              <TabsContent value="account">
                <AccountPage />
              </TabsContent>
            </Tabs>
          </div>
        </main>

        {chatOpen && (
          <ChatSidebar onClose={() => setChatOpen(false)} />
        )}
      </div>
    </div>
  );
}
