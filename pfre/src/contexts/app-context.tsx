"use client";

import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from "react";
import type {
  UserProfile,
  RiskEvent,
  StressResult,
  RebalancingPlan,
  Notification,
  PlanType,
  PlaidAccount,
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

  useEffect(() => {
    saveState(state);
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
