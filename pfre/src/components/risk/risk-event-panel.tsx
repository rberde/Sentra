"use client";

import { useState, useCallback } from "react";
import { useApp } from "@/contexts/app-context";
import { simulateRiskBucket } from "@/lib/engine/risk-engine";
import { generateRebalancingPlans } from "@/lib/engine/rebalancer";
import { applyFollowupToEvent, suggestEventFromAnswers } from "@/lib/engine/risk-event-parse";
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
  RotateCcw,
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
    questions: ["What is the total amount you need to pay?", "Can you pay it in installments? If so, over how many months?"],
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
  originalEvent: RiskEvent | null;
  loading: boolean;
  chatLog: { role: "ai" | "user"; text: string }[];
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
  const [followupMessage, setFollowupMessage] = useState("");

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
    const bucket = RISK_BUCKETS.find(b => b.type === type)!;
    setAiFlow({
      bucketType: type,
      step: 0,
      answers: [],
      suggestedEvent: null,
      originalEvent: null,
      loading: false,
      chatLog: [{ role: "ai", text: bucket.questions[0] }],
    });
    setUserAnswer("");
  };

  const handleAnswer = () => {
    if (!aiFlow || !userAnswer.trim()) return;
    const bucket = RISK_BUCKETS.find(b => b.type === aiFlow.bucketType)!;
    const newAnswers = [...aiFlow.answers, userAnswer.trim()];
    const newLog: AiFlowState["chatLog"] = [
      ...aiFlow.chatLog,
      { role: "user", text: userAnswer.trim() },
    ];

    if (aiFlow.step + 1 < bucket.questions.length) {
      const nextQuestion = bucket.questions[aiFlow.step + 1];
      newLog.push({ role: "ai", text: nextQuestion });
      setAiFlow({ ...aiFlow, step: aiFlow.step + 1, answers: newAnswers, chatLog: newLog });
      setUserAnswer("");
    } else {
      const suggested = suggestEventFromAnswers(
        aiFlow.bucketType,
        newAnswers,
        { monthlyIncome: state.profile!.monthlyIncome, investments: state.profile!.investments },
      );
      const summaryParts: string[] = [];
      if (suggested.type !== "expense_shock") summaryParts.push(`Severity: ${suggested.severity}%`);
      summaryParts.push(`Duration: ${suggested.duration === -1 ? "unknown" : `${suggested.duration} months`}`);
      if (suggested.lumpSum) summaryParts.push(`Amount: $${suggested.lumpSum.toLocaleString()}`);
      newLog.push({ role: "ai", text: `Here's what I understood:\n${summaryParts.join("\n")}\n\nYou can edit the values below, or type a correction (e.g. "actually it's $10,000 over 6 weeks").` });

      setAiFlow({ ...aiFlow, answers: newAnswers, suggestedEvent: suggested, originalEvent: { ...suggested }, loading: false, chatLog: newLog });
      setUserAnswer("");
    }
  };

  const handleFollowup = () => {
    if (!aiFlow?.suggestedEvent || !followupMessage.trim()) return;
    const lower = followupMessage.toLowerCase();

    const newLog: AiFlowState["chatLog"] = [
      ...aiFlow.chatLog,
      { role: "user", text: followupMessage.trim() },
    ];

    // Handle "revert" / "undo" / "reset"
    if (/\b(revert|undo|reset|start over|go back|original)\b/i.test(lower)) {
      if (aiFlow.originalEvent) {
        newLog.push({ role: "ai", text: "Reverted to the original suggestion." });
        setAiFlow({ ...aiFlow, suggestedEvent: { ...aiFlow.originalEvent }, chatLog: newLog });
      } else {
        newLog.push({ role: "ai", text: "No previous version to revert to." });
        setAiFlow({ ...aiFlow, chatLog: newLog });
      }
      setFollowupMessage("");
      return;
    }

    const { updated, explanation } = applyFollowupToEvent(
      aiFlow.suggestedEvent,
      followupMessage,
      {
        monthlyIncome: state.profile!.monthlyIncome,
        portfolioValue: state.profile!.investments.totalValue,
      },
    );
    newLog.push({ role: "ai", text: explanation });
    setAiFlow({ ...aiFlow, suggestedEvent: updated, chatLog: newLog });
    setFollowupMessage("");
  };

  const acceptSuggestion = () => {
    if (!aiFlow?.suggestedEvent) return;
    dispatch({ type: "ADD_RISK_EVENT", event: aiFlow.suggestedEvent });
    setAiFlow(null);
    setFollowupMessage("");
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

      {/* AI-guided flow (Q&A phase) */}
      {aiFlow && !aiFlow.suggestedEvent && (
        <Card className="border-0 shadow-sm bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <Bot className="w-3 h-3 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium">AI Assistant</span>
            </div>

            {/* Chat log */}
            <div className="max-h-48 overflow-y-auto space-y-2">
              {aiFlow.chatLog.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : ""}`}>
                  <div className={`rounded-lg px-3 py-1.5 text-sm max-w-[85%] whitespace-pre-wrap ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-white"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

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

      {/* AI suggestion review with full chat history */}
      {aiFlow?.suggestedEvent && (
        <Card className="border-0 shadow-sm border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="w-4 h-4" /> AI Suggestion
            </CardTitle>
            <CardDescription>Review and edit the risk event below. Chat to refine, or type &quot;revert&quot; to undo changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Chat history (scrollable) */}
            <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-lg bg-muted/30 p-2">
              {aiFlow.chatLog.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : ""}`}>
                  <div className={`rounded-md px-2 py-1 text-xs max-w-[85%] whitespace-pre-wrap ${
                    msg.role === "user" ? "bg-primary/10" : "bg-white"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Current values display */}
            <div className="grid grid-cols-2 gap-3">
              {aiFlow.suggestedEvent.type !== "expense_shock" && (
                <div className="bg-muted/50 rounded-lg p-2">
                  <div className="text-xs text-muted-foreground">Severity</div>
                  <div className="font-bold">{aiFlow.suggestedEvent.severity}%</div>
                </div>
              )}
              <div className="bg-muted/50 rounded-lg p-2">
                <div className="text-xs text-muted-foreground">Duration</div>
                <div className="font-bold">{aiFlow.suggestedEvent.duration === -1 ? "Unknown" : `${aiFlow.suggestedEvent.duration} months`}</div>
              </div>
              {aiFlow.suggestedEvent.lumpSum && (
                <div className="bg-muted/50 rounded-lg p-2 col-span-2">
                  <div className="text-xs text-muted-foreground">Expense Amount</div>
                  <div className="font-bold">${aiFlow.suggestedEvent.lumpSum.toLocaleString()}</div>
                </div>
              )}
            </div>

            {/* Inline editing */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs text-muted-foreground">Edit before confirming</p>
              <div className="grid grid-cols-2 gap-2">
                {aiFlow.suggestedEvent.type !== "expense_shock" && (
                  <div>
                    <Label className="text-xs">Severity (%)</Label>
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={aiFlow.suggestedEvent.severity}
                      onChange={e => {
                        const value = parseInt(e.target.value) || 0;
                        setAiFlow({
                          ...aiFlow,
                          suggestedEvent: { ...aiFlow.suggestedEvent!, severity: Math.max(0, Math.min(100, value)) },
                        });
                      }}
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Duration (months)</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    value={aiFlow.suggestedEvent.duration === -1 ? "" : aiFlow.suggestedEvent.duration}
                    onChange={e => {
                      const raw = parseInt(e.target.value);
                      const value = Number.isFinite(raw) && raw > 0 ? raw : -1;
                      setAiFlow({
                        ...aiFlow,
                        suggestedEvent: { ...aiFlow.suggestedEvent!, duration: value },
                      });
                    }}
                    placeholder="Unknown"
                  />
                </div>
                {aiFlow.suggestedEvent.type === "expense_shock" && (
                  <div className="col-span-2">
                    <Label className="text-xs">Expense Amount ($)</Label>
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={aiFlow.suggestedEvent.lumpSum ?? 0}
                      onChange={e => {
                        const value = parseInt(e.target.value) || 0;
                        setAiFlow({
                          ...aiFlow,
                          suggestedEvent: { ...aiFlow.suggestedEvent!, lumpSum: Math.max(0, value) },
                        });
                      }}
                    />
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1"
                onClick={() => {
                  if (aiFlow.originalEvent) {
                    setAiFlow({ ...aiFlow, suggestedEvent: { ...aiFlow.originalEvent } });
                  }
                }}
              >
                <RotateCcw className="w-3 h-3" /> Revert to original
              </Button>
            </div>

            {/* Chat refinement */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs text-muted-foreground">Chat with AI to refine</p>
              <div className="flex gap-2">
                <Input
                  value={followupMessage}
                  onChange={e => setFollowupMessage(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleFollowup()}
                  placeholder={'e.g. "Actually it\'s $10,000 over 6 weeks"'}
                  className="text-sm"
                />
                <Button variant="outline" onClick={handleFollowup} disabled={!followupMessage.trim()}>
                  Apply
                </Button>
              </div>
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
