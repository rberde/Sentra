"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useApp } from "@/contexts/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const { state } = useApp();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const { messages: chatMessages, sendMessage, status } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";

  const welcomeMessage: DisplayMessage = {
    id: "welcome",
    role: "assistant",
    text: `Hi${state.profile?.name ? ` ${state.profile.name}` : ""}! I'm your AI financial risk advisor. I can help you:\n\n- Declare risk events — Tell me what happened (e.g., "I lost my job")\n- Explain your numbers — Ask about your risk score, runway, or any metric\n- Compare options — Ask me to explain the tradeoffs between rebalancing plans\n- What-if scenarios — "What if the medical bill is $20K instead of $15K?"\n\nWhat's on your mind?`,
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayMessages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="fixed right-0 top-14 bottom-0 w-96 bg-white border-l shadow-xl flex flex-col z-30">
      <div className="flex items-center justify-between px-4 py-3 border-b">
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

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
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
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t">
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
