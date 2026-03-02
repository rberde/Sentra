PFRE MVP -- Full Build Plan (v3)

Part 1: Alignment with Wealthsimple AI Builder Role

Verdict: Strong fit. The PFRE directly demonstrates the core competencies the AI Builder role demands.





"Redesign processes as AI-native workflows" -- PFRE replaces growth-only financial tools with an AI-native risk and rebalancing system. Not AI layered on old workflows; rebuilt from scratch.



"Own the full path from problem to shipped system" -- End-to-end: risk engine, agentic AI orchestration, constraint-aware rebalancing, hybrid UX, optional Plaid.



"Make explicit decisions about where AI should take responsibility" -- AI suggests allocations and rebalancing plans; user always confirms. Guardrails enforce only after human approval.



"Think in systems, move across disciplines" -- Financial modeling, behavioral economics, agentic AI, API integration, product design.



"Turn ambiguity into shipped work" -- Financial stress is messy and personal. PFRE turns it into structured constraints, deterministic models, and quantified reallocation tradeoffs.



Wealthsimple relevance -- Wealthsimple lacks a downside protection / stress testing layer. PFRE fills that product gap.



Part 2: Core Concept -- Income Allocation Buckets

The foundational data model is the user's monthly income allocation -- what percentage of income flows into each bucket.

The Buckets

Monthly Take-Home Income (100%)
  |
  |-- Fixed Expenses (rent, mortgage, loans, insurance, subscriptions)
  |-- Variable Expenses (groceries, transport, entertainment, shopping)
  |-- Investments (monthly contribution to portfolio)
  |-- Savings Goal (house down payment, car, education, etc.)
  |-- Cash Buffer (checking/chequing account float)

AI-Suggested Initial Allocation

During onboarding, the user provides:





Monthly take-home income



Fixed expenses (itemized)



Their primary goal (e.g., "Save $100K for a house down payment by Dec 2026")



Their goal weights (see below)

The AI then suggests a starting allocation split (e.g., "Based on your income of $5,000/month and fixed expenses of $2,000, I recommend: 40% fixed expenses, 20% variable, 15% investments, 15% savings goal, 10% cash buffer"). The user adjusts or approves.

Goal Weights (User Maximization Priorities)

The user sets three priority weights that tell the AI what matters most to them. These weights drive the 3 rebalancing options during a risk event.





Lifestyle Weight -- How much the user values maintaining current variable spending (entertainment, dining, shopping). AI tracks average variable spending to understand their lifestyle baseline.



Savings Goal Weight -- How much the user values staying on track for a specific goal (e.g., $100K for a house). This creates a protected savings bucket with a target amount and deadline.



Investment Discipline Weight -- How much the user values continuing monthly investment contributions. When weighted high, investment contributions become a quasi-fixed expense that the AI tries to preserve.

Weights are set on a simple slider interface (e.g., each 1-10, normalized internally). The AI suggests starting weights based on the user's stated goal, but the user can override.



Part 3: UX Architecture -- Hybrid (Structured Dashboard + Chat Companion)

The Two Interfaces

flowchart LR
    subgraph structured [Structured Dashboard -- Left/Main]
        Onboarding[Onboarding Wizard]
        AllocDash[Allocation Dashboard]
        RiskCards[Risk Event Cards + Sliders]
        RebalanceCards[3 Rebalancing Options]
        Notifications[Notification Center]
    end
    subgraph chat [Chat Companion -- Right Sidebar]
        ChatDeclare[Declare Risk Events]
        ChatExplain[Ask for Explanations]
        ChatWhatIf[What-If Questions]
        ChatAdvice[Get AI Advice]
    end
    structured <-->|"AI translates between"| chat

Structured Dashboard (primary): Forms, sliders, cards, charts. Deterministic, reproducible, fast.

Chat Companion (persistent sidebar): The user can do everything through the structured UI, but the chat provides a natural-language layer for:





Declaring risk events: User types "I just lost my job" or "I have a $15,000 medical bill coming" -- AI extracts the risk bucket, severity, and duration, and pre-fills the structured risk cards.



Compound scenarios: "What if I lost my job AND had a medical expense?" -- AI stacks multiple risk buckets.



Explaining results: "Why is my liquidity runway only 3 months?" -- Explainer Agent responds conversationally.



What-if exploration: "What if the medical bill is $20K instead of $15K?" -- AI adjusts parameters and re-runs.



Rebalancing conversation: The AI's signature interaction (see Part 5 below).



Part 4: Data Ingestion -- Manual-First, Plaid-Optional

MVP Default: Manual Monthly Input

Users enter all financial data through a guided onboarding wizard in monthly format:





Income: Take-home pay (fixed/variable tagged), secondary streams



Fixed Expenses: Rent/mortgage, loans, insurance, subscriptions (itemized, auto-summed)



Variable Expenses: Groceries, transport, entertainment, discretionary (estimated averages)



Investments: Total portfolio value, allocation breakdown (% equities/bonds/cash/other), monthly contribution



Savings Goal: Goal name, target amount, target date, current balance, monthly contribution



Cash Buffer: Checking/chequing balance

Optional: Connect via Plaid

A "Connect Your Accounts" toggle in onboarding. If opted in:





Plaid Link opens (handles bank login, MFA, OAuth)



App exchanges public_token for access_token



Pulls accounts, balances, and recent transactions



Auto-categorizes transactions into fixed/variable expense buckets



User reviews and corrects any miscategorizations

If declined: manual input is the full experience. No feature degradation.

The engine is input-source agnostic -- both paths produce the same internal data model.



Part 5: The Core AI Interaction -- Constraint-Aware Rebalancing

This is the heart of the product. When a user declares a risk event, the AI reasons about what money can and cannot be touched, and generates 3 reallocation plans aligned to each goal weight.

The Flow

sequenceDiagram
    participant User
    participant Chat as Chat Companion
    participant Orchestrator as Orchestrator Agent
    participant Risk as Risk Agent
    participant Rebalancer as Rebalancer Agent
    participant Explainer as Explainer Agent

    User->>Chat: "I lost my job and have a $15K medical bill"
    Chat->>Orchestrator: Extract: Income Shock (100%, unknown duration) + Expense Shock ($15K lump sum)
    Orchestrator->>Risk: Run stress model with user profile
    Risk-->>Orchestrator: Stress results (burn rate, runway, constraints)
    Orchestrator->>Explainer: Summarize situation
    Explainer-->>Chat: "I see you have a job loss (fixed income gone, unknown duration) and a $15K medical expense..."
    Chat->>User: Situation summary + confirms goals still accurate
    User->>Chat: "Yes, I still want to hit $100K investments by year end"
    Chat->>Orchestrator: Goals confirmed, generate rebalancing options
    Orchestrator->>Rebalancer: Generate 3 plans (Lifestyle / Investment / Savings Goal maximization)
    Rebalancer-->>Orchestrator: 3 constraint-aware reallocation plans
    Orchestrator->>Explainer: Generate tradeoff explanations
    Explainer-->>Chat: 3 options with plain-language tradeoffs
    Chat->>User: Presents 3 options
    User->>Chat: Selects option or asks follow-up

Constraint Identification

When a risk event hits, the AI first identifies what money can and cannot be touched:





Cannot touch (hard constraints): Fixed expenses (rent, mortgage, loan payments, insurance) -- these must be paid regardless



Can reduce (soft constraints): Variable expenses -- groceries can be optimized, entertainment/shopping can be cut



Can pause (user-controlled): Investment contributions -- depends on Investment Discipline weight



Can redirect (user-controlled): Savings goal contributions -- depends on Savings Goal weight



Available liquidity: Cash buffer + accessible savings (not goal-locked)

The 3 Rebalancing Options

For a scenario like job loss + $15K medical bill, the AI generates:

Option 1: Maximize Lifestyle
"To keep your lifestyle as close to normal as possible, we would pause your $750/month investment contributions and redirect your $500/month savings goal contributions to cash. This frees up $1,250/month. Combined with your $8,000 cash buffer, you can cover the $15K medical bill in ~6 months while keeping variable spending at $1,800/month (90% of current). Your $100K investment goal would be delayed by ~8 months. Your house savings would pause entirely."

Option 2: Maximize Investment Discipline
"To keep your investments on track for $100K by year-end, we would cut variable spending from $2,000 to $800/month (essentials only) and redirect savings goal contributions to cash. This frees up $1,700/month. Your medical bill is paid in ~4 months. Investment contributions continue at $750/month. Your house savings pauses. Lifestyle impact is significant for 4 months."

Option 3: Maximize Savings Goal
"To keep your house down payment on track, we would pause investment contributions ($750/month) and cut variable spending to $1,200/month. Savings contributions continue at $500/month. Medical bill is covered in ~5 months. Your $100K investment goal is delayed by ~6 months. Lifestyle is moderately reduced."

Each option includes:





Exact dollar reallocation per bucket



Timeline to resolve the immediate expense



Impact on each goal (quantified delay or shortfall)



Monthly budget breakdown during the crisis period



Projected state at 6/12/24 months



Part 6: Agentic AI Architecture

flowchart TD
    User[User] -->|"declares risk event via chat or cards"| Orchestrator[Orchestrator Agent]
    Orchestrator -->|"profile + risk params"| RiskAgent[Risk Agent]
    Orchestrator -->|"stress results + weights + constraints"| RebalancerAgent[Rebalancer Agent]
    Orchestrator -->|"selected plan"| GuardrailAgent[Guardrail Agent]
    Orchestrator -->|"any output"| ExplainerAgent[Explainer Agent]
    RiskAgent -->|"stress metrics + constraint map"| Orchestrator
    RebalancerAgent -->|"3 reallocation plans"| Orchestrator
    GuardrailAgent -->|"monitoring rules + alerts"| Orchestrator
    ExplainerAgent -->|"plain-language summaries"| Orchestrator
    Orchestrator -->|"options for confirmation"| User
    User -->|"approve / override / ask follow-up"| Orchestrator

Agent Definitions





Orchestrator Agent: Routes data, manages the conversation + workflow sequence, enforces human-in-the-loop checkpoints. Translates chat input into structured risk parameters.



Risk Agent: Runs deterministic stress model. Tools: calculateBaselineRisk(), simulateRiskBucket(), identifyConstraints() (classifies money into touchable/untouchable).



Rebalancer Agent: Core engine. Takes stress results, constraint map, goal weights, and generates 3 reallocation plans. Tools: generateRebalancingPlans(), computeTradeoffs(), projectTimeline().



Guardrail Agent: After user selects a plan, configures monitoring rules. Tools: deploySpendingCap(), deployLiquidityAlert(), deployReallocationOpportunity(), scheduleCheckIn().



Explainer Agent: LLM-powered. Generates all plain-language output -- situation summaries, option tradeoffs, guardrail explanations, notification messages. Tools: explainSituation(), explainOption(), explainAlert().

Human-in-the-Loop Checkpoints





Goal confirmation: After risk event declared, AI confirms user's goals are still accurate before rebalancing



Plan selection: User reviews 3 options and selects one (or asks "what if" follow-ups)



Guardrail approval: User reviews proposed monitoring rules before activation



Ongoing overrides: User can dismiss any alert or re-trigger rebalancing at any time



Part 7: Notification and Automation System (MVP) -- Powered by n8n

After the user selects a rebalancing plan, the Guardrail Agent configures monitoring rules. n8n workflows run on schedule and call Next.js monitoring API routes to check the user's state and create notifications.

5 n8n Workflows





Spending Monitor (runs daily)





Calls GET /api/monitor/spending



Checks: actual variable spending this month vs. plan cap



If >80% of cap: creates "Spending Limit Alert" -- "You've spent $1,450 of your $1,800 variable spending budget this month. $350 remaining for 12 days."



Multi-step: if alert not dismissed in 48h and spending >100% cap, creates escalated alert suggesting plan re-evaluation



Liquidity Monitor (runs daily)





Calls GET /api/monitor/liquidity



Checks: cash buffer vs. threshold (e.g., <1 month of fixed expenses)



If below: creates "Liquidity Warning" -- "Your cash buffer has dropped to $2,100 -- that's less than 1 month of fixed expenses. Consider reviewing your plan."



Reallocation Opportunity (runs weekly)





Calls GET /api/monitor/reallocation



Checks: investment portfolio growth vs. projected growth



If outperforming: creates "Reallocation Opportunity" -- "Your investments grew 3.2% this month. Would you like to redirect $200 of gains toward paying off your medical bill 2 weeks sooner?"



Drift Detection (runs weekly)





Calls GET /api/monitor/drift



Checks: actual spending by category vs. plan allocation



If any category >10% over plan: creates "Drift Alert" -- "Your entertainment spending is 35% higher than your plan. This could delay your medical expense payoff by 2 weeks."



Scheduled Check-In (runs every 30 days after plan activation)





Calls POST /api/notifications/checkin



Creates progress summary: "It's been 30 days since your rebalancing plan started. Your medical bill is now 40% paid off. Would you like to review your plan?"

Architecture





n8n workflows call Next.js API routes via HTTP -- clean separation



API routes read from the database, compute thresholds, return structured data



n8n applies branching logic (escalation, follow-up timing) and calls POST /api/notifications to create alerts



Notifications displayed in-app (banner/toast + notification center page)



All notifications are dismissible. The user is never locked out.



n8n hosted on n8n Cloud (free tier: 5 workflows) or self-hosted on Railway



Part 8: System Layers Summary

Layer 1 -- Financial State Layer





Income allocation bucket model (% split across expenses, investments, savings goal, cash buffer, discretionary)



AI-suggested initial allocation based on goals



Manual input forms (monthly) + optional Plaid auto-import



Baseline financial snapshot (net worth, cash flow, savings rate, risk score)

Layer 2 -- Risk Engine





4 risk buckets: Income Shock, Expense Shock, Market Shock, Structural Drift



Configurable parameters (severity, duration, lump sum)



Constraint identification (hard/soft/pausable/redirectable money)



Stress outputs: burn rate, runway, depletion timeline, risk score delta

Layer 3 -- Constraint-Aware Rebalancer





Takes stress results + constraint map + goal weights



Generates 3 reallocation plans (one per goal weight maximization)



Each plan: exact dollar reallocation, timeline, goal impact, monthly budget breakdown



Projected state at 6/12/24 months

Layer 4 -- Guardrail Agents + n8n Automation





5 monitoring API routes exposed by Next.js (spending, liquidity, reallocation, drift, check-in)



5 n8n workflows that call these routes on schedule (daily/weekly/30-day)



Multi-step branching logic in n8n (escalation if alerts not addressed)



Spending limit alerts, liquidity warnings, reallocation opportunity nudges, drift alerts, scheduled check-ins



All notifications created via API, displayed in-app

Layer 5 -- Behavioral Profile (MVP-Lite)





Path/plan selection history



Override frequency



Risk archetype suggestion after 3+ sessions



Weight recalibration nudges

Cross-Cutting: Explainability





Every output has a plain-language explanation via the Explainer Agent



Conversational in chat, structured on dashboard



Part 9: User Stories

Onboarding and Allocation Setup





US-1: As a user, I want to enter my monthly income, fixed expenses, and financial goals so that the AI can suggest how to allocate my income across buckets.



US-2: As a user, I want the AI to suggest a starting income allocation (% to expenses, investments, savings goal, cash buffer, discretionary) based on my goals so I have a reasonable starting point.



US-3: As a user, I want to adjust the AI-suggested allocation to match my preferences before confirming.



US-4: As a user, I want to set my goal weights (Lifestyle, Savings Goal, Investment Discipline) on a slider so the AI knows what matters most to me.



US-5: As a user, I want the option to connect my bank accounts via Plaid so my data is auto-populated, or I want to type everything in manually.



US-6: As a user, I want to see a summary dashboard of my allocation, goals, and baseline financial health after onboarding.

Risk Event Declaration





US-7: As a user, I want to declare a risk event by clicking a risk card (e.g., "Job Loss," "Medical Expense") and configuring its parameters (severity, duration, amount) so the AI can assess impact.



US-8: As a user, I want to describe my situation in plain language via the chat companion (e.g., "I lost my job and have a $15K medical bill") and have the AI extract the right risk parameters.



US-9: As a user, I want to declare compound risk events (e.g., job loss + medical expense simultaneously) so the AI models the combined impact.



US-10: As a user, after declaring a risk event, I want the AI to confirm whether my financial goals are still accurate before generating rebalancing options.

Constraint-Aware Rebalancing





US-11: As a user, I want to see 3 rebalancing options -- one maximizing lifestyle, one maximizing investment discipline, one maximizing my savings goal -- so I can compare tradeoffs.



US-12: As a user, for each rebalancing option, I want to see: exact dollar reallocation per bucket, timeline to resolve the expense, impact on each goal, and a projected monthly budget during the crisis.



US-13: As a user, I want the AI to explain each option in plain language (e.g., "To keep your lifestyle close to normal, we would pause investments and redirect savings...") so I understand the tradeoffs without doing math.



US-14: As a user, I want to select a rebalancing option and have the system confirm my choice before changing anything.



US-15: As a user, I want to ask follow-up "what if" questions in the chat (e.g., "What if the medical bill is $20K instead?") and see updated options.

Guardrails and Notifications





US-16: As a user, after selecting a rebalancing plan, I want the system to monitor my spending and notify me if I'm approaching my adjusted spending limit.



US-17: As a user, I want to receive a notification if my cash buffer drops below a safe threshold.



US-18: As a user, I want to receive a notification if there's an opportunity to accelerate paying off my expense (e.g., investment gains that could be redirected).



US-19: As a user, I want scheduled check-in notifications (e.g., every 30 days) asking me to review my plan.



US-20: As a user, I want to dismiss any notification or override any guardrail so I always remain in control.

Chat Companion





US-21: As a user, I want a persistent chat sidebar where I can ask questions about my financial situation, risk scores, or rebalancing options at any time.



US-22: As a user, I want the chat to explain any element on the dashboard in plain language when I ask about it.

Behavioral Profile





US-23: As a user, after multiple sessions, I want the system to identify my financial behavior pattern and suggest whether my goal weights should be adjusted.



Part 10: Functional Requirements

FR-1: Financial Data Input and Allocation





FR-1.1: System shall provide a multi-step onboarding wizard for manual entry of: monthly take-home income, fixed expenses (itemized), variable expenses (categorized estimates), investment portfolio (value, allocation %, monthly contribution), savings goal (name, target amount, target date, current balance, monthly contribution), and cash buffer balance.



FR-1.2: System shall model income as an allocation across 5 buckets: Fixed Expenses, Variable Expenses (Discretionary), Investments, Savings Goal, Cash Buffer -- expressed as percentages of monthly income.



FR-1.3: System shall use an AI agent to suggest an initial allocation split based on the user's income, fixed expenses, and stated goals.



FR-1.4: System shall allow the user to adjust the AI-suggested allocation before confirming.



FR-1.5: System shall provide a "Connect Accounts" option launching Plaid Link (Sandbox mode). If connected, auto-populate financial data and allow user corrections.



FR-1.6: System shall compute and display: net worth, monthly cash flow, savings rate, baseline risk score, and an allocation pie chart.

FR-2: Goal Weight System





FR-2.1: System shall allow the user to set 3 goal weights via sliders: Lifestyle Maximization, Savings Goal Maximization, Investment Discipline Maximization.



FR-2.2: Weights shall be on a 1-10 scale, normalized internally to sum to 1.



FR-2.3: The AI shall suggest starting weights based on the user's stated primary goal and provide a rationale.



FR-2.4: The user shall be able to override AI-suggested weights at any time.

FR-3: Risk Event Declaration





FR-3.1: System shall support 4 risk buckets: Income Shock, Expense Shock, Market Shock, Structural Drift.



FR-3.2: Each bucket shall accept configurable parameters via structured cards: severity (% or $), duration (months or "unknown"), and lump sum amount where applicable.



FR-3.3: System shall support compound risk events (multiple simultaneous buckets).



FR-3.4: The chat companion shall accept natural-language risk declarations and extract structured parameters (bucket type, severity, duration, amount).



FR-3.5: After risk event declaration, the AI shall confirm the user's goals before proceeding to rebalancing.

FR-4: Constraint-Aware Rebalancing Engine





FR-4.1: Upon risk event, the Risk Agent shall classify all money into constraint categories: hard constraints (cannot touch -- fixed expenses), soft constraints (can reduce -- variable expenses), pausable (investment contributions), redirectable (savings goal contributions), and available liquidity (cash buffer + accessible savings).



FR-4.2: The Rebalancer Agent shall generate exactly 3 reallocation plans, one maximizing each goal weight: (1) Maximize Lifestyle, (2) Maximize Investment Discipline, (3) Maximize Savings Goal.



FR-4.3: Each plan shall include: exact dollar reallocation per bucket per month, timeline to resolve the immediate expense, quantified impact on each goal (delay in months or shortfall in $), projected monthly budget during the crisis, and projected financial state at 6/12/24 months.



FR-4.4: Each plan shall include a plain-language tradeoff summary generated by the Explainer Agent.



FR-4.5: The user shall select a plan via the dashboard or chat. System shall confirm the selection before activating.

FR-5: Guardrail, Notification, and Automation System





FR-5.1: After plan selection, the Guardrail Agent shall configure monitoring rules based on the plan's budget constraints.



FR-5.2: System shall generate 5 notification types: Spending Limit Alert, Liquidity Warning, Reallocation Opportunity, Scheduled Check-In (30 days), and Drift Alert.



FR-5.3: Notifications shall be displayed in-app (banner/toast + notification center page).



FR-5.4: All notifications shall be dismissible. User can disable specific notification types.



FR-5.5: System shall expose monitoring API routes: /api/monitor/spending, /api/monitor/liquidity, /api/monitor/reallocation, /api/monitor/drift, /api/notifications/checkin.



FR-5.6: n8n shall run 5 automated workflows that periodically call the monitoring API routes: Spending Monitor (daily), Liquidity Monitor (daily), Reallocation Opportunity (weekly), Drift Detection (weekly), Scheduled Check-In (every 30 days after plan activation).



FR-5.7: n8n workflows shall support multi-step branching (e.g., spending >80% cap -> alert; if no dismissal in 48h -> follow-up alert; if >120% cap -> trigger drift alert + plan re-evaluation suggestion).



FR-5.8: Monitoring API routes shall return structured data; n8n decides whether to create a notification based on thresholds and branching logic.

FR-6: Chat Companion





FR-6.1: System shall provide a persistent chat sidebar accessible from all pages.



FR-6.2: Chat shall support: risk event declaration (natural language to structured parameters), "what if" scenario exploration, explanation requests for any dashboard element, and rebalancing plan Q&A.



FR-6.3: Chat responses shall be generated by the Explainer Agent using an LLM.



FR-6.4: Chat shall pre-fill structured UI elements when the user describes a scenario (e.g., typing "job loss" pre-fills the Income Shock card).

FR-7: Agentic AI Orchestration





FR-7.1: System shall use an Orchestrator Agent to route data between Risk Agent, Rebalancer Agent, Guardrail Agent, and Explainer Agent.



FR-7.2: Orchestrator shall enforce human-in-the-loop checkpoints at: goal confirmation, plan selection, guardrail approval.



FR-7.3: All agent inputs and outputs shall be logged with timestamps for audit/explainability.



FR-7.4: Agent errors shall fail gracefully -- structured UI remains functional even if the LLM/chat is unavailable.

FR-8: Behavioral Profile (MVP-Lite)





FR-8.1: System shall record: plan selections, goal weight changes, notification dismissals, and override decisions.



FR-8.2: After 3+ sessions, system shall suggest a risk archetype and recommend weight adjustments if observed behavior diverges from stated weights.



Part 11: Recommended Tech Stack (MVP) -- FINAL





Frontend: Next.js 14+ (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui



Chat UI: Vercel AI SDK (useChat hook) for streaming chat responses



Backend API: Next.js API Routes (all TypeScript, no separate backend)



Risk/Rebalancer Engine: TypeScript (deterministic math, no NumPy needed for MVP)



Agentic AI: Vercel AI SDK with OpenAI tool-calling -- agents are implemented as tools the LLM can invoke (simulateRiskBucket, generateRebalancingPlans, etc.)



LLM: OpenAI API (GPT-4o) for Explainer Agent, chat companion, and allocation suggestions



Plaid: @plaid/plaid-node SDK (Sandbox) + react-plaid-link component



Database: SQLite via Prisma (local MVP) -- stores user profiles, plans, decision logs, notification state



Visualization: Recharts for allocation pie charts, depletion timelines, budget breakdowns



Notifications: In-app via React context/state + notification center page



Automation: n8n (Cloud free tier or self-hosted on Railway) -- 5 workflows for spending monitoring, liquidity checks, reallocation opportunities, drift detection, scheduled check-ins



Deployment: Vercel (frontend + API routes + serverless functions) + n8n Cloud (automation workflows)



Part 12: MVP Scope Boundaries

In scope for MVP:





Manual financial data input (monthly format) with AI-suggested allocation



Goal weight sliders (Lifestyle, Savings Goal, Investment Discipline)



Optional Plaid connection (Sandbox mode)



4 risk buckets with configurable parameters + compound events



Constraint-aware rebalancing: 3 options per risk event



Hybrid UX: structured dashboard + persistent chat companion



Agentic AI orchestration with human-in-the-loop



Plain-language explainability via LLM



5 n8n automation workflows (spending monitor, liquidity monitor, reallocation opportunity, drift detection, scheduled check-in)



5 notification types with multi-step branching (in-app)



Monitoring API routes called by n8n



Demo-ready UI

Out of scope for MVP (future iterations):





Real Plaid Production credentials



Email/SMS notifications (n8n can add these easily in v2)



Real dividend/portfolio growth tracking (MVP uses simplified growth %)



Canadian tax account specifics (TFSA/RRSP/FHSA)



Multi-user authentication / accounts



Mobile app



Real-time transaction monitoring via Plaid webhooks

