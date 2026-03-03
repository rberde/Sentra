"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/contexts/app-context";
import type { NotificationRule } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BellRing, Bot, Zap, Shield, Plus, Trash2, Plug, CheckCircle2, XCircle, ExternalLink, Copy, RefreshCw, Loader2, Download } from "lucide-react";

export function NotificationSettingsCard() {
  const { state, dispatch } = useApp();
  const settings = state.notificationSettings;

  const update = (partial: Partial<typeof settings>) => {
    dispatch({
      type: "SET_NOTIFICATION_SETTINGS",
      settings: { ...settings, ...partial },
    });
  };

  const updateRule = (ruleId: string, partial: Partial<NotificationRule>) => {
    const updatedRules = settings.rules.map(r =>
      r.id === ruleId ? { ...r, ...partial } : r,
    );
    update({ rules: updatedRules });
  };

  const removeRule = (ruleId: string) => {
    update({ rules: settings.rules.filter(r => r.id !== ruleId) });
  };

  const addCustomRule = () => {
    const newRule: NotificationRule = {
      id: `rule_custom_${Date.now()}`,
      type: "spending_cap",
      label: "Custom alert",
      description: "Edit this rule to match your needs.",
      enabled: true,
      threshold: 0,
      aiGenerated: false,
    };
    update({ rules: [...settings.rules, newRule] });
  };

  return (
    <div className="space-y-6">
      {/* When to Ping — Threshold Rules */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            When Should the AI Ping You?
          </CardTitle>
          <CardDescription className="text-xs">
            These rules define the triggers for notifications. The AI agent monitors your accounts
            and sends alerts when any of these thresholds are crossed — so you don&apos;t have to
            think about it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.rules.map(rule => (
            <div key={rule.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={e => updateRule(rule.id, { enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">{rule.label}</span>
                  {rule.aiGenerated && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Bot className="w-3 h-3" /> AI
                    </Badge>
                  )}
                </div>
                {!rule.aiGenerated && (
                  <Button size="sm" variant="ghost" onClick={() => removeRule(rule.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground ml-6">{rule.description}</p>
              {rule.threshold !== undefined && (
                <div className="ml-6 flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">
                    {rule.type === "spending_cap" ? "Budget % limit" :
                     rule.type === "liquidity_floor" ? "Months of expenses" :
                     rule.type === "risk_score_alert" ? "Score threshold" :
                     rule.type === "drift_threshold" ? "Drift %" :
                     "Value"}
                  </Label>
                  <Input
                    type="number"
                    className="h-7 w-20 text-xs"
                    value={rule.threshold}
                    onChange={e => updateRule(rule.id, { threshold: parseInt(e.target.value) || 0 })}
                    disabled={!rule.enabled}
                  />
                </div>
              )}
              {rule.intervalDays !== undefined && (
                <div className="ml-6 flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Every</Label>
                  <Input
                    type="number"
                    className="h-7 w-16 text-xs"
                    value={rule.intervalDays}
                    onChange={e => updateRule(rule.id, { intervalDays: parseInt(e.target.value) || 1 })}
                    disabled={!rule.enabled}
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
              )}
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addCustomRule} className="gap-1">
            <Plus className="w-3 h-3" /> Add custom rule
          </Button>
        </CardContent>
      </Card>

      {/* Delivery Preferences */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BellRing className="w-4 h-4 text-primary" />
            Delivery Preferences
          </CardTitle>
          <CardDescription className="text-xs">
            Choose how and when you receive notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Ping window start</Label>
              <Input
                type="time"
                className="h-8 text-sm"
                value={settings.pingWindowStart}
                onChange={e => update({ pingWindowStart: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Ping window end</Label>
              <Input
                type="time"
                className="h-8 text-sm"
                value={settings.pingWindowEnd}
                onChange={e => update({ pingWindowEnd: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Ping frequency</Label>
            <select
              className="mt-1 flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              value={settings.frequency}
              onChange={e => update({ frequency: e.target.value as typeof settings.frequency })}
            >
              <option value="realtime">Realtime alerts</option>
              <option value="daily_digest">Daily digest</option>
              <option value="weekly_digest">Weekly digest</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Channels</Label>
            <div className="flex items-center justify-between">
              <span>In-app</span>
              <input
                type="checkbox"
                checked={settings.channels.inApp}
                onChange={e => update({ channels: { ...settings.channels, inApp: e.target.checked } })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span>SMS</span>
              <input
                type="checkbox"
                checked={settings.channels.sms}
                onChange={e => update({ channels: { ...settings.channels, sms: e.target.checked } })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span>Push</span>
              <input
                type="checkbox"
                checked={settings.channels.push}
                onChange={e => update({ channels: { ...settings.channels, push: e.target.checked } })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Agent Info */}
      <Card className="border-0 shadow-sm bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">AI Agent Monitoring</p>
              <p className="text-xs text-muted-foreground">
                The AI agent continuously evaluates your financial state against the rules above.
                When a threshold is crossed (e.g., spending exceeds your plan budget, cash drops
                below the floor, or your risk score spikes), it sends you a notification through
                your preferred channels — so you stay protected without having to check manually.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <N8nConnectionCard />
    </div>
  );
}

/* ─── n8n Integration Section ─── */

function N8nConnectionCard() {
  const [status, setStatus] = useState<"idle" | "checking" | "connected" | "disconnected">("idle");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [evaluateResult, setEvaluateResult] = useState<Record<string, unknown> | null>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const checkSync = useCallback(async () => {
    setStatus("checking");
    try {
      const res = await fetch("/api/state/sync");
      if (res.ok) {
        const data = await res.json();
        setLastSync(data.lastSyncedAt);
        setStatus("connected");
      } else {
        setStatus("disconnected");
      }
    } catch {
      setStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    checkSync();
  }, [checkSync]);

  const testEvaluate = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/n8n/evaluate");
      const data = await res.json();
      setEvaluateResult(data);
    } catch {
      setEvaluateResult({ error: "Failed to reach evaluate endpoint" });
    }
    setTesting(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const endpoints = [
    { label: "All Checks (recommended)", path: "/api/n8n/evaluate", method: "GET", description: "Single endpoint returning all rule evaluations" },
    { label: "Spending Monitor", path: "/api/monitor/spending", method: "GET", description: "Variable spending vs plan budget" },
    { label: "Liquidity Monitor", path: "/api/monitor/liquidity", method: "GET", description: "Cash buffer coverage in months" },
    { label: "Drift Detection", path: "/api/monitor/drift", method: "GET", description: "Allocation drift from active plan" },
    { label: "Reallocation Opportunity", path: "/api/monitor/reallocation", method: "GET", description: "Investment/cash rebalance signals" },
    { label: "Scheduled Check-in", path: "/api/notifications/checkin", method: "POST", description: "Periodic progress check-in" },
  ];

  const workflows = [
    { label: "All Checks (Daily)", file: "pfre-all-checks.json", description: "Runs all monitors daily, routes alerts to Slack/email" },
    { label: "Spending Alert (Hourly)", file: "pfre-spending-alert.json", description: "Checks spending budget hourly" },
    { label: "Webhook Trigger (Real-Time)", file: "pfre-webhook-trigger.json", description: "Receives push alerts from the app in real-time" },
  ];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Plug className="w-4 h-4 text-orange-500" />
          n8n Automation Integration
        </CardTitle>
        <CardDescription className="text-xs">
          Connect n8n to poll your monitoring endpoints on a schedule. When thresholds are breached,
          n8n routes alerts to Slack, email, SMS, or any channel you configure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border">
          <div className="flex items-center gap-2">
            {status === "checking" && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            {status === "connected" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            {status === "disconnected" && <XCircle className="w-4 h-4 text-red-400" />}
            {status === "idle" && <div className="w-4 h-4 rounded-full bg-slate-300" />}
            <div>
              <p className="text-sm font-medium">
                State Sync: {status === "connected" ? "Active" : status === "checking" ? "Checking..." : "Not synced"}
              </p>
              {lastSync && (
                <p className="text-xs text-muted-foreground">
                  Last synced: {new Date(lastSync).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={checkSync} disabled={status === "checking"}>
            <RefreshCw className={`w-3 h-3 ${status === "checking" ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* API Endpoints */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">API Endpoints for n8n</p>
          <div className="space-y-2">
            {endpoints.map(ep => (
              <div key={ep.path} className="flex items-center justify-between p-2.5 rounded-lg border bg-white hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={ep.path.includes("evaluate") ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {ep.method}
                    </Badge>
                    <span className="text-xs font-medium truncate">{ep.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 ml-0">{ep.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 ml-2"
                  onClick={() => copyToClipboard(`${baseUrl}${ep.path}`, ep.path)}
                >
                  {copied === ep.path ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Test Button */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={testEvaluate} disabled={testing} className="gap-1.5">
            {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Test Evaluate Endpoint
          </Button>
          {evaluateResult && (
            <Badge variant={
              (evaluateResult as { totalAlerts?: number }).totalAlerts
                ? "destructive"
                : "secondary"
            }>
              {(evaluateResult as { totalAlerts?: number }).totalAlerts ?? 0} alert(s)
            </Badge>
          )}
        </div>

        {evaluateResult && (
          <pre className="text-[10px] bg-slate-900 text-green-400 rounded-lg p-3 overflow-auto max-h-48 font-mono">
            {JSON.stringify(evaluateResult, null, 2)}
          </pre>
        )}

        {/* n8n Workflow Downloads */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Importable n8n Workflows
          </p>
          <div className="space-y-2">
            {workflows.map(wf => (
              <div key={wf.file} className="flex items-center justify-between p-2.5 rounded-lg border bg-white">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{wf.label}</p>
                  <p className="text-[11px] text-muted-foreground">{wf.description}</p>
                </div>
                <a
                  href={`/n8n-workflows/${wf.file}`}
                  download={wf.file}
                  className="shrink-0 ml-2"
                >
                  <Button size="sm" variant="ghost">
                    <Download className="w-3 h-3" />
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Setup Guide */}
        <details className="group">
          <summary className="text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer flex items-center gap-1 select-none">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            Quick Setup Guide
          </summary>
          <div className="mt-3 text-xs text-muted-foreground space-y-3 pl-4 border-l-2 border-slate-200">
            <div>
              <p className="font-medium text-slate-700">1. Install & Start n8n</p>
              <code className="block bg-slate-100 rounded px-2 py-1 mt-1 text-[11px]">
                npx n8n start
              </code>
              <p className="mt-1">Opens at <span className="font-mono">http://localhost:5678</span></p>
            </div>
            <div>
              <p className="font-medium text-slate-700">2. Import a Workflow</p>
              <p>Download one of the workflow JSON files above, then in n8n go to <strong>Workflows → Import from File</strong>.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">3. Set Environment Variable</p>
              <p>In n8n Settings → Variables, create:</p>
              <code className="block bg-slate-100 rounded px-2 py-1 mt-1 text-[11px]">
                PFRE_BASE_URL = {baseUrl}
              </code>
            </div>
            <div>
              <p className="font-medium text-slate-700">4. Enable Notification Nodes</p>
              <p>The Slack/Email nodes are disabled by default. Connect your credentials and enable them.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">5. (Optional) Real-Time Push</p>
              <p>Add to your <code>.env.local</code>:</p>
              <code className="block bg-slate-100 rounded px-2 py-1 mt-1 text-[11px]">
                N8N_WEBHOOK_URL=http://localhost:5678/webhook/pfre-alert
              </code>
              <p className="mt-1">The app will push alerts to n8n in real-time when Plaid refreshes trigger threshold breaches.</p>
            </div>
            <a
              href="https://docs.n8n.io/getting-started/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Full n8n docs <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
