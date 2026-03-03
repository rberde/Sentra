"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/contexts/app-context";
import { calculateBaselineRisk, simulateRiskBucket } from "@/lib/engine/risk-engine";
import { generateRebalancingPlans } from "@/lib/engine/rebalancer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCcw, MessageCircleMore } from "lucide-react";

export function AccountPage() {
  const { state, dispatch } = useApp();
  const [lastRecalcAt, setLastRecalcAt] = useState<string | null>(null);
  const profile = state.profile;

  const baselineRisk = useMemo(() => {
    if (!profile) return null;
    return calculateBaselineRisk(profile);
  }, [profile]);

  const recalculate = () => {
    if (!profile) return;
    // Re-run stress/plans if events exist.
    if (state.riskEvents.length > 0) {
      const stress = simulateRiskBucket(profile, { events: state.riskEvents });
      dispatch({ type: "SET_STRESS_RESULT", result: stress });
      dispatch({ type: "SET_REBALANCING_PLANS", plans: generateRebalancingPlans(profile, stress) });
    }
    dispatch({
      type: "SET_PROFILE",
      profile: { ...profile },
    });
    setLastRecalcAt(new Date().toLocaleString());
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Account & Recalculation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Baseline risk score</span>
            <strong>{baselineRisk ?? "—"}</strong>
          </div>
          {lastRecalcAt && (
            <div className="text-xs text-muted-foreground">
              Last recalculated: {lastRecalcAt}
            </div>
          )}
          <Button onClick={recalculate} className="gap-2">
            <RefreshCcw className="w-4 h-4" />
            Recalculate profile & scores
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageCircleMore className="w-4 h-4" />
            Your AI Questions & Answers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[420px] overflow-auto">
          {state.chatHistory.length === 0 && (
            <p className="text-sm text-muted-foreground">No Q&A yet. Ask the AI assistant and your history will appear here.</p>
          )}
          {state.chatHistory.map(m => (
            <div
              key={m.id}
              className={`rounded-md p-2 text-sm ${
                m.role === "user" ? "bg-primary/10" : "bg-muted"
              }`}
            >
              <div className="text-xs text-muted-foreground mb-1">
                {m.role === "user" ? "You" : "AI Advisor"}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
