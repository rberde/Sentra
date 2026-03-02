"use client";

import { useState } from "react";
import { useApp } from "@/contexts/app-context";
import { FinancialSnapshot } from "./financial-snapshot";
import { AllocationEditor } from "./allocation-editor";
import { SavingsGoalCard } from "./savings-goal-card";
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
} from "lucide-react";

export function DashboardLayout() {
  const { state, dispatch } = useApp();
  const [chatOpen, setChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const unreadNotifications = state.notifications.filter(n => !n.isDismissed).length;

  const handleReset = () => {
    if (confirm("Reset all data? This will clear your profile and start over.")) {
      dispatch({ type: "RESET_STATE" });
    }
  };

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
              <TabsList>
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
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <FinancialSnapshot />
                <div className="grid lg:grid-cols-2 gap-6">
                  <AllocationEditor />
                  <SavingsGoalCard />
                </div>
              </TabsContent>

              <TabsContent value="risk">
                <RiskEventPanel onSimulationComplete={() => setActiveTab("rebalancing")} />
              </TabsContent>

              <TabsContent value="rebalancing">
                <RebalancingPanel />
              </TabsContent>

              <TabsContent value="notifications">
                <NotificationCenter />
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
