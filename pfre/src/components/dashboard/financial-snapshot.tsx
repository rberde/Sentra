"use client";

import { useApp } from "@/contexts/app-context";
import { calculateBaselineRisk } from "@/lib/engine/risk-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign,
  TrendingUp,
  PiggyBank,
  Wallet,
  ShieldAlert,
  ArrowUpDown,
} from "lucide-react";

export function FinancialSnapshot() {
  const { state } = useApp();
  const p = state.profile;
  if (!p) return null;

  const totalFixed = p.fixedExpenses.reduce((s, e) => s + e.amount, 0);
  const totalVariable = p.variableExpenses.reduce((s, e) => s + e.amount, 0);
  const totalExpenses = totalFixed + totalVariable;
  const savingsContrib = p.savingsGoal?.monthlyContribution ?? 0;
  const savingsBalance = p.savingsGoal?.currentBalance ?? 0;
  const monthlyCashFlow = p.monthlyIncome - totalExpenses - p.investments.monthlyContribution - savingsContrib;
  const savingsRate = p.monthlyIncome > 0
    ? ((p.investments.monthlyContribution + savingsContrib) / p.monthlyIncome) * 100
    : 0;
  const netWorth = p.cashBuffer + savingsBalance + p.investments.totalValue;
  const riskScore = calculateBaselineRisk(p);

  const riskColor = riskScore < 30 ? "text-green-600" : riskScore < 60 ? "text-yellow-600" : "text-red-600";
  const riskLabel = riskScore < 30 ? "Low Risk" : riskScore < 60 ? "Moderate Risk" : "High Risk";

  const cards = [
    { label: "Net Worth", value: `$${netWorth.toLocaleString()}`, icon: DollarSign, color: "bg-blue-50 text-blue-600" },
    { label: "Monthly Income", value: `$${p.monthlyIncome.toLocaleString()}`, icon: TrendingUp, color: "bg-green-50 text-green-600" },
    { label: "Monthly Expenses", value: `$${totalExpenses.toLocaleString()}`, icon: Wallet, color: "bg-orange-50 text-orange-600" },
    { label: "Cash Flow", value: `$${monthlyCashFlow.toLocaleString()}`, icon: ArrowUpDown, color: monthlyCashFlow >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600" },
    { label: "Savings Rate", value: `${savingsRate.toFixed(1)}%`, icon: PiggyBank, color: "bg-purple-50 text-purple-600" },
    { label: "Portfolio", value: `$${p.investments.totalValue.toLocaleString()}`, icon: TrendingUp, color: "bg-indigo-50 text-indigo-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(c => (
          <Card key={c.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${c.color}`}>
                <c.icon className="w-4 h-4" />
              </div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="text-lg font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risk Score */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Baseline Risk Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress value={riskScore} className="h-3" />
            </div>
            <div className={`text-2xl font-bold ${riskColor}`}>{riskScore}</div>
            <span className={`text-sm font-medium ${riskColor}`}>{riskLabel}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Score 0-100 (lower is better). Based on liquidity runway, savings rate, and portfolio diversification.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
