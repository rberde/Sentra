"use client";

import { useApp } from "@/contexts/app-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#6366f1"];

export function AllocationChart() {
  const { state } = useApp();
  const p = state.profile;
  if (!p) return null;

  const data = [
    { name: "Fixed Expenses", value: p.allocation.fixedExpenses },
    { name: "Variable Expenses", value: p.allocation.variableExpenses },
    { name: "Investments", value: p.allocation.investments },
    { name: "Savings Goal", value: p.allocation.savingsGoal },
    { name: "Cash Buffer", value: p.allocation.cashBuffer },
  ].filter(d => d.value > 0);

  const totalFixed = p.fixedExpenses.reduce((s, e) => s + e.amount, 0);
  const totalVariable = p.variableExpenses.reduce((s, e) => s + e.amount, 0);

  const dollarBreakdown = [
    { label: "Fixed Expenses", amount: totalFixed, pct: p.allocation.fixedExpenses },
    { label: "Variable Expenses", amount: totalVariable, pct: p.allocation.variableExpenses },
    { label: "Investments", amount: p.investments.monthlyContribution, pct: p.allocation.investments },
    { label: "Savings Goal", amount: p.savingsGoal?.monthlyContribution ?? 0, pct: p.allocation.savingsGoal },
    { label: "Cash Buffer", amount: Math.round(p.monthlyIncome * p.allocation.cashBuffer / 100), pct: p.allocation.cashBuffer },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Income Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Monthly Budget Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dollarBreakdown.map((item, i) => (
              <div key={item.label} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i] }}
                />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="font-semibold">${item.amount.toLocaleString()}/mo</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full mt-1">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.pct}%`, backgroundColor: COLORS[i] }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground w-10 text-right">{item.pct}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
