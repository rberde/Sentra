"use client";

import { useState, useCallback } from "react";
import { useApp } from "@/contexts/app-context";
import type { AllocationBuckets } from "@/lib/types";
import { suggestAllocation } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Pencil, Check, X, Sparkles } from "lucide-react";

const BUCKET_LABELS: { key: keyof AllocationBuckets; label: string; color: string }[] = [
  { key: "fixedExpenses", label: "Fixed Expenses", color: "bg-rose-400" },
  { key: "variableExpenses", label: "Variable Expenses", color: "bg-blue-400" },
  { key: "investments", label: "Investments or Savings", color: "bg-green-400" },
  { key: "savingsGoal", label: "Savings Goal", color: "bg-purple-400" },
  { key: "cashBuffer", label: "Cash", color: "bg-amber-400" },
];

export function AllocationEditor() {
  const { state, dispatch } = useApp();
  const profile = state.profile;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AllocationBuckets | null>(null);

  if (!profile) return null;

  const hasSavingsGoal = profile.savingsGoal !== null;
  const buckets = BUCKET_LABELS.filter(b => hasSavingsGoal || b.key !== "savingsGoal");
  const allocation = editing && draft ? draft : profile.allocation;
  const total = Object.values(allocation).reduce((s, v) => s + v, 0);

  const startEditing = () => {
    setDraft({ ...profile.allocation });
    setEditing(true);
  };

  const save = () => {
    if (!draft) return;
    dispatch({
      type: "SET_PROFILE",
      profile: { ...profile, allocation: draft },
    });
    setEditing(false);
    setDraft(null);
  };

  const resetToAi = () => {
    const totalFixed = profile.fixedExpenses.reduce((s, e) => s + e.amount, 0);
    const suggested = suggestAllocation(profile.monthlyIncome, totalFixed, profile.goalWeights, hasSavingsGoal);
    setDraft(suggested);
  };

  const updateBucket = useCallback((key: keyof AllocationBuckets, newValue: number) => {
    if (!draft) return;
    const clamped = Math.max(0, Math.min(100, newValue));
    const oldValue = draft[key];
    const delta = clamped - oldValue;
    if (delta === 0) return;

    const activeBucketKeys = buckets.map(b => b.key);
    const otherKeys = activeBucketKeys.filter(k => k !== key);
    const otherTotal = otherKeys.reduce((s, k) => s + (draft[k] ?? 0), 0);
    const newDraft = { ...draft, [key]: clamped };

    if (otherTotal > 0) {
      let remaining = -delta;
      const adjustments: Record<string, number> = {};

      for (const k of otherKeys) {
        const proportion = (draft[k] ?? 0) / otherTotal;
        adjustments[k] = Math.round(remaining * proportion);
      }

      // Apply adjustments, floor at 0
      for (const k of otherKeys) {
        newDraft[k] = Math.max(0, (draft[k] ?? 0) + (adjustments[k] ?? 0));
      }

      // Fix any rounding error — adjust the largest other bucket
      const currentTotal = activeBucketKeys.reduce((s, k) => s + newDraft[k], 0);
      const roundingError = 100 - currentTotal;
      if (roundingError !== 0) {
        const largest = otherKeys.reduce((a, b) => (newDraft[a] >= newDraft[b] ? a : b));
        newDraft[largest] = Math.max(0, newDraft[largest] + roundingError);
      }
    } else if (clamped < 100) {
      // All others are 0 — distribute remainder to cash
      newDraft.cashBuffer = 100 - clamped;
    }

    setDraft(newDraft);
  }, [draft, buckets]);

  // Normalize bar widths so they never visually exceed 100%
  const barTotal = buckets.reduce((s, b) => s + allocation[b.key], 0);
  const barScale = barTotal > 0 ? Math.min(1, 100 / barTotal) : 0;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Income Allocation</CardTitle>
        {!editing ? (
          <Button size="sm" variant="ghost" onClick={startEditing}>
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={resetToAi} className="text-xs">
              <Sparkles className="w-3 h-3 mr-1" /> AI Suggest
            </Button>
            <Button size="sm" variant="ghost" onClick={save} disabled={total !== 100}>
              <Check className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(null); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Visual bar — widths normalized to never exceed container */}
        <div className="h-4 rounded-full overflow-hidden flex bg-muted/30">
          {buckets.map(b => {
            const pct = allocation[b.key] * barScale;
            if (pct === 0) return null;
            return (
              <div
                key={b.key}
                className={`${b.color} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${b.label}: ${allocation[b.key]}%`}
              />
            );
          })}
        </div>

        {/* Sliders or read-only values */}
        <div className="space-y-2">
          {buckets.map(b => (
            <div key={b.key}>
              {editing ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label className="text-xs">{b.label}</Label>
                    <span className="font-semibold">{draft?.[b.key] ?? 0}%</span>
                  </div>
                  <Slider
                    value={[draft?.[b.key] ?? 0]}
                    onValueChange={([v]) => updateBucket(b.key, v)}
                    max={100} min={0} step={1}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-sm ${b.color}`} />
                    <span>{b.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{allocation[b.key]}%</span>
                    <span className="text-muted-foreground text-xs">
                      ${Math.round((allocation[b.key] / 100) * profile.monthlyIncome).toLocaleString()}/mo
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {editing && (
          <p className={`text-xs text-center ${total === 100 ? "text-green-600" : "text-red-500"}`}>
            Total: {total}%{total !== 100 && " — must be 100% to save"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
