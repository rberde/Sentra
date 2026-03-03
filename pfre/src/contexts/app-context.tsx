"use client";

import React, { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from "react";
import type {
  UserProfile,
  RiskEvent,
  StressResult,
  RebalancingPlan,
  Notification,
  PlanType,
  PlaidAccount,
  NotificationSettings,
  ChatMessage,
} from "@/lib/types";
import { type AppState, loadState, saveState } from "@/lib/store";

type Action =
  | { type: "SET_PROFILE"; profile: UserProfile }
  | { type: "SET_ONBOARDING_COMPLETE"; complete: boolean }
  | { type: "ADD_RISK_EVENT"; event: RiskEvent }
  | { type: "UPDATE_RISK_EVENT"; event: RiskEvent }
  | { type: "REMOVE_RISK_EVENT"; eventId: string }
  | { type: "CLEAR_RISK_EVENTS" }
  | { type: "SET_STRESS_RESULT"; result: StressResult | null }
  | { type: "SET_REBALANCING_PLANS"; plans: RebalancingPlan[] }
  | { type: "SELECT_PLAN"; planId: string }
  | { type: "ADD_NOTIFICATION"; notification: Notification }
  | { type: "DISMISS_NOTIFICATION"; notificationId: string }
  | { type: "RECORD_PLAN_SELECTION"; planType: PlanType }
  | { type: "INCREMENT_OVERRIDE" }
  | { type: "SET_PLAID_ACCOUNTS"; accounts: PlaidAccount[]; accessToken: string }
  | { type: "SET_CHAT_HISTORY"; history: ChatMessage[] }
  | { type: "SET_NOTIFICATION_SETTINGS"; settings: NotificationSettings }
  | { type: "RESET_STATE" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_PROFILE":
      return { ...state, profile: { ...action.profile, updatedAt: new Date().toISOString() } };
    case "SET_ONBOARDING_COMPLETE":
      return { ...state, onboardingComplete: action.complete };
    case "ADD_RISK_EVENT":
      return { ...state, riskEvents: [...state.riskEvents, action.event] };
    case "UPDATE_RISK_EVENT":
      return { ...state, riskEvents: state.riskEvents.map(e => e.id === action.event.id ? action.event : e) };
    case "REMOVE_RISK_EVENT":
      return { ...state, riskEvents: state.riskEvents.filter(e => e.id !== action.eventId) };
    case "CLEAR_RISK_EVENTS":
      return { ...state, riskEvents: [], stressResult: null, rebalancingPlans: [], selectedPlanId: null };
    case "SET_STRESS_RESULT":
      return { ...state, stressResult: action.result };
    case "SET_REBALANCING_PLANS":
      return { ...state, rebalancingPlans: action.plans };
    case "SELECT_PLAN":
      return { ...state, selectedPlanId: action.planId };
    case "ADD_NOTIFICATION":
      return { ...state, notifications: [action.notification, ...state.notifications] };
    case "DISMISS_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.notificationId ? { ...n, isDismissed: true } : n
        ),
      };
    case "RECORD_PLAN_SELECTION":
      return {
        ...state,
        behavioralProfile: {
          ...state.behavioralProfile,
          planSelections: [
            ...state.behavioralProfile.planSelections,
            { planType: action.planType, date: new Date().toISOString() },
          ],
        },
      };
    case "INCREMENT_OVERRIDE":
      return {
        ...state,
        behavioralProfile: {
          ...state.behavioralProfile,
          overrideCount: state.behavioralProfile.overrideCount + 1,
        },
      };
    case "SET_PLAID_ACCOUNTS":
      return { ...state, plaidAccounts: action.accounts, plaidAccessToken: action.accessToken };
    case "SET_CHAT_HISTORY":
      return { ...state, chatHistory: action.history };
    case "SET_NOTIFICATION_SETTINGS":
      return { ...state, notificationSettings: action.settings };
    case "RESET_STATE":
      return {
        profile: null,
        riskEvents: [],
        stressResult: null,
        rebalancingPlans: [],
        selectedPlanId: null,
        notifications: [],
        behavioralProfile: { planSelections: [], overrideCount: 0 },
        onboardingComplete: false,
        plaidAccounts: [],
        plaidAccessToken: null,
        chatHistory: [],
        notificationSettings: {
          pingWindowStart: "09:00",
          pingWindowEnd: "20:00",
          frequency: "daily_digest",
          channels: {
            inApp: true,
            sms: false,
            push: false,
          },
          rules: [
            { id: "rule_spending_cap", type: "spending_cap", label: "Variable spending exceeds plan budget", description: "Alert when variable spending crosses the monthly limit set by your active plan.", enabled: true, threshold: 100, aiGenerated: false },
            { id: "rule_liquidity_floor", type: "liquidity_floor", label: "Cash drops below 2 months of expenses", description: "Alert when your cash balance can cover fewer than this many months of fixed expenses.", enabled: true, threshold: 2, aiGenerated: false },
            { id: "rule_risk_score", type: "risk_score_alert", label: "Risk score exceeds safe zone", description: "Alert when your composite risk score rises above this value (0–100, lower is better).", enabled: true, threshold: 60, aiGenerated: false },
            { id: "rule_drift", type: "drift_threshold", label: "Allocation drifts from plan by more than 10%", description: "Alert when any budget category drifts more than this percentage from your planned allocation.", enabled: true, threshold: 10, aiGenerated: false },
            { id: "rule_checkin", type: "scheduled_checkin", label: "Monthly progress check-in", description: "The AI agent sends a summary and nudge at this interval.", enabled: true, intervalDays: 30, aiGenerated: false },
          ],
        },
      };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, loadState);
  const syncTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Debounced server-side state sync for n8n monitoring
  useEffect(() => {
    if (!state.onboardingComplete) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const { chatHistory: _c, ...syncable } = state;
      fetch("/api/state/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...syncable, lastSyncedAt: new Date().toISOString() }),
      }).catch(() => {});
    }, 3000);
    return () => clearTimeout(syncTimer.current);
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
