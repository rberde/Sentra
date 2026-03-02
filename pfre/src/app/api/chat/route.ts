import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import type { UserProfile, RiskEvent, StressResult, RebalancingPlan } from "@/lib/types";

export const maxDuration = 30;

function buildSystemPrompt(context: {
  profile: UserProfile | null;
  riskEvents: RiskEvent[];
  stressResult: StressResult | null;
  rebalancingPlans: RebalancingPlan[];
  selectedPlanId: string | null;
}) {
  const { profile, riskEvents, stressResult, rebalancingPlans, selectedPlanId } = context;

  let systemPrompt = `You are an AI financial risk advisor for the Personal Financial Risk Engine (PFRE). Your role is to help users understand their financial risk, explain stress test results, and guide them through rebalancing decisions.

KEY PRINCIPLES:
- Be empathetic — the user may be under financial stress
- Be specific — use actual numbers from their profile
- Be honest about tradeoffs — never sugarcoat
- Always present options, never make decisions for the user
- Explain in plain language, avoid jargon

CAPABILITIES:
- Explain risk scores, liquidity runway, and depletion timelines
- Help users understand which risk events to simulate
- Explain rebalancing plans and their tradeoffs
- Answer "what if" questions about different scenarios
- Help users understand what money they can and cannot touch (constraints)`;

  if (profile) {
    const totalFixed = profile.fixedExpenses.reduce((s, e) => s + e.amount, 0);
    const totalVariable = profile.variableExpenses.reduce((s, e) => s + e.amount, 0);

    systemPrompt += `

USER PROFILE:
- Name: ${profile.name}
- Monthly Income: $${profile.monthlyIncome.toLocaleString()}
- Fixed Expenses: $${totalFixed.toLocaleString()}/mo (${profile.fixedExpenses.map(e => `${e.name}: $${e.amount}`).join(", ")})
- Variable Expenses: $${totalVariable.toLocaleString()}/mo (${profile.variableExpenses.map(e => `${e.name}: $${e.amount}`).join(", ")})
- Investments: $${profile.investments.totalValue.toLocaleString()} (contributing $${profile.investments.monthlyContribution}/mo)
- Savings Goal: ${profile.savingsGoal ? `"${profile.savingsGoal.name}" — target $${profile.savingsGoal.targetAmount.toLocaleString()} by ${profile.savingsGoal.targetDate}, current: $${profile.savingsGoal.currentBalance.toLocaleString()}, contributing $${profile.savingsGoal.monthlyContribution}/mo` : "None set"}
- Cash Buffer: $${profile.cashBuffer.toLocaleString()}
- Goal Weights: Lifestyle ${profile.goalWeights.lifestyle}/10, Savings Goal ${profile.goalWeights.savingsGoal}/10, Investment Discipline ${profile.goalWeights.investmentDiscipline}/10`;
  }

  if (riskEvents.length > 0) {
    systemPrompt += `

ACTIVE RISK EVENTS:
${riskEvents.map(e => `- ${e.name}: ${e.severity}% severity, ${e.duration} months${e.lumpSum ? `, $${e.lumpSum.toLocaleString()} lump sum` : ""}`).join("\n")}`;
  }

  if (stressResult) {
    systemPrompt += `

STRESS TEST RESULTS:
- Baseline burn rate: $${stressResult.baselineMonthlyBurn.toLocaleString()}/mo
- Adjusted burn rate: $${stressResult.adjustedMonthlyBurn.toLocaleString()}/mo
- Liquidity runway: ${stressResult.liquidityRunway} months
- Risk score: ${stressResult.riskScoreBefore} → ${stressResult.riskScoreAfter} (+${stressResult.riskScoreDelta})
- Constraints: Cannot touch $${stressResult.constraintMap.hardConstraints.toLocaleString()}/mo (fixed), can reduce $${stressResult.constraintMap.softConstraints.toLocaleString()}/mo (variable), can pause $${stressResult.constraintMap.pausable.toLocaleString()}/mo (investments), can redirect $${stressResult.constraintMap.redirectable.toLocaleString()}/mo (savings)`;
  }

  if (rebalancingPlans.length > 0) {
    const selected = rebalancingPlans.find(p => p.id === selectedPlanId);
    systemPrompt += `

REBALANCING PLANS:
${rebalancingPlans.map(p => `- ${p.name}: ${p.tradeoffSummary} (Resolve in ${p.timelineToResolve} months, lifestyle cut ${p.goalImpact.lifestyleReduction}%, savings delay ${p.goalImpact.savingsGoalDelay} months)`).join("\n")}
${selected ? `\nUSER SELECTED: "${selected.name}"` : "\nNo plan selected yet."}`;
  }

  return systemPrompt;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, profile, riskEvents, stressResult, rebalancingPlans, selectedPlanId } = body;

  const systemPrompt = buildSystemPrompt({
    profile,
    riskEvents: riskEvents || [],
    stressResult,
    rebalancingPlans: rebalancingPlans || [],
    selectedPlanId,
  });

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages,
  });

  return result.toUIMessageStreamResponse();
}
