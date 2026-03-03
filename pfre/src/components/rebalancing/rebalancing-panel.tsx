"use client";

import { useState } from "react";
import { useApp } from "@/contexts/app-context";
import type { RebalancingPlan } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Target,
  Check,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Bot,
  Bell,
} from "lucide-react";

const PLAN_META: Record<string, { icon: typeof ShoppingBag; color: string }> = {
  maximize_lifestyle: { icon: ShoppingBag, color: "bg-blue-50 border-blue-200" },
  maximize_investments: { icon: TrendingUp, color: "bg-green-50 border-green-200" },
  maximize_savings_goal: { icon: Target, color: "bg-purple-50 border-purple-200" },
};

interface CurrentBuckets {
  fixedExpenses: number;
  variableExpenses: number;
  investments: number;
  savingsGoal: number;
  cashBuffer: number;
}

function BucketDelta({ label, current, planned }: { label: string; current: number; planned: number }) {
  const diff = planned - current;
  const isUp = diff > 0;
  const isDown = diff < 0;
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">${current.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">→</span>
        <span className={`font-semibold ${isDown ? "text-red-600" : isUp ? "text-green-600" : ""}`}>
          ${planned.toLocaleString()}
        </span>
        {diff !== 0 && (
          <span className={`text-xs ${isDown ? "text-red-500" : "text-green-500"}`}>
            ({isDown ? "" : "+"}{diff > 0 ? `$${diff.toLocaleString()}` : `-$${Math.abs(diff).toLocaleString()}`})
          </span>
        )}
      </div>
    </div>
  );
}

function PlanCard({ plan, isSelected, onSelect, currentBuckets }: { plan: RebalancingPlan; isSelected: boolean; onSelect: () => void; currentBuckets: CurrentBuckets }) {
  const [expanded, setExpanded] = useState(false);
  const meta = PLAN_META[plan.type] ?? { icon: Sparkles, color: "bg-gray-50 border-gray-200" };
  const Icon = meta.icon;

  return (
    <Card className={`border-0 shadow-sm transition-all hover:shadow-md ${isSelected ? "ring-2 ring-primary" : ""} ${plan.isRecommended ? "ring-2 ring-amber-400" : ""} ${meta.color}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <Icon className="w-4 h-4" />
            </div>
            <CardTitle className="text-base">{plan.name}</CardTitle>
          </div>
          <div className="flex gap-1">
            {plan.isRecommended && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                <Sparkles className="w-3 h-3 mr-1" /> Recommended
              </Badge>
            )}
            {isSelected && (
              <Badge className="bg-primary text-primary-foreground">
                <Check className="w-3 h-3 mr-1" /> Selected
              </Badge>
            )}
          </div>
        </div>
        {plan.recommendationReason && (
          <p className="text-xs text-amber-700 mt-1 italic">{plan.recommendationReason}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{plan.tradeoffSummary}</p>

        {/* Impact summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/80 rounded-lg p-2">
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Resolve In
            </div>
            <div className="font-bold">{plan.timelineToResolve}mo</div>
          </div>
          <div className="bg-white/80 rounded-lg p-2">
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Lifestyle Cut
            </div>
            <div className="font-bold">{plan.goalImpact.lifestyleReduction}%</div>
          </div>
          <div className="bg-white/80 rounded-lg p-2">
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Target className="w-3 h-3" /> Goal Delay
            </div>
            <div className="font-bold">{plan.goalImpact.savingsGoalDelay}mo</div>
          </div>
        </div>

        {/* Expandable details */}
        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
          {expanded ? "Hide details" : "Show budget breakdown & projections"}
        </Button>

        {expanded && (
          <>
            <div className="bg-white/80 rounded-lg p-3 space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                Budget Adjustments <span className="font-normal">(Current → Plan)</span>
              </div>
              <BucketDelta label="Fixed Expenses" current={currentBuckets.fixedExpenses} planned={plan.monthlyReallocation.fixedExpenses} />
              <BucketDelta label="Variable" current={currentBuckets.variableExpenses} planned={plan.monthlyReallocation.variableExpenses} />
              <BucketDelta label="Investments" current={currentBuckets.investments} planned={plan.monthlyReallocation.investments} />
              <BucketDelta label="Savings Goal" current={currentBuckets.savingsGoal} planned={plan.monthlyReallocation.savingsGoal} />
              <BucketDelta label="Cash Buffer" current={currentBuckets.cashBuffer} planned={plan.monthlyReallocation.cashBuffer} />
            </div>

            <div className="bg-white/80 rounded-lg p-3 space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase">Projected Net Position</div>
              <div className="grid grid-cols-3 gap-2 text-sm text-center">
                <div>
                  <div className="text-xs text-muted-foreground">6 months</div>
                  <div className="font-bold">${plan.projections.month6.netPosition.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">12 months</div>
                  <div className="font-bold">${plan.projections.month12.netPosition.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">24 months</div>
                  <div className="font-bold">${plan.projections.month24.netPosition.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {!isSelected && (
          <Button className="w-full" onClick={onSelect}>
            <Sparkles className="w-4 h-4 mr-2" />
            Select This Plan
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function RebalancingPanel() {
  const { state, dispatch } = useApp();
  const hasPlaid = state.plaidAccounts.length > 0;
  const [showMetricHelp, setShowMetricHelp] = useState(false);

  if (!state.stressResult || state.rebalancingPlans.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center">
          <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            Declare a risk event first to see rebalancing options.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedPlan = state.rebalancingPlans.find(p => p.id === state.selectedPlanId);

  const currentBuckets: CurrentBuckets = {
    fixedExpenses: state.profile?.fixedExpenses.reduce((s, e) => s + e.amount, 0) ?? 0,
    variableExpenses: state.profile?.variableExpenses.reduce((s, e) => s + e.amount, 0) ?? 0,
    investments: state.profile?.investments.monthlyContribution ?? 0,
    savingsGoal: state.profile?.savingsGoal?.monthlyContribution ?? 0,
    cashBuffer: 0,
  };

  const handleSelect = (plan: RebalancingPlan) => {
    dispatch({ type: "SELECT_PLAN", planId: plan.id });
    dispatch({ type: "RECORD_PLAN_SELECTION", planType: plan.type });

    dispatch({
      type: "ADD_NOTIFICATION",
      notification: {
        id: crypto.randomUUID(),
        type: "scheduled_checkin",
        title: "Plan Activated",
        message: `You've selected the "${plan.name}" plan. Your variable spending budget is now $${plan.monthlyReallocation.variableExpenses.toLocaleString()}/month. We'll check in with you in 30 days.`,
        severity: "info",
        isDismissed: false,
        createdAt: new Date().toISOString(),
      },
    });

    if (plan.monthlyReallocation.investments < (state.profile?.investments.monthlyContribution ?? 0)) {
      dispatch({
        type: "ADD_NOTIFICATION",
        notification: {
          id: crypto.randomUUID(),
          type: "spending_limit",
          title: "Investment Contribution Adjusted",
          message: `Your investment contributions have been reduced from $${state.profile?.investments.monthlyContribution.toLocaleString()}/mo to $${plan.monthlyReallocation.investments.toLocaleString()}/mo under this plan.`,
          severity: "warning",
          isDismissed: false,
          createdAt: new Date().toISOString(),
        },
      });
    }

    // Auto-generate AI-driven notification rules based on the plan
    const totalFixed = state.profile?.fixedExpenses.reduce((s, e) => s + e.amount, 0) ?? 0;
    const cashMonths = totalFixed > 0 ? Math.floor((state.profile?.cashBuffer ?? 0) / totalFixed) : 3;
    const aiRules = [
      {
        id: `ai_spending_${Date.now()}`,
        type: "spending_cap" as const,
        label: `Variable spending over $${plan.monthlyReallocation.variableExpenses.toLocaleString()}/mo`,
        description: `Alert if your variable spending exceeds the ${plan.name} plan budget of $${plan.monthlyReallocation.variableExpenses.toLocaleString()}/month.`,
        enabled: true,
        threshold: plan.monthlyReallocation.variableExpenses,
        aiGenerated: true,
      },
      {
        id: `ai_liquidity_${Date.now()}`,
        type: "liquidity_floor" as const,
        label: `Cash drops below ${Math.max(1, cashMonths - 1)} months of expenses`,
        description: `Alert when your cash can cover fewer than ${Math.max(1, cashMonths - 1)} months of fixed expenses ($${totalFixed.toLocaleString()}/mo).`,
        enabled: true,
        threshold: Math.max(1, cashMonths - 1),
        aiGenerated: true,
      },
      {
        id: `ai_risk_score_${Date.now()}`,
        type: "risk_score_alert" as const,
        label: `Risk score crosses ${state.stressResult ? Math.min(90, state.stressResult.riskScoreAfter + 10) : 70}`,
        description: "Alert when your risk score rises further above the current level.",
        enabled: true,
        threshold: state.stressResult ? Math.min(90, state.stressResult.riskScoreAfter + 10) : 70,
        aiGenerated: true,
      },
      {
        id: `ai_checkin_${Date.now()}`,
        type: "scheduled_checkin" as const,
        label: "Bi-weekly plan progress check-in",
        description: `The AI agent will review your spending vs. the ${plan.name} plan every 14 days.`,
        enabled: true,
        intervalDays: 14,
        aiGenerated: true,
      },
    ];

    // Replace existing AI rules with new plan-specific ones
    const existingNonAi = state.notificationSettings.rules.filter(r => !r.aiGenerated);
    dispatch({
      type: "SET_NOTIFICATION_SETTINGS",
      settings: { ...state.notificationSettings, rules: [...existingNonAi, ...aiRules] },
    });
  };

  return (
    <div className="space-y-4">
      {/* Stress context (condensed) */}
      <Card className="border-0 shadow-sm bg-slate-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm gap-3 flex-wrap">
            <span>Liquidity runway: <strong>{state.stressResult.liquidityRunway} months</strong></span>
            <span>Risk score: <strong>{state.stressResult.riskScoreBefore} → {state.stressResult.riskScoreAfter}</strong></span>
            <span>Monthly deficit: <strong>${Math.max(0, state.stressResult.adjustedMonthlyBurn - state.stressResult.adjustedIncome).toLocaleString()}</strong></span>
            {state.stressResult.adjustedIncome < (state.profile?.monthlyIncome ?? 0) && (
              <span className="text-amber-700">Income reduced to <strong>${state.stressResult.adjustedIncome.toLocaleString()}/mo</strong></span>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowMetricHelp(v => !v)}>
              {showMetricHelp ? "Hide definitions" : "What do these mean?"}
            </Button>
          </div>
          {state.stressResult.crisisDurationMonths > 0 && state.riskEvents.some(e => e.duration === -1) && (
            <p className="text-xs text-amber-600 mt-2">
              Duration unknown — planning for a {state.stressResult.crisisDurationMonths}-month horizon. You can edit the duration on the Risk Events tab and re-simulate.
            </p>
          )}
          {showMetricHelp && (
            <div className="mt-3 grid md:grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div className="bg-white rounded-md p-2">
                <div className="font-semibold text-foreground">Liquidity runway</div>
                <div>How long your available cash can cover shortfalls.</div>
                <div>Guide: {"<3"} months high risk, 3-6 moderate, {">6"} healthier.</div>
              </div>
              <div className="bg-white rounded-md p-2">
                <div className="font-semibold text-foreground">Risk score</div>
                <div>0-100 composite risk indicator (lower is better).</div>
                <div>Guide: 0-30 low, 31-60 medium, 61-100 high risk.</div>
              </div>
              <div className="bg-white rounded-md p-2">
                <div className="font-semibold text-foreground">Monthly deficit</div>
                <div>Estimated monthly gap between post-shock spending and income.</div>
                <div>A higher value means more aggressive reallocation may be needed.</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">
          {state.rebalancingPlans.length} Rebalancing Options
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Based on your risk scenario and goal weights, the AI recommends the highlighted plan.
        You can select any option that fits your situation.
      </p>

      <div className="grid lg:grid-cols-3 gap-4">
        {state.rebalancingPlans.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isSelected={state.selectedPlanId === plan.id}
            onSelect={() => handleSelect(plan)}
            currentBuckets={currentBuckets}
          />
        ))}
      </div>

      {/* Post-selection agent message */}
      {selectedPlan && (
        <Card className="border-0 shadow-sm bg-primary/5 border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Plan activated: {selectedPlan.name}</p>
                {hasPlaid ? (
                  <p className="text-sm text-muted-foreground">
                    I&apos;ll monitor your connected accounts and notify you if your spending in any category exceeds the plan budget of ${selectedPlan.monthlyReallocation.variableExpenses.toLocaleString()}/month. I&apos;ll also alert you if your cash buffer drops below a safe threshold.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    I&apos;ll send you notifications based on your plan. Your variable spending budget is ${selectedPlan.monthlyReallocation.variableExpenses.toLocaleString()}/month. Check in via the chat to update your spending and I&apos;ll let you know if you&apos;re on track.
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Bell className="w-3 h-3" />
                  <span>Notifications active: spending alerts, liquidity warnings, 30-day check-ins</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
