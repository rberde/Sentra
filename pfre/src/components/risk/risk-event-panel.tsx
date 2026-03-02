"use client";

import { useState, useCallback } from "react";
import { useApp } from "@/contexts/app-context";
import { simulateRiskBucket } from "@/lib/engine/risk-engine";
import { generateRebalancingPlans } from "@/lib/engine/rebalancer";
import type { RiskEvent, RiskBucketType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  HeartPulse,
  TrendingDown,
  ArrowDownRight,
  Trash2,
  Zap,
  AlertTriangle,
  Bot,
  Pencil,
  Check,
  X,
  Send,
} from "lucide-react";

const RISK_BUCKETS: { type: RiskBucketType; name: string; icon: typeof Briefcase; description: string; color: string; questions: string[] }[] = [
  {
    type: "income_shock",
    name: "Job Loss / Income Shock",
    icon: Briefcase,
    description: "Loss or reduction of income",
    color: "bg-red-50 border-red-200 text-red-700",
    questions: ["How much of your income is affected?", "How long do you expect this to last?"],
  },
  {
    type: "expense_shock",
    name: "Medical / Expense Shock",
    icon: HeartPulse,
    description: "Unexpected lump sum expense",
    color: "bg-orange-50 border-orange-200 text-orange-700",
    questions: ["What is the total bill amount?", "Can you pay it in installments? If so, over how many months?"],
  },
  {
    type: "market_shock",
    name: "Market Crash",
    icon: TrendingDown,
    description: "Significant drop in portfolio value",
    color: "bg-purple-50 border-purple-200 text-purple-700",
    questions: ["How much has your portfolio dropped (estimate)?", "Do you expect recovery within a year?"],
  },
  {
    type: "structural_drift",
    name: "Lifestyle Inflation",
    icon: ArrowDownRight,
    description: "Gradual expense increase",
    color: "bg-yellow-50 border-yellow-200 text-yellow-700",
    questions: ["By roughly what percentage have your expenses increased?", "Is this a temporary or permanent change?"],
  },
];

interface AiFlowState {
  bucketType: RiskBucketType;
  step: number;
  answers: string[];
  suggestedEvent: RiskEvent | null;
  loading: boolean;
}

function parseMaybePercent(input: string): number | null {
  const lower = input.toLowerCase();
  if (lower.includes("lost job") || lower.includes("no income") || lower.includes("zero income")) return 100;
  if (lower.includes("half")) return 50;
  if (lower.includes("quarter")) return 25;
  const n = parseFloat(input.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function parseMaybeDuration(input: string): number {
  const lower = input.toLowerCase();
  if (lower.includes("unknown") || lower.includes("not sure") || lower.includes("unsure")) return -1;
  const n = parseFloat(input.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return -1;
  return Math.max(1, Math.round(n));
}

function suggestEventFromAnswers(type: RiskBucketType, answers: string[], profile: { monthlyIncome: number; investments: { totalValue: number } }): RiskEvent {
  let severity = 100;
  let duration = -1;
  let lumpSum: number | undefined;

  const num1 = parseFloat(answers[0]?.replace(/[^0-9.]/g, "") || "0");
  const parsedPercent = parseMaybePercent(answers[0] ?? "");
  const parsedDuration = parseMaybeDuration(answers[1] ?? "");

  switch (type) {
    case "income_shock":
      severity = num1 > 1 && profile.monthlyIncome > 0
        ? Math.round((num1 / profile.monthlyIncome) * 100)
        : (parsedPercent ?? 100);
      severity = Math.min(100, Math.max(10, severity || 100));
      duration = parsedDuration;
      break;
    case "expense_shock":
      lumpSum = num1 > 0 ? num1 : 10000;
      severity = 100;
      duration = parsedDuration === -1 ? 1 : parsedDuration;
      break;
    case "market_shock":
      severity = Math.min(80, Math.max(5, parsedPercent ?? 30));
      duration = parsedDuration === -1 ? 6 : parsedDuration;
      break;
    case "structural_drift":
      severity = Math.min(50, Math.max(5, parsedPercent ?? 15));
      duration = parsedDuration === -1 ? 12 : parsedDuration;
      break;
  }

  return {
    id: crypto.randomUUID(),
    type,
    name: RISK_BUCKETS.find(b => b.type === type)!.name,
    severity,
    duration,
    lumpSum,
    aiSuggested: true,
    isActive: true,
    description: `Based on your answers: "${answers.join('" and "')}"`,
  };
}

function EditableEventRow({ event, onSave, onRemove }: { event: RiskEvent; onSave: (e: RiskEvent) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [sev, setSev] = useState(event.severity);
  const [dur, setDur] = useState(event.duration);
  const [lump, setLump] = useState(event.lumpSum ?? 0);

  if (editing) {
    return (
      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{event.name}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => { onSave({ ...event, severity: sev, duration: dur, lumpSum: event.type === "expense_shock" ? lump : undefined }); setEditing(false); }}>
              <Check className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Severity (%)</Label>
            <Input type="number" value={sev} onChange={e => setSev(parseInt(e.target.value) || 0)} className="h-7 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Duration (months)</Label>
            <Input type="number" value={dur} onChange={e => setDur(parseInt(e.target.value) || 0)} className="h-7 text-xs" />
          </div>
          {event.type === "expense_shock" && (
            <div className="col-span-2">
              <Label className="text-xs">Lump Sum ($)</Label>
              <Input type="number" value={lump} onChange={e => setLump(parseInt(e.target.value) || 0)} className="h-7 text-xs" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
      <div>
        <span className="font-medium text-sm">{event.name}</span>
        <span className="text-xs text-muted-foreground ml-2">
          {event.severity}% severity, {event.duration === -1 ? "unknown duration" : `${event.duration} months`}
          {event.lumpSum ? `, $${event.lumpSum.toLocaleString()} lump sum` : ""}
        </span>
        {event.aiSuggested && <Badge variant="outline" className="ml-2 text-xs">AI suggested</Badge>}
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <Pencil className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export function RiskEventPanel({ onSimulationComplete }: { onSimulationComplete?: () => void }) {
  const { state, dispatch } = useApp();
  const [aiFlow, setAiFlow] = useState<AiFlowState | null>(null);
  const [userAnswer, setUserAnswer] = useState("");

  const runSimulation = useCallback(() => {
    if (state.riskEvents.length === 0 || !state.profile) return;
    const stress = simulateRiskBucket(state.profile, { events: state.riskEvents });
    dispatch({ type: "SET_STRESS_RESULT", result: stress });
    const plans = generateRebalancingPlans(state.profile, stress);
    dispatch({ type: "SET_REBALANCING_PLANS", plans });
    onSimulationComplete?.();
  }, [state.riskEvents, state.profile, dispatch, onSimulationComplete]);

  if (!state.profile) return null;

  const startAiFlow = (type: RiskBucketType) => {
    setAiFlow({ bucketType: type, step: 0, answers: [], suggestedEvent: null, loading: false });
    setUserAnswer("");
  };

  const handleAnswer = () => {
    if (!aiFlow || !userAnswer.trim()) return;
    const bucket = RISK_BUCKETS.find(b => b.type === aiFlow.bucketType)!;
    const newAnswers = [...aiFlow.answers, userAnswer.trim()];

    if (aiFlow.step + 1 < bucket.questions.length) {
      setAiFlow({ ...aiFlow, step: aiFlow.step + 1, answers: newAnswers });
      setUserAnswer("");
    } else {
      const suggested = suggestEventFromAnswers(
        aiFlow.bucketType,
        newAnswers,
        { monthlyIncome: state.profile!.monthlyIncome, investments: state.profile!.investments },
      );
      setAiFlow({ ...aiFlow, answers: newAnswers, suggestedEvent: suggested, loading: false });
      setUserAnswer("");
    }
  };

  const acceptSuggestion = () => {
    if (!aiFlow?.suggestedEvent) return;
    dispatch({ type: "ADD_RISK_EVENT", event: aiFlow.suggestedEvent });
    setAiFlow(null);
  };

  const handleUpdateEvent = (event: RiskEvent) => {
    dispatch({ type: "UPDATE_RISK_EVENT", event });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          What happened?
        </h2>
        <p className="text-sm text-muted-foreground">Select a risk event and the AI will walk you through it.</p>
      </div>

      {/* Risk bucket selection */}
      <div className="grid md:grid-cols-2 gap-3">
        {RISK_BUCKETS.map(bucket => {
          const isActive = state.riskEvents.some(e => e.type === bucket.type);
          const isInFlow = aiFlow?.bucketType === bucket.type;
          return (
            <Card
              key={bucket.type}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isInFlow ? "ring-2 ring-primary" : ""
              } ${isActive ? "opacity-50 pointer-events-none" : ""} border-0 shadow-sm`}
              onClick={() => !isActive && startAiFlow(bucket.type)}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bucket.color}`}>
                  <bucket.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{bucket.name}</div>
                  <div className="text-xs text-muted-foreground">{bucket.description}</div>
                  {isActive && <Badge className="mt-1 text-xs" variant="secondary">Active</Badge>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AI-guided flow */}
      {aiFlow && !aiFlow.suggestedEvent && (
        <Card className="border-0 shadow-sm bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <Bot className="w-3 h-3 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium">AI Assistant</span>
            </div>

            {/* Previous Q&A */}
            {aiFlow.answers.map((ans, i) => (
              <div key={i} className="space-y-1">
                <p className="text-sm text-muted-foreground">{RISK_BUCKETS.find(b => b.type === aiFlow.bucketType)!.questions[i]}</p>
                <p className="text-sm bg-white rounded-lg px-3 py-1.5 inline-block">{ans}</p>
              </div>
            ))}

            {/* Current question */}
            <p className="text-sm font-medium">
              {RISK_BUCKETS.find(b => b.type === aiFlow.bucketType)!.questions[aiFlow.step]}
            </p>

            <div className="flex gap-2">
              <Input
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAnswer()}
                placeholder="Type your answer..."
                className="text-sm"
              />
              <Button size="sm" onClick={handleAnswer} disabled={!userAnswer.trim()}>
                <Send className="w-3 h-3" />
              </Button>
            </div>

            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setAiFlow(null)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* AI suggestion review */}
      {aiFlow?.suggestedEvent && (
        <Card className="border-0 shadow-sm border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="w-4 h-4" /> AI Suggestion
            </CardTitle>
            <CardDescription>Based on your answers, here&apos;s how I&apos;d model this risk event. You can edit before confirming.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-2">
                <div className="text-xs text-muted-foreground">Severity</div>
                <div className="font-bold">{aiFlow.suggestedEvent.severity}%</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <div className="text-xs text-muted-foreground">Duration</div>
                <div className="font-bold">{aiFlow.suggestedEvent.duration} months</div>
              </div>
              {aiFlow.suggestedEvent.lumpSum && (
                <div className="bg-muted/50 rounded-lg p-2 col-span-2">
                  <div className="text-xs text-muted-foreground">Lump Sum</div>
                  <div className="font-bold">${aiFlow.suggestedEvent.lumpSum.toLocaleString()}</div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={acceptSuggestion}>
                <Check className="w-4 h-4 mr-2" /> Looks Good — Add Event
              </Button>
              <Button variant="outline" onClick={() => setAiFlow(null)}>
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active events (editable) */}
      {state.riskEvents.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Active Risk Events ({state.riskEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.riskEvents.map(event => (
              <EditableEventRow
                key={event.id}
                event={event}
                onSave={handleUpdateEvent}
                onRemove={() => dispatch({ type: "REMOVE_RISK_EVENT", eventId: event.id })}
              />
            ))}
            <div className="flex gap-2 pt-2">
              <Button onClick={runSimulation} className="flex-1">
                <Zap className="w-4 h-4 mr-2" />
                Simulate & Show Plans
              </Button>
              <Button variant="outline" onClick={() => dispatch({ type: "CLEAR_RISK_EVENTS" })}>
                Clear All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
