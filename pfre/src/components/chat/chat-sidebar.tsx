"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useApp } from "@/contexts/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Bot, User, Loader2 } from "lucide-react";

interface Props {
  onClose: () => void;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export function ChatSidebar({ onClose }: Props) {
  const { state, dispatch } = useApp();
  const [input, setInput] = useState("");
  const scrollEndRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    body: {
      profile: state.profile,
      riskEvents: state.riskEvents,
      stressResult: state.stressResult,
      rebalancingPlans: state.rebalancingPlans,
      selectedPlanId: state.selectedPlanId,
    },
  }), [state.profile, state.riskEvents, state.stressResult, state.rebalancingPlans, state.selectedPlanId]);

  const { messages: chatMessages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";

  const welcomeMessage: DisplayMessage = {
    id: "welcome",
    role: "assistant",
    text: `Hi${state.profile?.name ? ` ${state.profile.name}` : ""}! I'm your AI financial risk advisor. I have full access to your financial profile, risk events, and rebalancing plans. I can help you:\n\n- Declare risk events — Tell me what happened (e.g., "I lost my job")\n- Explain your numbers — Ask about your risk score, runway, or any metric\n- Compare options — Ask me to explain the tradeoffs between rebalancing plans\n- What-if scenarios — "What if the medical bill is $20K instead of $15K?"\n\nWhat's on your mind?`,
  };

  const displayMessages: DisplayMessage[] = [
    welcomeMessage,
    ...chatMessages.map(msg => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      text: msg.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map(p => p.text)
        .join("") || "",
    })).filter(m => m.text && (m.role === "user" || m.role === "assistant")),
  ];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages.length, isLoading]);

  useEffect(() => {
    const history = chatMessages
      .map(msg => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.parts
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map(p => p.text)
          .join("") || "",
        createdAt: new Date().toISOString(),
      }))
      .filter(m => m.content && (m.role === "user" || m.role === "assistant"));
    dispatch({ type: "SET_CHAT_HISTORY", history });
  }, [chatMessages, dispatch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="fixed right-0 top-14 bottom-0 w-96 bg-white border-l shadow-xl flex flex-col z-30">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">AI Risk Advisor</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Scrollable message area — uses native overflow instead of ScrollArea for reliable scrolling */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {displayMessages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
              )}
              <div
                className={`rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.text}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3 h-3" />
                </div>
              )}
            </div>
          ))}
          {isLoading && displayMessages[displayMessages.length - 1]?.role === "user" && (
            <div className="flex gap-2">
              <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <Bot className="w-3 h-3 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
              AI assistant is unavailable right now. Please retry in a few seconds.
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your finances..."
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
