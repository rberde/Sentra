"use client";

import { useState } from "react";
import { useApp } from "@/contexts/app-context";
import type { SavingsGoal } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";
import { Target, Plus, Pencil, Check, X, Link as LinkIcon } from "lucide-react";

export function SavingsGoalCard() {
  const { state, dispatch } = useApp();
  const profile = state.profile;
  const [editing, setEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<SavingsGoal>({
    name: "",
    targetAmount: 0,
    targetDate: "",
    currentBalance: 0,
    monthlyContribution: 0,
  });

  if (!profile) return null;

  const hasPlaid = state.plaidAccounts.length > 0;
  const goal = profile.savingsGoal;

  const startEditing = () => {
    if (!goal) return;
    setDraft({ ...goal });
    setEditing(true);
  };

  const startAdding = () => {
    setDraft({
      name: "",
      targetAmount: 0,
      targetDate: "",
      currentBalance: 0,
      monthlyContribution: 0,
    });
    setShowAdd(true);
  };

  const save = () => {
    dispatch({
      type: "SET_PROFILE",
      profile: { ...profile, savingsGoal: { ...draft } },
    });
    setEditing(false);
    setShowAdd(false);
  };

  const remove = () => {
    dispatch({
      type: "SET_PROFILE",
      profile: { ...profile, savingsGoal: null },
    });
    setEditing(false);
  };

  const toggleLinkedAccount = (accountId: string) => {
    const current = draft.linkedAccountIds ?? [];
    const updated = current.includes(accountId)
      ? current.filter(id => id !== accountId)
      : [...current, accountId];
    setDraft({ ...draft, linkedAccountIds: updated });
  };

  const progressPct = goal && goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentBalance / goal.targetAmount) * 100))
    : 0;

  if (!goal && !showAdd) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-8 text-center">
          <Target className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No savings goal set yet.</p>
          <div className="mb-3 flex justify-center">
            <PlaidLinkButton />
          </div>
          <Button size="sm" variant="outline" onClick={startAdding}>
            <Plus className="w-3 h-3 mr-1" /> Add a Savings Goal
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (editing || showAdd) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">{editing ? "Edit" : "Add"} Savings Goal</CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={save}><Check className="w-3 h-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setShowAdd(false); }}><X className="w-3 h-3" /></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Goal Name</Label>
            <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Target ($)</Label>
              <Input type="number" value={draft.targetAmount || ""} onChange={e => setDraft({ ...draft, targetAmount: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Target Date</Label>
              <Input type="date" value={draft.targetDate} onChange={e => setDraft({ ...draft, targetDate: e.target.value })} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Current Balance ($)</Label>
              <Input type="number" value={draft.currentBalance || ""} onChange={e => setDraft({ ...draft, currentBalance: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Monthly Contribution ($)</Label>
              <Input type="number" value={draft.monthlyContribution || ""} onChange={e => setDraft({ ...draft, monthlyContribution: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
            </div>
          </div>

          {/* Plaid account linking */}
          {hasPlaid && (
            <div>
              <Label className="text-xs flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Pull balance from connected accounts</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {state.plaidAccounts.map(account => {
                  const linked = (draft.linkedAccountIds ?? []).includes(account.accountId);
                  return (
                    <Badge
                      key={account.accountId}
                      variant={linked ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleLinkedAccount(account.accountId)}
                    >
                      {account.name} (${account.balance.toLocaleString()})
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {editing && (
            <Button size="sm" variant="destructive" className="w-full" onClick={remove}>
              Remove Savings Goal
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-500" />
          {goal!.name}
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={startEditing}>
          <Pencil className="w-3 h-3" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>${goal!.currentBalance.toLocaleString()}</span>
            <span>${goal!.targetAmount.toLocaleString()}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-center">{progressPct}% complete</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Monthly Contribution</div>
            <div className="font-semibold">${goal!.monthlyContribution.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Target Date</div>
            <div className="font-semibold">{goal!.targetDate || "—"}</div>
          </div>
        </div>
        {!hasPlaid && (
          <div className="pt-1">
            <PlaidLinkButton />
          </div>
        )}
        {goal!.linkedAccountIds && goal!.linkedAccountIds.length > 0 && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <LinkIcon className="w-3 h-3" /> Linked to {goal!.linkedAccountIds.length} account(s)
          </div>
        )}
      </CardContent>
    </Card>
  );
}
