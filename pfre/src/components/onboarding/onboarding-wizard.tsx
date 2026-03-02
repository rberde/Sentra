"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/contexts/app-context";
import { createDefaultProfile, suggestAllocation } from "@/lib/store";
import type { UserProfile, Expense, IncomeStream, PlaidAccount } from "@/lib/types";
import { PlaidLinkButton, type PlaidExchangePayload } from "@/components/plaid/plaid-link-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  DollarSign,
  Target,
  PiggyBank,
  TrendingUp,
  Shield,
  Sparkles,
  Link2,
  Pencil,
  Check,
  Loader2,
  Zap,
} from "lucide-react";

const ALL_CATEGORIES = ["housing", "transport", "food", "insurance", "loans", "subscriptions", "entertainment", "shopping", "other"] as const;

function createFallbackExpenseExamples(monthlyIncome: number): { fixed: Expense[]; variable: Expense[] } {
  const income = monthlyIncome > 0 ? monthlyIncome : 5000;
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

  return {
    fixed: [
      { name: "Rent / Mortgage", amount: clamp(income * 0.3, 900, 3500), category: "housing", type: "fixed" },
      { name: "Utilities", amount: clamp(income * 0.05, 120, 350), category: "housing", type: "fixed" },
      { name: "Insurance", amount: clamp(income * 0.04, 80, 260), category: "insurance", type: "fixed" },
      { name: "Phone + Internet", amount: clamp(income * 0.03, 70, 220), category: "subscriptions", type: "fixed" },
    ],
    variable: [
      { name: "Groceries", amount: clamp(income * 0.1, 300, 900), category: "food", type: "variable" },
      { name: "Transport", amount: clamp(income * 0.06, 150, 450), category: "transport", type: "variable" },
      { name: "Dining & Entertainment", amount: clamp(income * 0.06, 120, 500), category: "entertainment", type: "variable" },
      { name: "Shopping / Misc", amount: clamp(income * 0.05, 100, 450), category: "shopping", type: "variable" },
    ],
  };
}

const STEPS = [
  { title: "Welcome", icon: Shield },
  { title: "Connect Accounts", icon: Link2 },
  { title: "Income", icon: DollarSign },
  { title: "Expenses", icon: PiggyBank },
  { title: "Investments", icon: TrendingUp },
  { title: "Savings Goal", icon: Target },
  { title: "Goal Weights", icon: Sparkles },
  { title: "Review", icon: Shield },
];

function ExpenseRow({ expense, onUpdate, onRemove }: {
  expense: Expense;
  onUpdate: (updated: Expense) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(expense.name);
  const [editAmount, setEditAmount] = useState(String(expense.amount));
  const [editCategory, setEditCategory] = useState(expense.category);
  const [editType, setEditType] = useState(expense.type);

  const save = () => {
    onUpdate({
      ...expense,
      name: editName,
      amount: parseFloat(editAmount) || 0,
      category: editCategory,
      type: editType,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
        <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm" />
        <Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="h-8 w-24 text-sm" />
        <select
          className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={editCategory}
          onChange={e => setEditCategory(e.target.value as Expense["category"])}
        >
          {ALL_CATEGORIES.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <select
          className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={editType}
          onChange={e => setEditType(e.target.value as "fixed" | "variable")}
        >
          <option value="fixed">Fixed</option>
          <option value="variable">Variable</option>
        </select>
        <Button size="sm" variant="ghost" onClick={save}><Check className="w-3 h-3" /></Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="w-3 h-3" /></Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{expense.name}</span>
        <Badge variant="outline" className="text-xs">{expense.category}</Badge>
        <Badge variant="secondary" className="text-xs">{expense.type}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">${expense.amount.toLocaleString()}/mo</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditName(expense.name);
            setEditAmount(String(expense.amount));
            setEditCategory(expense.category);
            setEditType(expense.type);
            setEditing(true);
          }}
        >
          <Pencil className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export function OnboardingWizard() {
  const { state, dispatch } = useApp();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile>(createDefaultProfile());
  const [hasSavingsGoal, setHasSavingsGoal] = useState(false);
  const [plaidApplied, setPlaidApplied] = useState(false);
  const [refreshingPlaid, setRefreshingPlaid] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [plaidStatus, setPlaidStatus] = useState<string | null>(null);
  const [plaidSnapshot, setPlaidSnapshot] = useState<{ cashBuffer: number; investmentsTotalValue: number } | null>(null);
  const [autoRefreshTried, setAutoRefreshTried] = useState(false);

  const [newExpense, setNewExpense] = useState({ name: "", amount: "", category: "housing", type: "fixed" as "fixed" | "variable" });
  const [newIncomeStream, setNewIncomeStream] = useState({ name: "", amount: "", type: "fixed" as "fixed" | "variable" });

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  };

  const allExpenses = [...profile.fixedExpenses, ...profile.variableExpenses];
  const totalFixed = profile.fixedExpenses.reduce((s, e) => s + e.amount, 0);
  const totalVariable = profile.variableExpenses.reduce((s, e) => s + e.amount, 0);
  const totalExpenses = totalFixed + totalVariable;

  const addIncome = () => {
    if (!newIncomeStream.name || !newIncomeStream.amount) return;
    const stream: IncomeStream = {
      name: newIncomeStream.name,
      amount: parseFloat(newIncomeStream.amount),
      type: newIncomeStream.type,
    };
    updateProfile({
      incomeStreams: [...profile.incomeStreams, stream],
      monthlyIncome: profile.monthlyIncome + stream.amount,
    });
    setNewIncomeStream({ name: "", amount: "", type: "fixed" });
  };

  const removeIncome = (idx: number) => {
    const removed = profile.incomeStreams[idx];
    updateProfile({
      incomeStreams: profile.incomeStreams.filter((_, i) => i !== idx),
      monthlyIncome: profile.monthlyIncome - removed.amount,
    });
  };

  const addExpense = () => {
    if (!newExpense.name || !newExpense.amount) return;
    const expense: Expense = {
      name: newExpense.name,
      amount: parseFloat(newExpense.amount),
      category: newExpense.category as Expense["category"],
      type: newExpense.type,
    };
    if (expense.type === "fixed") {
      updateProfile({ fixedExpenses: [...profile.fixedExpenses, expense] });
    } else {
      updateProfile({ variableExpenses: [...profile.variableExpenses, expense] });
    }
    setNewExpense({ name: "", amount: "", category: "housing", type: "fixed" });
  };

  const updateExpense = (oldExpense: Expense, updated: Expense) => {
    if (oldExpense.type === "fixed") {
      const newFixed = profile.fixedExpenses.map(e => e === oldExpense ? updated : e);
      if (updated.type === "variable") {
        updateProfile({
          fixedExpenses: newFixed.filter(e => e !== updated),
          variableExpenses: [...profile.variableExpenses, updated],
        });
      } else {
        updateProfile({ fixedExpenses: newFixed });
      }
    } else {
      const newVar = profile.variableExpenses.map(e => e === oldExpense ? updated : e);
      if (updated.type === "fixed") {
        updateProfile({
          variableExpenses: newVar.filter(e => e !== updated),
          fixedExpenses: [...profile.fixedExpenses, updated],
        });
      } else {
        updateProfile({ variableExpenses: newVar });
      }
    }
  };

  const removeExpense = (expense: Expense) => {
    if (expense.type === "fixed") {
      updateProfile({ fixedExpenses: profile.fixedExpenses.filter(e => e !== expense) });
    } else {
      updateProfile({ variableExpenses: profile.variableExpenses.filter(e => e !== expense) });
    }
  };

  const handlePlaidAutofill = (payload: PlaidExchangePayload | {
    accounts?: PlaidAccount[];
    autofill?: PlaidExchangePayload["autofill"];
    autofillMeta?: PlaidExchangePayload["autofillMeta"];
    access_token?: string;
  }) => {
    const autofill = payload.autofill;
    if (!autofill) return;

    const fixedLen = autofill.fixedExpenses?.length ?? 0;
    const variableLen = autofill.variableExpenses?.length ?? 0;
    const shouldSeedExamples = fixedLen + variableLen === 0;
    const fallback = createFallbackExpenseExamples(profile.monthlyIncome);

    const holdingsTotal = (autofill.investmentHoldings ?? []).reduce((s, h) => s + h.value, 0);
    const investmentValue = holdingsTotal > 0
      ? holdingsTotal
      : (typeof autofill.investmentsTotalValue === "number" ? autofill.investmentsTotalValue : 0);

    const loanLiabilities = (autofill.liabilities ?? []).filter(l => l.type === "student_loan");
    const loanExpenses: Expense[] = loanLiabilities
      .filter(l => l.minimumPayment && l.minimumPayment > 0)
      .map(l => ({
        name: l.name,
        amount: l.minimumPayment!,
        category: "loans" as const,
        type: "fixed" as const,
      }));

    const savingsAccount = (payload.accounts ?? []).find(a => a.type === "savings");

    setProfile(prev => ({
      ...prev,
      cashBuffer: typeof autofill.cashBuffer === "number" ? autofill.cashBuffer : prev.cashBuffer,
      investments: {
        ...prev.investments,
        totalValue: investmentValue > 0 ? investmentValue : prev.investments.totalValue,
        monthlyContribution: prev.investments.monthlyContribution || 750,
      },
      fixedExpenses: prev.fixedExpenses.length === 0
        ? (shouldSeedExamples
            ? [...fallback.fixed, ...loanExpenses]
            : [...(autofill.fixedExpenses ?? prev.fixedExpenses), ...loanExpenses])
        : prev.fixedExpenses,
      variableExpenses: prev.variableExpenses.length === 0
        ? (shouldSeedExamples ? fallback.variable : (autofill.variableExpenses ?? prev.variableExpenses))
        : prev.variableExpenses,
      savingsGoal: prev.savingsGoal ?? (savingsAccount && savingsAccount.balance > 0
        ? {
            name: "House Down Payment",
            targetAmount: 100000,
            targetDate: "2028-12-31",
            currentBalance: savingsAccount.balance,
            monthlyContribution: 500,
            linkedAccountIds: [savingsAccount.accountId],
          }
        : prev.savingsGoal),
    }));

    if (savingsAccount && savingsAccount.balance > 0 && !hasSavingsGoal) {
      setHasSavingsGoal(true);
    }

    const accessToken = "access_token" in payload ? payload.access_token : state.plaidAccessToken;
    if (payload.accounts && accessToken) {
      dispatch({
        type: "SET_PLAID_ACCOUNTS",
        accounts: payload.accounts,
        accessToken,
      });
    }

    const parts: string[] = [];
    if (fixedLen + variableLen > 0) {
      parts.push(`${fixedLen} fixed and ${variableLen} variable expenses`);
    }
    if ((autofill.investmentHoldings?.length ?? 0) > 0) {
      parts.push(`${autofill.investmentHoldings!.length} investment holdings ($${investmentValue.toLocaleString()})`);
    }
    if ((autofill.liabilities?.length ?? 0) > 0) {
      parts.push(`${autofill.liabilities!.length} liabilities`);
    }
    if (parts.length > 0) {
      setPlaidStatus(`Imported from Plaid: ${parts.join(", ")}.`);
    } else {
      setPlaidStatus("Plaid balances imported. Added editable example expenses while transactions sync.");
    }

    setPlaidSnapshot({
      cashBuffer: typeof autofill.cashBuffer === "number" ? autofill.cashBuffer : profile.cashBuffer,
      investmentsTotalValue: investmentValue > 0 ? investmentValue : profile.investments.totalValue,
    });

    setPlaidApplied(true);
  };

  const refreshFromPlaid = async () => {
    if (!state.plaidAccessToken) return;
    setAutoRefreshTried(true);
    setRefreshingPlaid(true);
    try {
      const res = await fetch("/api/plaid/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: state.plaidAccessToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to refresh Plaid data");
      handlePlaidAutofill(data);
    } catch (error) {
      console.error("Refresh from Plaid failed:", error);
      setPlaidStatus("Unable to refresh from Plaid right now. Please try again in a moment.");
    } finally {
      setRefreshingPlaid(false);
    }
  };

  const loadDemoData = async () => {
    setLoadingDemo(true);
    setPlaidStatus("Creating Sandbox accounts with custom data...");
    try {
      const tokenRes = await fetch("/api/plaid/sandbox-token", { method: "POST" });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error ?? "Failed to create sandbox token");

      setPlaidStatus("Exchanging token and importing accounts...");
      const exchangeRes = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: tokenData.public_token }),
      });
      const data = await exchangeRes.json() as PlaidExchangePayload;
      if (!exchangeRes.ok) throw new Error("Failed to exchange token");

      handlePlaidAutofill(data);
    } catch (error) {
      console.error("Demo data load failed:", error);
      setPlaidStatus("Failed to load demo data. Check your Plaid Sandbox credentials.");
    } finally {
      setLoadingDemo(false);
    }
  };

  useEffect(() => {
    if (step !== 1) return;
    if (!state.plaidAccessToken) return;
    if (autoRefreshTried || refreshingPlaid) return;
    if (profile.fixedExpenses.length > 0 || profile.variableExpenses.length > 0) return;
    void refreshFromPlaid();
  }, [
    step,
    state.plaidAccessToken,
    autoRefreshTried,
    refreshingPlaid,
    profile.fixedExpenses.length,
    profile.variableExpenses.length,
  ]);

  const handleComplete = () => {
    const suggested = suggestAllocation(profile.monthlyIncome, totalFixed, profile.goalWeights, hasSavingsGoal);
    const finalProfile = { ...profile, allocation: suggested };
    if (!hasSavingsGoal) {
      finalProfile.savingsGoal = null;
    }
    dispatch({ type: "SET_PROFILE", profile: finalProfile });
    dispatch({ type: "SET_ONBOARDING_COMPLETE", complete: true });
  };

  const canProceed = () => {
    switch (step) {
      case 2: return profile.monthlyIncome > 0;
      case 3: return allExpenses.length > 0 || state.plaidAccounts.length > 0;
      case 4: return true;
      case 5: return !hasSavingsGoal || (profile.savingsGoal?.name ?? "").length > 0;
      case 6: return true;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`h-2 rounded-full transition-all ${
                i <= step ? "bg-primary w-8" : "bg-muted w-4"
              }`}
            />
          ))}
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">{STEPS[step].title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">

            {/* Step 0: Welcome */}
            {step === 0 && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                  <Shield className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Personal Financial Risk Engine</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Design your financial system. Let AI protect it when you&apos;re under pressure.
                  We&apos;ll walk you through setting up your financial profile in a few steps.
                </p>
                <div className="space-y-2">
                  <Label>Your Name</Label>
                  <Input
                    placeholder="Enter your name"
                    value={profile.name}
                    onChange={e => updateProfile({ name: e.target.value })}
                    className="max-w-xs mx-auto"
                  />
                </div>
              </div>
            )}

            {/* Step 1: Connect Accounts */}
            {step === 1 && (
              <div className="space-y-5">
                <CardDescription>
                  Optionally connect your accounts with Plaid first, or skip and continue with manual entry.
                </CardDescription>

                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                  <Label className="text-sm font-semibold">Quick Start: Load Demo Data</Label>
                  <p className="text-xs text-muted-foreground">
                    Instantly load a realistic financial profile with checking, savings, credit card,
                    investment holdings (VTI, VXUS, BND, AAPL, MSFT), and a student loan -- no manual login needed.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={loadDemoData}
                    disabled={loadingDemo || plaidApplied}
                    className="gap-2"
                  >
                    {loadingDemo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    {loadingDemo ? "Loading..." : "Load Demo Data"}
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or connect manually</span>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <Label className="text-sm">Connect with Plaid Link</Label>
                  <p className="text-xs text-muted-foreground">
                    Use Sandbox test accounts to auto-import balances. Login with <code className="bg-muted px-1 rounded">user_good</code> / <code className="bg-muted px-1 rounded">pass_good</code>.
                  </p>
                  <PlaidLinkButton onSuccess={handlePlaidAutofill} />
                </div>

                {plaidApplied && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                    <p className="text-sm font-medium text-green-800">Data imported successfully</p>
                    {plaidStatus && (
                      <p className="text-xs text-green-700">{plaidStatus}</p>
                    )}
                    {plaidSnapshot && (
                      <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                        <span>Cash/Checking+Savings: <strong>${plaidSnapshot.cashBuffer.toLocaleString()}</strong></span>
                        <span>Investment Portfolio: <strong>${plaidSnapshot.investmentsTotalValue.toLocaleString()}</strong></span>
                      </div>
                    )}
                    {state.plaidAccounts.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {state.plaidAccounts.map(a => (
                          <Badge key={a.accountId} variant="secondary" className="text-xs">
                            {a.name} (${a.balance.toLocaleString()})
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!plaidApplied && plaidStatus && (
                  <p className="text-xs text-muted-foreground">{plaidStatus}</p>
                )}

                {state.plaidAccounts.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={refreshFromPlaid}
                    disabled={refreshingPlaid}
                    className="gap-2"
                  >
                    {refreshingPlaid && <Loader2 className="w-4 h-4 animate-spin" />}
                    Refresh from Plaid
                  </Button>
                )}
              </div>
            )}

            {/* Step 2: Income */}
            {step === 2 && (
              <div className="space-y-4">
                <CardDescription>Add your monthly income sources.</CardDescription>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Source name"
                    value={newIncomeStream.name}
                    onChange={e => setNewIncomeStream(s => ({ ...s, name: e.target.value }))}
                  />
                  <Input
                    type="number"
                    placeholder="Monthly $"
                    value={newIncomeStream.amount}
                    onChange={e => setNewIncomeStream(s => ({ ...s, amount: e.target.value }))}
                  />
                  <div className="flex gap-1">
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={newIncomeStream.type}
                      onChange={e => setNewIncomeStream(s => ({ ...s, type: e.target.value as "fixed" | "variable" }))}
                    >
                      <option value="fixed">Fixed</option>
                      <option value="variable">Variable</option>
                    </select>
                    <Button size="sm" onClick={addIncome}><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>
                {profile.incomeStreams.map((s, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                    <div>
                      <span className="font-medium">{s.name}</span>
                      <Badge variant="outline" className="ml-2 text-xs">{s.type}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">${s.amount.toLocaleString()}/mo</span>
                      <Button size="sm" variant="ghost" onClick={() => removeIncome(i)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="text-right font-bold text-lg">
                  Total: ${profile.monthlyIncome.toLocaleString()}/mo
                </div>
              </div>
            )}

            {/* Step 3: All Expenses (combined fixed + variable) */}
            {step === 3 && (
              <div className="space-y-4">
                <CardDescription>
                  Add all your monthly expenses. Recurring items like rent/mortgage are usually fixed.
                  You can always edit category, amount, and whether an expense is fixed vs variable.
                </CardDescription>
                <div className="grid grid-cols-4 gap-2">
                  <Input
                    placeholder="Expense name"
                    value={newExpense.name}
                    onChange={e => setNewExpense(s => ({ ...s, name: e.target.value }))}
                  />
                  <Input
                    type="number"
                    placeholder="Monthly $"
                    value={newExpense.amount}
                    onChange={e => setNewExpense(s => ({ ...s, amount: e.target.value }))}
                  />
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                    value={newExpense.category}
                    onChange={e => setNewExpense(s => ({ ...s, category: e.target.value }))}
                  >
                    {ALL_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                      value={newExpense.type}
                      onChange={e => setNewExpense(s => ({ ...s, type: e.target.value as "fixed" | "variable" }))}
                    >
                      <option value="fixed">Fixed</option>
                      <option value="variable">Variable</option>
                    </select>
                    <Button size="sm" onClick={addExpense}><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>

                {profile.fixedExpenses.map((e, i) => (
                  <ExpenseRow
                    key={`fixed-${i}`}
                    expense={e}
                    onUpdate={(updated) => updateExpense(e, updated)}
                    onRemove={() => removeExpense(e)}
                  />
                ))}
                {profile.variableExpenses.map((e, i) => (
                  <ExpenseRow
                    key={`var-${i}`}
                    expense={e}
                    onUpdate={(updated) => updateExpense(e, updated)}
                    onRemove={() => removeExpense(e)}
                  />
                ))}

                <div className="flex justify-between text-sm">
                  <span>Fixed: ${totalFixed.toLocaleString()}/mo</span>
                  <span>Variable: ${totalVariable.toLocaleString()}/mo</span>
                  <span className="font-bold">Total: ${totalExpenses.toLocaleString()}/mo</span>
                </div>
              </div>
            )}

            {/* Step 4: Investments (simplified) */}
            {step === 4 && (
              <div className="space-y-5">
                <CardDescription>Tell us about your total investment portfolio. Just the big picture.</CardDescription>
                <div className="space-y-3">
                  <div>
                    <Label>Total Portfolio Value ($)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 50000"
                      value={profile.investments.totalValue || ""}
                      onChange={e => updateProfile({ investments: { ...profile.investments, totalValue: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                  <div>
                    <Label>Monthly Contribution ($)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 750"
                      value={profile.investments.monthlyContribution || ""}
                      onChange={e => updateProfile({ investments: { ...profile.investments, monthlyContribution: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                  <div>
                    <Label>Cash Buffer / Checking Balance ($)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 5000"
                      value={profile.cashBuffer || ""}
                      onChange={e => updateProfile({ cashBuffer: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Money readily accessible in your checking/chequing account.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Savings Goal (optional) */}
            {step === 5 && (
              <div className="space-y-5">
                <CardDescription>Do you have a specific savings goal you&apos;re working toward?</CardDescription>

                <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-4">
                  <input
                    type="checkbox"
                    checked={hasSavingsGoal}
                    onChange={e => {
                      setHasSavingsGoal(e.target.checked);
                      if (e.target.checked && !profile.savingsGoal) {
                        updateProfile({
                          savingsGoal: {
                            name: "",
                            targetAmount: 0,
                            targetDate: "",
                            currentBalance: 0,
                            monthlyContribution: 0,
                          },
                        });
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="font-medium">I have a savings goal</span>
                    <p className="text-xs text-muted-foreground">e.g., house down payment, car, education fund</p>
                  </div>
                </div>

                {hasSavingsGoal && profile.savingsGoal && (
                  <div className="space-y-3">
                    <div>
                      <Label>Goal Name</Label>
                      <Input
                        placeholder="e.g., House Down Payment"
                        value={profile.savingsGoal.name}
                        onChange={e => updateProfile({ savingsGoal: { ...profile.savingsGoal!, name: e.target.value } })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Target Amount ($)</Label>
                        <Input
                          type="number"
                          value={profile.savingsGoal.targetAmount || ""}
                          onChange={e => updateProfile({ savingsGoal: { ...profile.savingsGoal!, targetAmount: parseFloat(e.target.value) || 0 } })}
                        />
                      </div>
                      <div>
                        <Label>Target Date</Label>
                        <Input
                          type="date"
                          value={profile.savingsGoal.targetDate}
                          onChange={e => updateProfile({ savingsGoal: { ...profile.savingsGoal!, targetDate: e.target.value } })}
                        />
                      </div>
                      <div>
                        <Label>Current Balance ($)</Label>
                        <Input
                          type="number"
                          value={profile.savingsGoal.currentBalance || ""}
                          onChange={e => updateProfile({ savingsGoal: { ...profile.savingsGoal!, currentBalance: parseFloat(e.target.value) || 0 } })}
                        />
                      </div>
                      <div>
                        <Label>Monthly Contribution ($)</Label>
                        <Input
                          type="number"
                          value={profile.savingsGoal.monthlyContribution || ""}
                          onChange={e => updateProfile({ savingsGoal: { ...profile.savingsGoal!, monthlyContribution: parseFloat(e.target.value) || 0 } })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {!hasSavingsGoal && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No problem! You can always add a savings goal later from the dashboard.
                  </p>
                )}
              </div>
            )}

            {/* Step 6: Goal Weights */}
            {step === 6 && (
              <div className="space-y-6">
                <CardDescription>
                  What matters most to you? The AI will use these weights to recommend which rebalancing plan fits you best during a risk event.
                </CardDescription>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Lifestyle Maximization</Label>
                      <span className="text-sm font-semibold">{profile.goalWeights.lifestyle}/10</span>
                    </div>
                    <Slider
                      value={[profile.goalWeights.lifestyle]}
                      onValueChange={([v]) => updateProfile({ goalWeights: { ...profile.goalWeights, lifestyle: v } })}
                      max={10} min={1} step={1}
                    />
                    <p className="text-xs text-muted-foreground">How much do you value maintaining your current spending habits?</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>{hasSavingsGoal ? "Savings Goal" : "Risk Payoff Priority"}</Label>
                      <span className="text-sm font-semibold">{profile.goalWeights.savingsGoal}/10</span>
                    </div>
                    <Slider
                      value={[profile.goalWeights.savingsGoal]}
                      onValueChange={([v]) => updateProfile({ goalWeights: { ...profile.goalWeights, savingsGoal: v } })}
                      max={10} min={1} step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      {hasSavingsGoal
                        ? `How important is staying on track for "${profile.savingsGoal?.name || "your goal"}"?`
                        : "How important is paying down risk/expenses as quickly as possible?"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Investment Discipline</Label>
                      <span className="text-sm font-semibold">{profile.goalWeights.investmentDiscipline}/10</span>
                    </div>
                    <Slider
                      value={[profile.goalWeights.investmentDiscipline]}
                      onValueChange={([v]) => updateProfile({ goalWeights: { ...profile.goalWeights, investmentDiscipline: v } })}
                      max={10} min={1} step={1}
                    />
                    <p className="text-xs text-muted-foreground">How important is continuing your monthly investment contributions?</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 7: Review (financial summary only, no allocation preview) */}
            {step === 7 && (
              <div className="space-y-4">
                <CardDescription>Here&apos;s your financial profile summary. You can edit your income allocation from the dashboard.</CardDescription>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Monthly Income</div>
                    <div className="text-xl font-bold">${profile.monthlyIncome.toLocaleString()}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Monthly Expenses</div>
                    <div className="text-xl font-bold">${totalExpenses.toLocaleString()}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Portfolio Value</div>
                    <div className="text-xl font-bold">${profile.investments.totalValue.toLocaleString()}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Cash Buffer</div>
                    <div className="text-xl font-bold">${profile.cashBuffer.toLocaleString()}</div>
                  </div>
                  {hasSavingsGoal && profile.savingsGoal && (
                    <>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="text-sm text-muted-foreground">Savings Goal</div>
                        <div className="text-xl font-bold">{profile.savingsGoal.name}</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="text-sm text-muted-foreground">Saved So Far</div>
                        <div className="text-xl font-bold">${profile.savingsGoal.currentBalance.toLocaleString()} / ${profile.savingsGoal.targetAmount.toLocaleString()}</div>
                      </div>
                    </>
                  )}
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center text-sm text-green-800">
                  Monthly surplus: ${Math.max(0, profile.monthlyIncome - totalExpenses - profile.investments.monthlyContribution - (profile.savingsGoal?.monthlyContribution ?? 0)).toLocaleString()}/mo
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setStep(s => s - 1)}
                disabled={step === 0}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canProceed()}
                >
                  {step === 5 && !hasSavingsGoal ? "Skip" : "Next"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleComplete}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Launch Dashboard
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
