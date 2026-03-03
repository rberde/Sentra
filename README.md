https://sentra-fawn.vercel.app/

**Presenting: Sentra - an AI-native Financial Risk Engine**
Sentra is a personal financial risk engine that helps people answer the question traditional finance tools ignore: "What happens to my money if something goes wrong?"
Most financial tools are built for growth in that they track portfolios, suggest investments, and celebrate gains. However, when life throws a curveball, a job loss, unexpected medical bills, market downturns, users are left to figure it out alone. Sentra fills that gap by turning vague financial anxiety into structured plans.

**How does it work?**
A user connects their bank accounts via Plaid (or enters data manually), and Sentra maps their income into five allocation buckets: fixed expenses, variable expenses, investments, savings goals, and cash. The AI suggests an initial split; the user adjusts until it reflects reality.
When a risk event hits, the user describes it in natural language, "I just lost my job, not sure how long I'll be out of a job" and the AI parses severity, duration, and financial impact from the conversation. 
A deterministic stress engine then runs the numbers: how many months of liquidity remain, what the monthly deficit looks like and how the risk score shifts. Based on this, the AI agent generates three concrete plans, each optimizing for a different priority (lifestyle preservation, investment discipline, or savings goal protection). Every plan shows exact dollar reallocations with before and after bucket adjustments.
Once a plan is activated, an AI agent automatically generates threshold-based monitoring rules: spending caps, liquidity caps, risk score alerts, and check-in schedules. These rules are fully editable by the user as well if they wish, but the AI provides the best options. When thresholds are breached (currently in the MVP from a Plaid data refresh or a simulated expense spike) the system fires real-time toast notifications and pushes alerts to n8n for external routing to email, or SMS.

**What is a critical decision that must remain human?**
I made deliberate choices about where AI should and shouldn't operate. The AI handles what it's good at: parsing ambiguous natural language, explaining complex tradeoffs, generating monitoring rules, and proactively suggesting rebalancing opportunities. At every checkpoint, risk declaration, plan selection, rule configuration, the human can confirm or deny even though the AI will suggest. The AI expands what the user can understand and decide; it never decides for them.

**What makes Sentra a gamechanger?**
Sentra isn't a chatbot with a financial wrapper. It is five integrated layers: a financial state model, a risk simulation engine, a constraint-aware rebalancer, an agentic notification system, and an explainability layer powered by GPT-4o. Data flows from Plaid through the engine into rebalancing plans, which generate monitoring rules, which trigger notifications, which can route through n8n to external channels. 
In the V2, Sentra can be given abilities to handle transfers within accounts as well to make it truly AI-native and a loyal assistant.


