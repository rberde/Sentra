"use client";

import { useState } from "react";
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
  { key: "investments", label: "Investments", color: "bg-green-400" },
  { key: "savingsGoal", label: "Savings Goal", color: "bg-purple-400" },
  { key: "cashBuffer", label: "Cash Buffer", color: "bg-amber-400" },
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

  const updateBucket = (key: keyof AllocationBuckets, value: number) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
  };

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
            <Button size="sm" variant="ghost" onClick={save}>
              <Check className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(null); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Visual bar */}
        <div className="h-4 rounded-full overflow-hidden flex">
          {buckets.map(b => {
            const pct = allocation[b.key];
            if (pct === 0) return null;
            return (
              <div
                key={b.key}
                className={`${b.color} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${b.label}: ${pct}%`}
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

        {editing && total !== 100 && (
          <p className="text-xs text-red-500 text-center">
            Total is {total}% — should be 100%.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
