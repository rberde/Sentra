PFRE MVP -- Full Build Plan (v4 — Updated March 2026)

═══════════════════════════════════════════════════════════════
STATUS TRACKER
═══════════════════════════════════════════════════════════════

Current State: Core MVP functional end-to-end. Onboarding → Dashboard → Risk Events → Rebalancing → Notifications → AI Chat → Toast Pings all working.

Running at: http://localhost:3000 (Next.js 16 Turbopack dev server)

┌─────────────────────────────────────────┬──────────────┐
│ Feature                                 │ Status       │
├─────────────────────────────────────────┼──────────────┤
│ Onboarding Wizard (8 steps)             │ ✅ DONE      │
│ Plaid Integration (Sandbox)             │ ✅ DONE      │
│ Demo Data (Custom Sandbox User)         │ ✅ DONE      │
│ Income Allocation Buckets               │ ✅ DONE      │
│ AI-Suggested Allocation (sums to 100%)  │ ✅ DONE      │
│ Auto-Adjust Linked Sliders              │ ✅ DONE      │
│ Goal Weight Sliders (3 always visible)  │ ✅ DONE      │
│ Financial Snapshot Dashboard            │ ✅ DONE      │
│ Risk Event Declaration (4 buckets)      │ ✅ DONE      │
│ AI-Guided Risk Flow + Chat History      │ ✅ DONE      │
│ Context-Aware Followup Parsing          │ ✅ DONE      │
│ Revert/Undo in Risk AI Chat             │ ✅ DONE      │
│ Stress Test Engine                      │ ✅ DONE      │
│ Constraint-Aware Rebalancer (3 plans)   │ ✅ DONE      │
│ Metric Definitions Toggle               │ ✅ DONE      │
│ Plan Selection + Activation             │ ✅ DONE      │
│ AI Chat Companion (GPT-4o)              │ ✅ DONE      │
│ Chat Scroll + Full Context Prompt       │ ✅ DONE      │
│ Notification Center (in-app feed)       │ ✅ DONE      │
│ Ping & Settings Tab (threshold rules)   │ ✅ DONE      │
│ AI-Generated Notification Rules         │ ✅ DONE      │
│ Toast Ping Notifications (phone-style)  │ ✅ DONE      │
│ Agent Check Engine (client-side)        │ ✅ DONE      │
│ Simulate Expense Spike (demo button)    │ ✅ DONE      │
│ Plaid Refresh → Agent Checks → Toasts   │ ✅ DONE      │
│ Account Page (recalc + chat history)    │ ✅ DONE      │
│ Hydration Fix (SSR/client guard)        │ ✅ DONE      │
│ Monitoring API Routes (5 endpoints)     │ ✅ DONE      │
│ n8n Workflow Integration                │ 🔲 PLANNED   │
│ SMS/Push Notifications (n8n channels)   │ 🔲 PLANNED   │
│ Behavioral Profile (archetype detect)   │ 🔲 PLANNED   │
│ Recharts Visualizations                 │ 🔲 PLANNED   │
│ SQLite/Prisma Persistence               │ 🔲 PLANNED   │
└─────────────────────────────────────────┴──────────────┘


═══════════════════════════════════════════════════════════════
Part 1: Alignment with Wealthsimple AI Builder Role
═══════════════════════════════════════════════════════════════

Verdict: Strong fit. The PFRE directly demonstrates the core competencies the AI Builder role demands.

"Redesign processes as AI-native workflows" -- PFRE replaces growth-only financial tools with an AI-native risk and rebalancing system. Not AI layered on old workflows; rebuilt from scratch.

"Own the full path from problem to shipped system" -- End-to-end: risk engine, agentic AI orchestration, constraint-aware rebalancing, hybrid UX, optional Plaid.

"Make explicit decisions about where AI should take responsibility" -- AI suggests allocations and rebalancing plans; user always confirms. Guardrails enforce only after human approval. AI auto-generates notification rules but user can edit every one.

"Think in systems, move across disciplines" -- Financial modeling, behavioral economics, agentic AI, API integration, product design.

"Turn ambiguity into shipped work" -- Financial stress is messy and personal. PFRE turns it into structured constraints, deterministic models, and quantified reallocation tradeoffs.

Wealthsimple relevance -- Wealthsimple lacks a downside protection / stress testing layer. PFRE fills that product gap.


═══════════════════════════════════════════════════════════════
Part 2: Core Concept -- Income Allocation Buckets
═══════════════════════════════════════════════════════════════

The foundational data model is the user's monthly income allocation -- what percentage of income flows into each bucket.

The Buckets

Monthly Take-Home Income (100%)
  |
  |-- Fixed Expenses (rent, mortgage, loans, insurance, subscriptions)
  |-- Variable Expenses (groceries, transport, entertainment, shopping)
  |-- Investments or Savings (monthly contribution to portfolio)
  |-- Savings Goal (house down payment, car, education, etc.)
  |-- Cash (checking/chequing account float)

IMPLEMENTATION NOTE: "Cash Buffer" renamed to "Cash" throughout the app. "Investments" label changed to "Investments or Savings" in the allocation editor. When no savings goal is defined, the third rebalancing plan becomes "Maximize Risk Payoff" instead of "Maximize Savings Goal".

AI-Suggested Initial Allocation

During onboarding, the user provides:

- Monthly take-home income (via income streams — each tagged fixed/variable)
- Fixed expenses (itemized, each categorized and tagged fixed/variable, editable)
- Their primary goal (e.g., "Save $100K for a house down payment by Dec 2028")
- Their goal weights (see below)

The AI then suggests a starting allocation split. The algorithm:
1. Fixed expenses = actual fixed expense total as % of income (capped at 80%)
2. Remaining distributed across variable, investments, savings, cash using normalized goal weights
3. Cash gets at least 5% of income
4. Rounding errors absorbed into Cash to guarantee exactly 100% total
5. When no savings goal, that bucket is 0% and its share redistributes

IMPLEMENTATION: `suggestAllocation()` in `src/lib/store.ts`. Always returns values summing to exactly 100.

Goal Weights (User Maximization Priorities)

The user sets three priority weights that tell the AI what matters most to them. These weights drive the 3 rebalancing options during a risk event.

- Lifestyle Weight — How much the user values maintaining current variable spending
- Savings Goal Weight / Risk Payoff Priority — How much the user values staying on track for a specific goal (or paying down risk quickly if no goal)
- Investment Discipline Weight — How much the user values continuing monthly investment contributions

IMPLEMENTATION: Three sliders always visible (step 6 of onboarding). Third slider dynamically labeled "Savings Goal" or "Risk Payoff Priority" based on whether a savings goal is defined.


═══════════════════════════════════════════════════════════════
Part 3: UX Architecture -- Hybrid (Structured Dashboard + Chat Companion)
═══════════════════════════════════════════════════════════════

The Two Interfaces

Structured Dashboard (primary): Forms, sliders, cards, tabs. Deterministic, reproducible, fast.

Chat Companion (persistent sidebar): The user can do everything through the structured UI, but the chat provides a natural-language layer for declaring risk events, asking explanations, what-if scenarios, and comparing rebalancing plans.

IMPLEMENTATION: Dashboard has 6 tabs:
1. Overview — Financial snapshot, allocation editor (with auto-adjust linked sliders), savings goal card
2. Risk Events — AI-guided risk declaration flow with inline chat history, editable suggestions, revert capability
3. Rebalancing — Stress context metrics (with definition toggles), 3 plan cards, plan activation with AI-generated notification rules
4. Notifications — In-app notification feed (active + dismissed)
5. Ping & Settings — Threshold-based notification rules (AI-generated + custom), delivery preferences (time window, frequency, channels)
6. Account — Baseline risk score, recalculate button, AI chat Q&A history

Chat sidebar opens from the header, overlays right side. Uses GPT-4o with full financial context injected into system prompt.


═══════════════════════════════════════════════════════════════
Part 4: Data Ingestion -- Manual-First, Plaid-Optional, Demo-Data Fast Path
═══════════════════════════════════════════════════════════════

Three Paths to Populate Financial Data

1. Demo Data (recommended for showcasing):
   - One-click "Load Demo Data" button in onboarding step 1
   - Creates a Plaid Sandbox item via `/api/plaid/sandbox-token` using a custom user JSON (`sandbox/plaid-custom-user.json`)
   - Custom user includes: checking ($4,250), savings ($22,500), credit card ($3,200 balance), TFSA investment account (VTI, VXUS, BND, AAPL, MSFT holdings totaling ~$40K), and a student loan ($35K, 5.75% APR)
   - 90 days of realistic Toronto-based transactions: rent, utilities, Rogers Internet, Koodo Mobile, GoodLife Fitness, Netflix, Spotify, groceries (Loblaws, No Frills, Metro), TTC pass, Uber rides, restaurants, shopping
   - Exchanges token via `/api/plaid/exchange-token`, which fetches accounts, transactions, investment holdings, and liabilities
   - Auto-categorizes expenses into fixed/variable using occurrence count + vendor name pattern matching

2. Plaid Link (manual sandbox):
   - Standard Plaid Link UI with `user_good` / `pass_good` sandbox credentials
   - Returns Plaid's default sandbox data (less detailed than custom demo data)
   - Same exchange-token flow as demo data

3. Manual Entry:
   - Full onboarding wizard: income streams, expenses (with editable fixed/variable type and category), investments, savings goal, cash balance
   - Fallback expense examples auto-seeded if Plaid transactions aren't ready

Expense Classification Logic (UPDATED):
- Vendor name pattern matching for known recurring services: Rogers, Bell, Telus, Koodo, Netflix, Spotify, GoodLife, hydro, insurance, rent, mortgage, gym, internet, mobile, phone
- Occurrence threshold lowered from 3 to 2 (catches bimonthly items)
- Category-based: housing, insurance, loans, subscriptions → always fixed
- All expenses editable by user (name, amount, category, fixed/variable type)

IMPLEMENTATION: `buildExpenseEstimates()` in both `exchange-token/route.ts` and `autofill/route.ts`. Retry logic with backoff for `PRODUCT_NOT_READY`. Fallback examples via `createFallbackExpenseExamples()`.

Onboarding Steps (8 total):
0. Welcome — Name input
1. Connect Accounts — Demo Data button, Plaid Link, or skip
2. Income — Add income streams (name, monthly $, fixed/variable)
3. Expenses — Add/edit expenses (name, amount, category, fixed/variable)
4. Investments — Portfolio value, monthly contribution, cash balance
5. Savings Goal — Optional toggle, goal details if enabled
6. Goal Weights — 3 sliders (always visible, dynamically labeled)
7. Review — Summary of all inputs, surplus calculation


═══════════════════════════════════════════════════════════════
Part 5: The Core AI Interaction -- Constraint-Aware Rebalancing
═══════════════════════════════════════════════════════════════

This is the heart of the product. When a user declares a risk event, the AI reasons about what money can and cannot be touched, and generates 3 reallocation plans aligned to each goal weight.

The Flow (as implemented)

1. User selects a risk bucket card (Job Loss, Medical/Expense Shock, Market Crash, Lifestyle Inflation)
2. AI assistant asks 2 context-specific questions via inline chat
3. Full conversation history is visible and scrollable throughout
4. AI parses answers using context-aware parsers:
   - `parseMoney()` — regex-based, extracts first dollar-like pattern (handles commas, $, avoids concatenating multiple numbers)
   - `parseMaybePercent()` — detects "half", "quarter", "lost job", explicit N% patterns
   - `parseMaybeDuration()` — detects weeks/days/months/years/unknown/indefinite
5. AI generates a suggested risk event with severity, duration, lump sum
6. User can:
   - Edit values directly via number inputs
   - Chat with AI to refine (e.g., "actually it's $10,000 over 6 weeks")
   - Type "revert" / "undo" / "reset" to restore the original suggestion
   - Click "Revert to original" button
7. Follow-up parsing is context-aware (`applyFollowupToEvent()`):
   - Detects whether message is about money, duration, severity, or interest rates
   - Only updates the relevant field (not all fields with the same number)
   - Returns an explanation of what changed
8. User confirms → event added to active events list
9. "Simulate & Show Plans" runs stress engine + rebalancer and auto-navigates to Rebalancing tab

Constraint Identification

- Cannot touch (hard constraints): Fixed expenses — must be paid
- Can reduce (soft constraints): Variable expenses — can be cut
- Can pause (user-controlled): Investment contributions
- Can redirect (user-controlled): Savings goal contributions
- Available liquidity: Cash + accessible savings

The 3 Rebalancing Options (always generated)

1. Maximize Lifestyle — Pauses investments and redirects savings first; preserves variable spending
2. Maximize Investments — Cuts variable spending aggressively; keeps investment contributions
3. Maximize Savings Goal OR Maximize Risk Payoff — If savings goal exists: preserves savings contributions. If no savings goal: aggressive cuts for fastest expense resolution.

Each option includes:
- Exact dollar reallocation per bucket
- Timeline to resolve the immediate expense
- Impact on each goal (quantified delay, lifestyle reduction %)
- Monthly budget breakdown during the crisis period
- Projected net position at 6/12/24 months

Stress Context Display (Rebalancing tab):
- Liquidity runway (months)
- Risk score (before → after)
- Monthly deficit
- "What do these mean?" toggle with definitions and typical ranges for each metric

IMPLEMENTATION: `simulateRiskBucket()` in `risk-engine.ts`, `generateRebalancingPlans()` in `rebalancer.ts`, `RiskEventPanel` component, `RebalancingPanel` component.


═══════════════════════════════════════════════════════════════
Part 6: Agentic AI Architecture
═══════════════════════════════════════════════════════════════

Agent Definitions (current implementation)

- Orchestrator Agent: Currently implemented as the React component layer + API routes. Routes data between risk engine, rebalancer, chat, and notification systems.
- Risk Agent: Deterministic TypeScript engine. Functions: `calculateBaselineRisk()`, `simulateRiskBucket()`. Classifies money into constraint categories.
- Rebalancer Agent: Deterministic TypeScript engine. Function: `generateRebalancingPlans()`. Takes stress results + constraint map + goal weights → 3 plans.
- Guardrail Agent: Partially implemented. Auto-generates notification rules on plan activation. Threshold-based monitoring rules are configurable in Ping & Settings tab. Full n8n automation planned.
- Explainer Agent: LLM-powered (GPT-4o via Vercel AI SDK). Generates all chat responses with full user context injected into system prompt. System prompt explicitly states the AI has access to the user's data.

Human-in-the-Loop Checkpoints (implemented)

1. Goal confirmation: User reviews and edits AI-suggested risk parameters before confirming
2. Plan selection: User reviews 3 options and selects one
3. Notification rule editing: AI auto-generates rules, user can toggle/edit/delete each one
4. Ongoing overrides: User can dismiss any notification or re-trigger rebalancing


═══════════════════════════════════════════════════════════════
Part 7: Notification and Automation System
═══════════════════════════════════════════════════════════════

Two-Layer Architecture

Layer A — In-App Notification Rules + AI-Generated Alerts (✅ DONE)

When a user selects a rebalancing plan, the AI agent auto-generates plan-specific notification rules:
- Spending cap alert: tied to the plan's variable spending budget (e.g., "Alert when variable spending exceeds $1,800/mo")
- Liquidity floor: based on current cash/expense ratio (e.g., "Alert when cash drops below 2 months of expenses")
- Risk score alert: 10 points above current score (e.g., "Alert when risk score crosses 70")
- Bi-weekly progress check-in (14-day interval)

These appear in the "Ping & Settings" tab with an "AI" badge and are fully editable.

Users also have 5 default rules (pre-loaded, non-AI):
- Variable spending exceeds plan budget
- Cash drops below 2 months of expenses
- Risk score exceeds safe zone (default 60)
- Allocation drifts from plan by more than 10%
- Monthly progress check-in (30-day interval)

Each rule has: enable/disable toggle, description, threshold input, interval input (for check-ins). Users can add custom rules or delete non-AI rules.

Delivery Preferences:
- Ping window: start time / end time
- Frequency: realtime | daily digest | weekly digest
- Channels: in-app (toggle), SMS (toggle), push (toggle)

Layer A.2 — Client-Side Agent Checks + Toast Pings (✅ DONE)

Pure function `runAgentChecks(state)` in `src/lib/engine/agent-checks.ts` evaluates all enabled notification rules against the live app state:
- Spending cap: actual variable spending vs active plan's budget threshold
- Liquidity floor: cash balance vs months-of-fixed-expenses threshold
- Risk score: stress result score vs configured threshold
- Allocation drift: actual vs planned allocation percentages
- Scheduled check-in: time since last check-in vs interval

Toast notification system (`src/components/notifications/toast-ping.tsx` + `src/contexts/toast-context.tsx`):
- iPhone-style slide-in banners at top-right with CSS animation
- Severity-based styling (urgent=red, warning=amber, info=blue)
- Ping sound on appearance (base64-embedded chime)
- Auto-dismiss after 6 seconds with progress timer bar
- Stack up to 3 visible simultaneously
- Click to dismiss

Two trigger paths:
1. "Simulate Expense Spike" button (Overview tab, visible when plan active): inflates variable expenses 35-50%, runs agent checks, fires toasts. Does NOT persist fake data.
2. "Refresh from Plaid" button (Overview tab, visible when Plaid connected): pulls fresh balances/transactions, updates profile, auto-runs agent checks if plan active, fires toasts for any breached rules.

Layer B — n8n External Automation (🔲 PLANNED)

5 n8n workflows will call Next.js monitoring API routes:
1. Spending Monitor (daily) → GET /api/monitor/spending
2. Liquidity Monitor (daily) → GET /api/monitor/liquidity
3. Reallocation Opportunity (weekly) → GET /api/monitor/reallocation
4. Drift Detection (weekly) → GET /api/monitor/drift
5. Scheduled Check-In (per rule interval) → POST /api/notifications/checkin

API routes are already implemented (stub endpoints ready). n8n integration is the next phase.


═══════════════════════════════════════════════════════════════
Part 8: System Layers Summary
═══════════════════════════════════════════════════════════════

Layer 1 — Financial State Layer (✅ DONE)
- Income allocation bucket model (% split, always sums to 100)
- AI-suggested initial allocation with auto-adjust linked sliders
- Manual input forms + Plaid auto-import + demo data fast path
- Financial snapshot dashboard (income, expenses, portfolio, cash, surplus)

Layer 2 — Risk Engine (✅ DONE)
- 4 risk buckets: Income Shock, Expense Shock, Market Shock, Structural Drift
- Context-aware natural language parsing (money, percent, duration, interest rates)
- Inline editing + AI chat refinement with revert capability
- Constraint identification (hard/soft/pausable/redirectable/liquidity)
- Stress outputs: burn rate, runway, depletion timeline, risk score delta

Layer 3 — Constraint-Aware Rebalancer (✅ DONE)
- Takes stress results + constraint map + goal weights
- Generates 3 reallocation plans (one per goal weight maximization)
- Each plan: dollar reallocation, timeline, goal impact, budget breakdown
- Projected net position at 6/12/24 months
- Metric definitions toggle (liquidity runway, risk score, monthly deficit)

Layer 4 — Guardrail Agents + Notification System (✅ IN-APP DONE, 🔲 n8n PLANNED)
- AI auto-generates plan-specific notification rules on activation
- Threshold-based rules (spending cap, liquidity floor, risk score, drift, check-in)
- All rules editable in dedicated Ping & Settings tab
- Delivery preferences: time window, frequency, channels
- 5 monitoring API routes implemented (stubs ready for n8n)
- In-app notification center with active/dismissed feeds
- Client-side agent check engine (`runAgentChecks()`) evaluates all enabled rules against current state
- Toast ping notifications: iPhone-style slide-in banners with severity colors, ping sound, 6s auto-dismiss, stack up to 3
- "Simulate Expense Spike" demo button: inflates variable spending 35-50%, runs agent checks, fires toasts
- Plaid Refresh on dashboard: pulls latest data, auto-triggers agent checks if plan active, toasts for breached thresholds

Layer 5 — Behavioral Profile (🔲 MVP-LITE PLANNED)
- Plan selection history recorded (via RECORD_PLAN_SELECTION action)
- Override count tracked
- Risk archetype detection after 3+ sessions (planned)
- Weight recalibration nudges (planned)

Cross-Cutting: Explainability (✅ DONE)
- GPT-4o chat companion with full financial context
- System prompt explicitly states it has full access to user data
- Every stress metric has a plain-language definition
- Rebalancing plans include tradeoff summaries


═══════════════════════════════════════════════════════════════
Part 9: User Stories — Implementation Status
═══════════════════════════════════════════════════════════════

Onboarding and Allocation Setup

- US-1: ✅ Multi-step onboarding wizard (8 steps), income streams, fixed/variable expenses, investments, savings goal, cash
- US-2: ✅ AI suggests allocation via `suggestAllocation()`, always sums to 100%
- US-3: ✅ Allocation editor with auto-adjust linked sliders (moving one redistributes others)
- US-4: ✅ 3 goal weight sliders always visible, dynamically labeled
- US-5: ✅ Plaid Link (sandbox), Demo Data button, or manual entry
- US-6: ✅ Financial snapshot dashboard on Overview tab

Risk Event Declaration

- US-7: ✅ 4 risk bucket cards with AI-guided parameter extraction
- US-8: ✅ Natural language input with context-aware parsing (handles "5% interest on $10,000", "6 weeks", etc.)
- US-9: ✅ Compound risk events supported (multiple active events)
- US-10: ✅ AI shows parsed suggestion, user edits/confirms before adding

Constraint-Aware Rebalancing

- US-11: ✅ 3 rebalancing options always generated (Lifestyle / Investments / Savings or Risk Payoff)
- US-12: ✅ Each plan: dollar reallocation, timeline, goal impact, budget breakdown, projections
- US-13: ✅ Plain-language tradeoff summaries + metric definitions toggle
- US-14: ✅ Plan selection with confirmation and activation notification
- US-15: ✅ AI chat companion for follow-up questions (sidebar)

Guardrails and Notifications

- US-16: ✅ Spending cap alert rules (AI-generated + custom)
- US-17: ✅ Liquidity floor rules with configurable threshold
- US-18: 🔲 Reallocation opportunity detection (API stub ready, n8n planned)
- US-19: ✅ Scheduled check-in rules with configurable interval
- US-20: ✅ All notifications dismissible, all rules toggle-able

Chat Companion

- US-21: ✅ Persistent chat sidebar with GPT-4o, full context, scrollable
- US-22: ✅ Chat explains metrics, plans, and financial state with actual numbers

Behavioral Profile

- US-23: 🔲 Archetype detection planned after 3+ sessions


═══════════════════════════════════════════════════════════════
Part 10: Actual Tech Stack (as built)
═══════════════════════════════════════════════════════════════

- Frontend: Next.js 16.1.6 (App Router, Turbopack) + React 19.2.3 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui
- Chat UI: Vercel AI SDK (`@ai-sdk/react` useChat hook + `DefaultChatTransport`) for streaming responses
- Backend API: Next.js API Routes (all TypeScript)
- Risk/Rebalancer Engine: TypeScript deterministic math (`src/lib/engine/risk-engine.ts`, `src/lib/engine/rebalancer.ts`)
- LLM: OpenAI API (GPT-4o) via `@ai-sdk/openai` — powers chat companion
- Plaid: `plaid` ^41.3.0 + `react-plaid-link` ^4.1.1 (Sandbox environment)
- State Persistence: `localStorage` via React Context + `useReducer` (no database yet)
- UI Components: shadcn/ui (button, card, input, label, slider, tabs, badge, dialog, progress, scroll-area, separator, sheet, tooltip)
- Icons: lucide-react
- Deployment: Local development (Vercel deployment ready)

DEVIATION FROM ORIGINAL PLAN:
- Using localStorage instead of SQLite/Prisma for MVP speed. Prisma schema exists but models not yet defined.
- No Recharts visualizations yet (allocation bar is custom CSS).
- n8n workflows not yet connected (monitoring API stubs are ready).
- Agent architecture is flatter than planned — orchestration happens in React components rather than a formal multi-agent system. The chat companion is a single GPT-4o call with rich system prompts, not a tool-calling agent chain.


═══════════════════════════════════════════════════════════════
Part 11: File Architecture
═══════════════════════════════════════════════════════════════

pfre/
├── sandbox/
│   └── plaid-custom-user.json          # Custom Plaid sandbox data (Toronto-based)
├── src/
│   ├── app/
│   │   ├── layout.tsx                   # Root layout with AppProvider
│   │   ├── page.tsx                     # Root page (onboarding vs dashboard, hydration guard)
│   │   └── api/
│   │       ├── chat/route.ts            # GPT-4o chat with full financial context
│   │       ├── monitor/
│   │       │   ├── spending/route.ts    # Spending monitor endpoint (stub)
│   │       │   ├── liquidity/route.ts   # Liquidity monitor endpoint (stub)
│   │       │   ├── reallocation/route.ts# Reallocation opportunity endpoint (stub)
│   │       │   └── drift/route.ts       # Drift detection endpoint (stub)
│   │       ├── notifications/
│   │       │   └── checkin/route.ts      # Scheduled check-in endpoint (stub)
│   │       └── plaid/
│   │           ├── create-link-token/route.ts  # Creates Plaid Link token
│   │           ├── exchange-token/route.ts     # Exchanges public token, fetches all data
│   │           ├── autofill/route.ts           # Refreshes Plaid data with existing token
│   │           ├── investments/route.ts        # Investment holdings endpoint
│   │           └── sandbox-token/route.ts      # Creates sandbox token with custom user
│   ├── components/
│   │   ├── account/account-page.tsx            # Recalculate + chat history
│   │   ├── chat/chat-sidebar.tsx               # Persistent AI chat (native scroll)
│   │   ├── dashboard/
│   │   │   ├── allocation-chart.tsx            # (placeholder)
│   │   │   ├── allocation-editor.tsx           # Auto-adjust sliders, AI suggest
│   │   │   ├── dashboard-layout.tsx            # 6-tab layout + chat sidebar + simulate spike + Plaid refresh
│   │   │   ├── financial-snapshot.tsx           # Overview metrics
│   │   │   └── savings-goal-card.tsx            # Savings goal display + Plaid link
│   │   ├── notifications/
│   │   │   ├── notification-center.tsx          # Active/dismissed notification feed
│   │   │   └── toast-ping.tsx                   # iPhone-style slide-in toast banner + ping sound
│   │   ├── onboarding/onboarding-wizard.tsx     # 8-step wizard
│   │   ├── plaid/plaid-link-button.tsx          # Plaid Link trigger
│   │   ├── rebalancing/rebalancing-panel.tsx    # 3 plan cards + AI activation
│   │   ├── risk/
│   │   │   ├── depletion-chart.tsx              # (placeholder)
│   │   │   └── risk-event-panel.tsx             # AI-guided risk flow
│   │   ├── settings/notification-settings-card.tsx # Threshold rules + delivery prefs
│   │   └── ui/ (14 shadcn primitives)
│   ├── contexts/
│   │   ├── app-context.tsx                      # Global state (useReducer + localStorage)
│   │   └── toast-context.tsx                    # Toast queue provider + showToast() API
│   └── lib/
│       ├── engine/
│       │   ├── agent-checks.ts                  # Client-side rule evaluation engine
│       │   ├── rebalancer.ts                    # 3-plan generation engine
│       │   └── risk-engine.ts                   # Stress test + baseline risk
│       ├── store.ts                             # State schema, defaults, suggestAllocation
│       ├── types.ts                             # All TypeScript interfaces
│       └── utils.ts                             # cn() utility


═══════════════════════════════════════════════════════════════
Part 12: MVP Scope Boundaries (Updated)
═══════════════════════════════════════════════════════════════

In scope for MVP (✅ DONE):

- Manual financial data input with AI-suggested allocation (always 100%)
- Demo data fast path (custom Plaid Sandbox user with rich Toronto-based transactions)
- Goal weight sliders (3, always visible, dynamically labeled)
- Plaid connection (Sandbox mode) with improved expense classification
- 4 risk buckets with context-aware NLP parsing + compound events
- Constraint-aware rebalancing: 3 options per risk event (always generated)
- AI-guided risk flow with inline chat history, editable suggestions, revert
- Hybrid UX: 6-tab dashboard + persistent chat companion
- GPT-4o chat with full financial context (never says "I don't have access")
- Metric definitions and ranges toggle on rebalancing tab
- AI-generated notification rules on plan activation
- Threshold-based ping settings (spending cap, liquidity floor, risk score, drift, check-in)
- Dedicated Ping & Settings tab with delivery preferences
- In-app notification center (active/dismissed)
- Account page with recalculate and chat Q&A history
- Auto-adjust linked allocation sliders
- 5 monitoring API route stubs
- Hydration-safe SSR rendering
- Client-side agent check engine with 5 rule evaluators
- Toast ping notifications (iPhone-style banners with sound)
- "Simulate Expense Spike" demo button for showcasing notification flow
- Dashboard "Refresh from Plaid" button with auto agent checks + toasts

In scope for MVP (🔲 NEXT):

- n8n workflow integration (5 automated monitors calling API routes)
- Recharts visualizations (allocation pie chart, depletion timeline)
- SQLite/Prisma persistence (replace localStorage)
- Behavioral archetype detection after 3+ sessions
- Weight recalibration nudges

Out of scope for MVP (future iterations):

- Real Plaid Production credentials
- Email/SMS/push notification delivery (UI toggles exist, backend channels need n8n)
- Real dividend/portfolio growth tracking (MVP uses simplified growth %)
- Canadian tax account specifics (TFSA/RRSP/FHSA)
- Multi-user authentication / accounts
- Mobile app
- Real-time transaction monitoring via Plaid webhooks
- Full multi-agent orchestration (current: flat component-driven, future: tool-calling agent chain)


═══════════════════════════════════════════════════════════════
Part 13: Key Design Decisions & Rationale
═══════════════════════════════════════════════════════════════

1. localStorage over SQLite/Prisma: Speed of iteration. No migration overhead during rapid prototyping. Prisma can be added when multi-user support is needed.

2. Flat component architecture over formal agent system: The original plan called for an Orchestrator → Agent chain. In practice, React components + API routes provide the same flow with less abstraction overhead for an MVP. The chat companion is a single GPT-4o call with a rich system prompt rather than a tool-calling agent. This can be upgraded to tool-calling when needed.

3. Custom Plaid Sandbox user over generic test data: Generic Plaid sandbox data is sparse and not Canadian. The custom user JSON (`plaid-custom-user.json`) creates a realistic Toronto-based financial profile with specific vendors, investment holdings, and a student loan — making demos significantly more compelling.

4. Auto-adjust allocation sliders: Instead of allowing the user to set arbitrary values and showing an error, sliders are linked — moving one automatically redistributes others proportionally. This prevents the "doesn't add to 100%" frustration.

5. Context-aware follow-up parsing: The original `applyFollowupToEvent()` applied parsed numbers to ALL fields. This caused bugs like "actually it's $10,000" setting both lumpSum AND duration to 10000. The fix uses keyword detection to determine which field the user is talking about and only updates that one.

6. AI system prompt assertiveness: GPT-4o would sometimes say "I don't have access to your financial data" despite the full profile being in the system prompt. The fix was to explicitly state "You DO have access" and "Never say you don't have access" in the system prompt.

7. Native scroll over Radix ScrollArea: The `ScrollArea` component from radix-ui didn't reliably auto-scroll to new messages. Replaced with native `overflow-y-auto` + a scroll-to-bottom ref for the chat sidebar.

8. Client-side agent checks over server-side API polling: For instant demo feedback, `runAgentChecks()` runs entirely in the browser against the React state. No network round-trip needed. The existing monitoring API routes remain as stubs for future n8n server-side polling — both paths can coexist.

9. Simulated expense spike as non-persistent: The "Simulate Expense Spike" button inflates variable expenses temporarily (35-50%) but does NOT write the fake data to state. This lets the user repeatedly demo the notification flow without corrupting their profile.
